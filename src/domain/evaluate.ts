import { buildChecklist } from './checklist';
import { buildReason } from './reason';
import { rules } from './rules.config';
import { hourVerdict, scoreHour } from './scoring';
import type { DayForecast, EvaluationResult, Inputs, NowLocal, Rules, ScoredHour } from './types';
import { buildWindows, pickBestWindow } from './windows';

export function evaluate(
  day: DayForecast,
  inputs: Inputs,
  now: Pick<NowLocal, 'hour' | 'minute'> | null,
  r: Rules = rules,
): EvaluationResult {
  const { start, end } = inputs.freeTime;

  const scoredHours: ScoredHour[] = day.hours.map((hour) => {
    const { points, noData, score } = scoreHour(hour, inputs.activity, r);
    return {
      ...hour,
      points,
      noData,
      score,
      verdict: hourVerdict(hour, score, r),
      isPast: now !== null && hour.hour < now.hour,
      inFreeTime: hour.hour >= start && hour.hour < end,
    };
  });

  const { windows, emptyReason } = buildWindows(scoredHours, inputs, now, r);
  const best = pickBestWindow(windows);

  if (best === null) {
    return { scoredHours, best: null, emptyReason, reason: null, checklist: [] };
  }
  return {
    scoredHours,
    best,
    emptyReason: null,
    reason: buildReason(best, r),
    checklist: buildChecklist(best, inputs.activity, r),
  };
}
