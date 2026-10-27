import type { Place } from './types';

const BASE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const MIN_QUERY_LENGTH = 2;
const RESULT_COUNT = 5;

export class GeocodingError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'GeocodingError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAbortError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError'
  );
}

function isCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function mapResult(raw: unknown): Place | null {
  if (!isRecord(raw)) return null;
  const { id, name, admin1, country, latitude, longitude } = raw;
  if (typeof name !== 'string' || name === '') return null;
  if (!isCoordinate(latitude) || !isCoordinate(longitude)) return null;
  const place: Place = {
    id: typeof id === 'number' ? id : 0,
    name,
    lat: latitude,
    lon: longitude,
  };
  if (typeof admin1 === 'string' && admin1 !== '') place.admin1 = admin1;
  if (typeof country === 'string' && country !== '') place.country = country;
  return place;
}

export async function searchCities(query: string, signal?: AbortSignal): Promise<Place[]> {
  const name = query.trim();
  if (name.length < MIN_QUERY_LENGTH) return [];

  let json: unknown;
  try {
    const res = await fetch(
      `${BASE_URL}?name=${encodeURIComponent(name)}&count=${RESULT_COUNT}&language=en&format=json`,
      { signal },
    );
    if (!res.ok) throw new GeocodingError(`Geocoding request failed (${res.status})`);
    json = await res.json();
  } catch (err) {
    if (isAbortError(err)) throw err;
    if (err instanceof GeocodingError) throw err;
    throw new GeocodingError('Geocoding request failed', { cause: err });
  }

  if (!isRecord(json) || !Array.isArray(json.results)) return [];
  return json.results.map(mapResult).filter((p): p is Place => p !== null);
}

export function formatPlace(p: Place): string {
  const admin1 = p.admin1 === p.name ? undefined : p.admin1;
  return [p.name, admin1, p.country].filter((part): part is string => !!part).join(', ');
}
