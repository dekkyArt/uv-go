import type { Place } from './types';

export const GEOLOCATION_TIMEOUT_MS = 10000;
/**
 * The browser's own timeout only starts once permission is granted. An ignored prompt would leave
 * the promise pending forever, so an outer guard rejects shortly after the same limit.
 */
export const GEOLOCATION_GUARD_MARGIN_MS = 1000;
export const YOUR_LOCATION_ID = -1;

export type GeoErrorCode = 'denied' | 'timeout' | 'unavailable';

export class GeoError extends Error {
  readonly code: GeoErrorCode;

  constructor(code: GeoErrorCode, options?: ErrorOptions) {
    super(`Geolocation ${code}`, options);
    this.name = 'GeoError';
    this.code = code;
  }
}

// GeolocationPositionError codes: 1 PERMISSION_DENIED, 2 POSITION_UNAVAILABLE, 3 TIMEOUT.
function codeFor(positionErrorCode: number): GeoErrorCode {
  if (positionErrorCode === 1) return 'denied';
  if (positionErrorCode === 3) return 'timeout';
  return 'unavailable';
}

export function requestPosition(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    const geolocation = typeof navigator === 'undefined' ? undefined : navigator.geolocation;
    if (!geolocation) {
      reject(new GeoError('unavailable'));
      return;
    }
    const guard = setTimeout(
      () => reject(new GeoError('timeout')),
      GEOLOCATION_TIMEOUT_MS + GEOLOCATION_GUARD_MARGIN_MS,
    );
    try {
      geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(guard);
          resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        },
        (err) => {
          clearTimeout(guard);
          reject(new GeoError(codeFor(err.code)));
        },
        { timeout: GEOLOCATION_TIMEOUT_MS },
      );
    } catch (err) {
      clearTimeout(guard);
      reject(new GeoError('unavailable', { cause: err }));
    }
  });
}

export function yourLocationPlace(lat: number, lon: number): Place {
  return { id: YOUR_LOCATION_ID, name: 'Your location', lat, lon };
}
