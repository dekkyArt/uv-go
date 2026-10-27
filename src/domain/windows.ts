import { rules } from './rules.config';
import { verdictFor } from './scoring';
import type {
  DurationMin,
  EmptyReason,
  Inputs,
  NowLocal,
  Rules,
  ScoredHour,
  TimeWindow,
} from './types';

const MINUTES_PER_HOUR = 60;
const pad = (n: number) => String(n).padStart(2, '0');

export function windowLength(duration: DurationMin, r: Rules = rules): number {
  return r.durationHours[duration];
}

// Today's earliest allowed window start: now rounded up to a whole hour.
export function earliestStartHour(now: Pick<NowLocal, 'hour' | 'minute'> | null): number {
  if (now === null) return 0;
  return now.minute > 0 ? now.hour + 1 : now.hour;
}

export function formatWindowLabel(startHour: number, duration: DurationMin): string {
  const end =
    duration < MINUTES_PER_HOUR
      ? `${pad(startHour)}:${pad(duration)}`
      : `${pad(startHour + duration / MINUTES_PER_HOUR)}:00`;
  return `${pad(startHour)}:00–${end}`;
}

export function buildWindows(
  hours: ScoredHour[],
  inputs: Inputs,
  now: Pick<NowLocal, 'hour' | 'minute'> | null,
  r: Rules = rules,
): { windows: TimeWindow[]; emptyReason: EmptyReason | null } {
  const length = windowLength(inputs.duration, r);
  const { start, end } = inputs.freeTime;

  // W0: every window inside free time (end exclusive), ignoring darkness and "now".
  const w0: ScoredHour[][] = [];
  for (let s = start; s + length <= end; s++) {
    const slice = hours.slice(s, s + length);
    if (slice.length === length) w0.push(slice);
  }
  if (w0.length === 0) return { windows: [], emptyReason: 'too-short' };

  // W1: all hours are daylight.
  const w1 = w0.filter((w) => w.every((h) => h.isDay));
  if (w1.length === 0) return { windows: [], emptyReason: 'dark' };

  // W2: not before "now" rounded up.
  const earliest = earliestStartHour(now);
  const w2 = w1.filter((w) => w[0].hour >= earliest);
  if (w2.length === 0) return { windows: [], emptyReason: 'past' };

  const windows = w2.map((w): TimeWindow => {
    const score = w.reduce((sum, h) => sum + h.score, 0) / w.length;
    return {
      startHour: w[0].hour,
      hours: w,
      score,
      verdict: verdictFor(score, r),
      label: formatWindowLabel(w[0].hour, inputs.duration),
    };
  });
  return { windows, emptyReason: null };
}

const maxHourScore = (w: TimeWindow) => Math.max(...w.hours.map((h) => h.score));

export function pickBestWindow(windows: TimeWindow[]): TimeWindow | null {
  let best: TimeWindow | null = null;
  for (const w of windows) {
    if (best === null) {
      best = w;
      continue;
    }
    if (w.score !== best.score) {
      if (w.score < best.score) best = w;
    } else if (maxHourScore(w) !== maxHourScore(best)) {
      if (maxHourScore(w) < maxHourScore(best)) best = w;
    } else if (w.startHour < best.startHour) {
      best = w;
    }
  }
  return best;
}
