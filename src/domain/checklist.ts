import { rules } from './rules.config';
import { roundHalfUp } from './scoring';
import type { Activity, ChecklistId, ChecklistItem, Rules, TimeWindow } from './types';

function present(values: readonly (number | null)[]): number[] {
  return values.filter((v): v is number => v !== null);
}

export function buildChecklist(
  w: TimeWindow,
  activity: Activity,
  r: Rules = rules,
): ChecklistItem[] {
  const uvs = present(w.hours.map((h) => (h.uv === null ? null : roundHalfUp(h.uv))));
  const rains = present(w.hours.map((h) => h.rainProb));
  const feels = present(w.hours.map((h) => h.feelsLike));

  const maxUv = uvs.length > 0 ? Math.max(...uvs) : null;
  const maxRain = rains.length > 0 ? Math.max(...rains) : null;
  const maxFeels = feels.length > 0 ? Math.max(...feels) : null;
  const minFeels = feels.length > 0 ? Math.min(...feels) : null;
  const c = r.checklist;

  // Order is the fixed ТЗ 6.6 order (ChecklistId order).
  const checks: [ChecklistId, boolean][] = [
    ['sunscreen', maxUv !== null && maxUv >= c.sunscreenUv],
    ['hat-sunglasses', maxUv !== null && maxUv >= c.hatUv],
    ['rain-jacket', maxRain !== null && maxRain >= c.rainJacket],
    ['water', activity === 'active' || (maxFeels !== null && maxFeels >= c.waterFeelsLike)],
    ['warm-layer', minFeels !== null && minFeels < c.warmLayerBelow],
  ];

  return checks
    .filter(([, needed]) => needed)
    .map(([id]) => ({ id, label: r.checklistLabels[id] }));
}
