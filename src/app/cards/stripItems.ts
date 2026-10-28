import { roundHalfUp } from '../../domain/scoring';
import type { DayForecast, ScoredHour } from '../../domain/types';
import { CELL_W, formatHour, verdictLabel } from '../ui';

export type Metric = 'uv' | 'rain' | 'feels';

export type StripItem =
  { kind: 'hour'; hour: ScoredHour } | { kind: 'sun'; event: 'sunrise' | 'sunset'; time: string };

const NO_VALUE = '–';
const NO_DATA = 'no data';

// Open-Meteo local ISO ('YYYY-MM-DDTHH:MM') or bare 'HH:MM', as in src/domain/sky.ts.
const CLOCK = /^(?:(\d{4}-\d{2}-\d{2})T)?(\d{2}):(\d{2})$/;

interface Clock {
  date: string | null;
  hour: number;
  minute: number;
}

function parseClock(value: string): Clock | null {
  const m = CLOCK.exec(value);
  if (!m) return null;
  const hour = Number(m[2]);
  const minute = Number(m[3]);
  if (hour >= 24 || minute >= 60) return null;
  return { date: m[1] ?? null, hour, minute };
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Sunrise and sunset, or null when either is unusable (polar day or night, missing data, another
 * day's date, sunrise not before sunset): then the strip shows no sun cells at all.
 */
function sunEvents(day: DayForecast): { rise: Clock; set: Clock } | null {
  const rise = parseClock(day.sunrise);
  const set = parseClock(day.sunset);
  if (!rise || !set) return null;
  if (rise.date !== set.date) return null;
  if (rise.date !== null && rise.date !== day.date) return null;
  if (rise.hour * 60 + rise.minute >= set.hour * 60 + set.minute) return null;
  return { rise, set };
}

/** The 24 hours with the sunrise and sunset cells placed right after the hour they fall in. */
export function stripItems(day: DayForecast, hours: ScoredHour[]): StripItem[] {
  const sun = sunEvents(day);
  const items: StripItem[] = [];
  for (const hour of hours) {
    items.push({ kind: 'hour', hour });
    if (!sun) continue;
    if (sun.rise.hour === hour.hour) {
      items.push({
        kind: 'sun',
        event: 'sunrise',
        time: `${pad(sun.rise.hour)}:${pad(sun.rise.minute)}`,
      });
    }
    if (sun.set.hour === hour.hour) {
      items.push({
        kind: 'sun',
        event: 'sunset',
        time: `${pad(sun.set.hour)}:${pad(sun.set.minute)}`,
      });
    }
  }
  return items;
}

export function metricValue(hour: ScoredHour, metric: Metric): string {
  const value = { uv: hour.uv, rain: hour.rainProb, feels: hour.feelsLike }[metric];
  if (value === null) return NO_VALUE;
  const rounded = roundHalfUp(value);
  if (metric === 'rain') return `${rounded}%`;
  return metric === 'feels' ? `${rounded}°` : String(rounded);
}

/** Accessible name of an hour cell: '14:00, UV 5, rain 30%, OK with protection'. */
export function cellName(hour: ScoredHour): string {
  const uv = hour.uv === null ? NO_DATA : String(roundHalfUp(hour.uv));
  const rain = hour.rainProb === null ? NO_DATA : `${roundHalfUp(hour.rainProb)}%`;
  const verdict = hour.verdict === 'night' ? 'Night' : verdictLabel(hour.verdict);
  return `${formatHour(hour.hour)}, UV ${uv}, rain ${rain}, ${verdict}`;
}

/**
 * Pixel box of the hour cells in [fromHour, toHourExclusive), including any sun cell between
 * them; null when no hour falls in the range.
 */
export function spanOf(
  items: StripItem[],
  fromHour: number,
  toHourExclusive: number,
): { left: number; width: number } | null {
  let first = -1;
  let last = -1;
  items.forEach((item, i) => {
    if (item.kind !== 'hour' || item.hour.hour < fromHour || item.hour.hour >= toHourExclusive) {
      return;
    }
    if (first === -1) first = i;
    last = i;
  });
  if (first === -1) return null;
  return { left: first * CELL_W, width: (last - first + 1) * CELL_W };
}
