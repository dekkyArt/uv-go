import type { ChecklistId } from './types';

export const rules = {
  uv: {
    round: 'half-up',
    bands: [
      { min: 0, points: 0 },
      { min: 3, points: 2 },
      { min: 6, points: 4 },
      { min: 8, points: 6 },
    ],
    multiplier: { 'long-sun': 1.5 },
  },
  rain: {
    bands: [
      { min: 30, points: 2 },
      { min: 60, points: 5 },
    ],
  },
  heat: { min: 30, points: 3, pointsByActivity: { active: 5 } },
  cold: { below: 0, points: 2 },
  wind: { min: 40, points: 3 },
  verdict: {
    round: 'half-up',
    bands: [
      { min: 0, verdict: 'green' },
      { min: 3, verdict: 'yellow' },
      { min: 6, verdict: 'red' },
    ],
  },
  durationHours: { 30: 1, 60: 1, 120: 2, 180: 3 },
  reasonPriority: ['uv', 'rain', 'heat', 'wind', 'cold'],
  reasonTemplates: {
    // Picked by the last band whose `min` <= max rounded UV in the window.
    uv: [
      { min: 3, text: 'UV {uv}, use sunscreen' },
      { min: 6, text: 'UV {uv}, sunscreen and a hat' },
      { min: 8, text: 'UV {uv}, limit time in the sun' },
    ],
    rain: '{rain}% chance of rain',
    heat: 'Feels like {t}°C',
    cold: 'Feels like {t}°C',
    wind: 'Wind up to {w} km/h',
    none: 'No points from available forecast data',
  },
  checklist: { sunscreenUv: 3, hatUv: 6, rainJacket: 30, waterFeelsLike: 25, warmLayerBelow: 5 },
  checklistLabels: {
    sunscreen: 'Sunscreen',
    'hat-sunglasses': 'Hat & sunglasses',
    'rain-jacket': 'Rain jacket',
    water: 'Water',
    'warm-layer': 'Warm layer',
  } satisfies Record<ChecklistId, string>,
  emptyChecklistText: 'No extra items suggested.',
  verdictLabels: { green: 'Good', yellow: 'OK with protection', red: 'Not recommended' },
} as const;
