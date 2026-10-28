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

/** The title with its number, or a bare fallback when the window has no data for it. */
const titled = (value: number | null, title: (n: number) => string, fallback: string) =>
  value === null ? fallback : title(value);

/** The big line and the small explanation of one "What to take" tile, from the best window. */
export function tileReason(
  id: ChecklistId,
  window: TimeWindow,
  activity: Activity,
): { title: string; detail: string } {
  const r = rules.checklist;
  switch (id) {
    case 'sunscreen':
      return {
        title: titled(
          extreme(window, (h) => h.uv, Math.max),
          (n) => `UV up to ${n}`,
          'UV',
        ),
        detail: `Needed from UV ${r.sunscreenUv}`,
      };
    case 'hat-sunglasses':
      return {
        title: titled(
          extreme(window, (h) => h.uv, Math.max),
          (n) => `UV up to ${n}`,
          'UV',
        ),
        detail: `Needed from UV ${r.hatUv}`,
      };
    case 'rain-jacket':
      return {
        title: titled(
          extreme(window, (h) => h.rainProb, Math.max),
          (n) => `Rain up to ${n}%`,
          'Rain',
        ),
        detail: `Needed from ${r.rainJacket}% rain`,
      };
    case 'water':
      return {
        title:
          activity === 'active'
            ? 'Active plan'
            : titled(
                extreme(window, (h) => h.feelsLike, Math.max),
                (n) => `Feels up to ${n}°`,
                'Feels like',
              ),
        detail: `Needed when active or from ${r.waterFeelsLike}°`,
      };
    case 'warm-layer':
      return {
        title: titled(
          extreme(window, (h) => h.feelsLike, Math.min),
          (n) => `Feels down to ${n}°`,
          'Feels like',
        ),
        detail: `Needed below ${r.warmLayerBelow}°`,
      };
  }
}
