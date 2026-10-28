import type { EvaluationResult, NowLocal } from '../../domain/types';
import type { AppState } from '../state';
import type { HeroState } from './Hero';
import { nowLine } from './heroText';

/** Which of the hero's states (spec 4.8) the app is in, with the data that state shows. */
export function heroState(
  state: AppState,
  evaluation: EvaluationResult | null,
  now: NowLocal | null,
): HeroState {
  const { place, inputs } = state;
  if (place === null) return { kind: 'no-place' };
  if (state.forecast.status === 'error') return { kind: 'error', place };
  if (evaluation === null) return { kind: 'loading', place };
  if (evaluation.best === null) {
    // evaluate() always names a reason when there is no window; 'past' is only a type fallback.
    return {
      kind: 'empty',
      place,
      reason: evaluation.emptyReason ?? 'past',
      duration: inputs.duration,
    };
  }
  return {
    kind: 'result',
    place,
    best: evaluation.best,
    reason: evaluation.reason,
    duration: inputs.duration,
    nowLine: nowLine(evaluation.scoredHours, inputs.day, now),
  };
}
