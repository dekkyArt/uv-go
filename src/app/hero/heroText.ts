import { YOUR_LOCATION_ID } from '../../data/geolocation';
import type { Place } from '../../data/types';
import { roundHalfUp } from '../../domain/scoring';
import type { NowLocal, ScoredHour } from '../../domain/types';

/** There is no reverse geocoding, so the geolocated place is titled "My location" itself. */
export function placeTitle(place: Place): { name: string; mine: boolean } {
  if (place.id === YOUR_LOCATION_ID) return { name: 'My location', mine: true };
  return { name: place.name, mine: false };
}

function feelsText(values: number[]): string | null {
  if (values.length === 0) return null;
  const lo = roundHalfUp(Math.min(...values));
  const hi = roundHalfUp(Math.max(...values));
  return lo === hi ? `Feels ${lo}°` : `Feels ${lo}–${hi}°`;
}

const present = (n: number | null): n is number => n !== null;

/**
 * The hero's "weather now" line, like the H:L line of iOS Weather. Today: the current hour.
 * Tomorrow: the peak UV and feels-like range over daylight. Missing values are left out, never
 * printed as null.
 */
export function nowLine(
  hours: ScoredHour[],
  day: 'today' | 'tomorrow',
  now: NowLocal | null,
): string {
  if (day === 'today') {
    const current = now ? hours.find((h) => h.hour === now.hour) : undefined;
    if (!current) return '';
    const parts = [
      current.uv === null ? null : `UV ${roundHalfUp(current.uv)}`,
      feelsText([current.feelsLike].filter(present)),
    ].filter((p): p is string => p !== null);
    return parts.length === 0 ? '' : `Now ${parts.join(' · ')}`;
  }
  const daylight = hours.filter((h) => h.isDay);
  const uvs = daylight.map((h) => h.uv).filter(present);
  const parts = [
    uvs.length > 0 ? `Peak UV ${roundHalfUp(Math.max(...uvs))}` : null,
    feelsText(daylight.map((h) => h.feelsLike).filter(present)),
  ].filter((p): p is string => p !== null);
  return parts.join(' · ');
}
