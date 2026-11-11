import { YOUR_LOCATION_ID } from '../../data/geolocation';
import type { Place } from '../../data/types';
import { roundHalfUp } from '../../domain/scoring';
import { rules } from '../../domain/rules.config';
import type { ScoredHour, TimeWindow } from '../../domain/types';

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

/** Daily context is explicitly separate from the recommended window, for either plan day. */
export function nowLine(hours: ScoredHour[], day: 'today' | 'tomorrow'): string {
  const daylight = hours.filter((h) => h.isDay);
  const uvs = daylight.map((h) => h.uv).filter(present);
  const parts = [
    uvs.length > 0
      ? `${day === 'today' ? 'Today' : 'Tomorrow'}’s peak UV ${roundHalfUp(Math.max(...uvs))}`
      : null,
    feelsText(daylight.map((h) => h.feelsLike).filter(present)),
  ].filter((p): p is string => p !== null);
  return parts.join(' · ');
}

/** Keep the caution specific only when heat alone explains the yellow verdict. */
export function windowVerdictLabel(window: TimeWindow): string {
  const heatOnly =
    window.hours.some((h) => h.points.heat > 0) &&
    window.hours.every(
      (h) => h.points.uv === 0 && h.points.rain === 0 && h.points.wind === 0 && h.points.cold === 0,
    );
  return window.verdict === 'yellow' && heatOnly
    ? 'Hot — take precautions'
    : rules.verdictLabels[window.verdict];
}

export function windowUvLine(window: TimeWindow): string {
  const uvs = window.hours.map((h) => h.uv).filter(present);
  return uvs.length ? `UV ${roundHalfUp(Math.max(...uvs))} during your outing` : '';
}
