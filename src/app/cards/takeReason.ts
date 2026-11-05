import { rules } from '../../domain/rules.config';
import { roundHalfUp } from '../../domain/scoring';
import type { Activity, ChecklistId, ScoredHour, TimeWindow } from '../../domain/types';

/** Largest / smallest rounded value of the window's hours, skipping hours without data. */
function extreme(
  window: TimeWindow,
  pick: (hour: ScoredHour) => number | null,
  fn: typeof Math.max | typeof Math.min,
): number | null {
  const values = window.hours.map(pick).filter((v): v is number => v !== null);
  return values.length === 0 ? null : roundHalfUp(fn(...values));
}

/** The short value on a "What to take" pill and the reason, read out to screen readers. */
export function takeReason(
  id: ChecklistId,
  window: TimeWindow,
  activity: Activity,
): { value: string | null; detail: string } {
  const r = rules.checklist;
  const show = (n: number | null, format: (n: number) => string) => (n === null ? null : format(n));
  const peakUv = () =>
    show(
      extreme(window, (h) => h.uv, Math.max),
      (n) => `UV ${n}`,
    );
  switch (id) {
    case 'sunscreen':
      return { value: peakUv(), detail: `Suggested from rounded UV ${r.sunscreenUv}` };
    case 'hat-sunglasses':
      return { value: peakUv(), detail: `Suggested from rounded UV ${r.hatUv}` };
    case 'rain-jacket':
      return {
        value: show(
          extreme(window, (h) => h.rainProb, Math.max),
          (n) => `${n}%`,
        ),
        detail: `Suggested from ${r.rainJacket}% chance of rain`,
      };
    case 'water':
      return {
        // An active plan is the reason itself: no number to show.
        value:
          activity === 'active'
            ? null
            : show(
                extreme(window, (h) => h.feelsLike, Math.max),
                (n) => `${n}°`,
              ),
        detail: `Suggested for Active or when it feels like ${r.waterFeelsLike}°C or more`,
      };
    case 'warm-layer':
      return {
        value: show(
          extreme(window, (h) => h.feelsLike, Math.min),
          (n) => `${n}°`,
        ),
        detail: `Suggested when it feels like below ${r.warmLayerBelow}°C`,
      };
  }
}
