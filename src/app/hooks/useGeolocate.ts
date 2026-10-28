import { useCallback, useEffect, useRef, useState } from 'react';
import { requestPosition, yourLocationPlace } from '../../data/geolocation';
import type { Place } from '../../data/types';

/**
 * "Use my location": asks the browser for a position and hands the "Your location" place to
 * `onPlace`. A refusal or timeout sets `geoError` instead.
 * Returns `{ locating, geoError, locate(), clearError(), cancel() }`. `cancel` drops the request in
 * flight (its result is ignored) and ends `locating`; a newer `locate` supersedes an older one the
 * same way. Nothing is set or called after unmount.
 */
export function useGeolocate(onPlace: (p: Place) => void) {
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState(false);
  const mounted = useRef(false);
  const requestId = useRef(0);
  const latestOnPlace = useRef(onPlace);

  useEffect(() => {
    latestOnPlace.current = onPlace;
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const locate = useCallback(async () => {
    const id = ++requestId.current;
    const current = () => mounted.current && id === requestId.current;
    setLocating(true);
    setGeoError(false);
    try {
      const { lat, lon } = await requestPosition();
      if (!current()) return;
      latestOnPlace.current(yourLocationPlace(lat, lon));
    } catch {
      if (current()) setGeoError(true);
    } finally {
      if (current()) setLocating(false);
    }
  }, []);

  const cancel = useCallback(() => {
    requestId.current++;
    setLocating(false);
  }, []);

  const clearError = useCallback(() => setGeoError(false), []);

  return { locating, geoError, locate, clearError, cancel };
}
