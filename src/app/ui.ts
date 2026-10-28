import { rules } from '../domain/rules.config';
import type { Activity, DurationMin, Factor, Verdict } from '../domain/types';

const pad = (n: number) => String(n).padStart(2, '0');

/** 'HH:00' for an hour of the day (24 is allowed for the end of a free-time range). */
export function formatHour(hour: number): string {
  return `${pad(hour)}:00`;
}

/** Marks UI that must not count as an "outside tap" for HourDetails. */
export const KEEP_DETAILS_ATTR = 'data-keep-hour-details';

/** Width in px of one cell of the Hourly strip (hour or sun event). */
export const CELL_W = 56;

/** Height in px of one row of the Your free time table. */
export const ROW_H = 44;

/** A score at or above this fills the whole bar of the Your free time table. */
export const SCORE_BAR_MAX = 8;

/** Shown when the browser can't give a position (denied, timed out or unavailable). */
export const GEO_ERROR = "Can't get your location. Search a city instead.";

export const DAY_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
] as const;

/** Height in px the bottom toolbar occupies: 48 px buttons plus 12 px above and below. */
export const TOOLBAR_H = 72;

/** The Today/Tomorrow tabpanel, which the day dots control. */
export const DAY_PANEL_ID = 'day-panel';

export const DURATION_OPTIONS: { value: DurationMin; label: string }[] = [
  { value: 30, label: '30 min' },
  { value: 60, label: '1 h' },
  { value: 120, label: '2 h' },
  { value: 180, label: '3 h' },
];

export const ACTIVITY_OPTIONS: { value: Activity; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'relaxed', label: 'Relaxed' },
  { value: 'long-sun', label: 'Long in the sun' },
];

export function durationLabel(duration: DurationMin): string {
  return DURATION_OPTIONS.find((o) => o.value === duration)?.label ?? `${duration} min`;
}

export function activityLabel(activity: Activity): string {
  return ACTIVITY_OPTIONS.find((o) => o.value === activity)?.label ?? activity;
}

export const FACTOR_LABELS: Record<Factor, string> = {
  uv: 'UV',
  rain: 'Rain',
  heat: 'Heat',
  cold: 'Cold',
  wind: 'Wind',
};

export const FACTORS: readonly Factor[] = ['uv', 'rain', 'heat', 'cold', 'wind'];

export function verdictLabel(verdict: Verdict): string {
  return rules.verdictLabels[verdict];
}

/** Short verdict for table rows; the full text goes in `verdictLabel`. */
export const VERDICT_SHORT: Record<Verdict, string> = { green: 'Good', yellow: 'OK', red: 'Avoid' };

/** Full class names so Tailwind can see them. */
export const VERDICT_TEXT_CLASS: Record<Verdict, string> = {
  green: 'text-verdict-green-text',
  yellow: 'text-verdict-yellow-text',
  red: 'text-verdict-red-text',
};

export const VERDICT_FILL_CLASS: Record<Verdict | 'night', string> = {
  green: 'bg-verdict-green',
  yellow: 'bg-verdict-yellow',
  red: 'bg-verdict-red',
  night: 'bg-night',
};

export const BUTTON_CLASS =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border bg-surface-strong px-4 text-sm font-medium text-text hover:bg-surface';
