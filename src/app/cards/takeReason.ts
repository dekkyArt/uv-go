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
      return { value: peakUv(), detail: `Needed from UV ${r.sunscreenUv}` };
    case 'hat-sunglasses':
      return { value: peakUv(), detail: `Needed from UV ${r.hatUv}` };
    case 'rain-jacket':
      return {
        value: show(
          extreme(window, (h) => h.rainProb, Math.max),
          (n) => `${n}%`,
        ),
        detail: `Needed from ${r.rainJacket}% rain`,
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
        detail: `Needed when active or from ${r.waterFeelsLike}°`,
      };
    case 'warm-layer':
      return {
        value: show(
          extreme(window, (h) => h.feelsLike, Math.min),
          (n) => `${n}°`,
        ),
        detail: `Needed below ${r.warmLayerBelow}°`,
      };
  }
}
