import type { ScoredHour, TimeWindow } from '../../domain/types';
import { SCORE_BAR_MAX } from '../ui';

export interface FreeTimeRow {
  hour: ScoredHour;
  /** The hour belongs to the best window. */
  best: boolean;
  /** The current hour of the shown day. */
  now: boolean;
  /** A night hour: a moon and "Dark" instead of a score bar. */
  dark: boolean;
  /** Share of the score bar that is filled, 0 to 1. */
  fill: number;
}

/** One row per hour in [freeTime.start, freeTime.end). */
export function freeTimeRows(
  hours: ScoredHour[],
  freeTime: { start: number; end: number },
  best: TimeWindow | null,
  nowHour: number | null,
): FreeTimeRow[] {
  const bestEnd = best ? best.startHour + best.hours.length : 0;
  return hours
    .filter((h) => h.hour >= freeTime.start && h.hour < freeTime.end)
    .map((hour) => ({
      hour,
      best: best !== null && hour.hour >= best.startHour && hour.hour < bestEnd,
      now: hour.hour === nowHour,
      dark: hour.verdict === 'night',
      fill: Math.max(0, Math.min(hour.score, SCORE_BAR_MAX)) / SCORE_BAR_MAX,
    }));
}
