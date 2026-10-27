import { rules } from '../domain/rules.config';
import type { Activity, DurationMin, Factor, Verdict } from '../domain/types';

const pad = (n: number) => String(n).padStart(2, '0');

/** 'HH:00' for an hour of the day (24 is allowed for the end of a free-time range). */
export function formatHour(hour: number): string {
  return `${pad(hour)}:00`;
}

export const DAY_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
] as const;

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

/**
 * Result, empty, error and loading cards fill the card container (CARD_SLOT_CLASS), so a state
 * change never moves the layout below them.
 */
export const CARD_CLASS = 'flex-1 rounded-2xl border border-border bg-surface p-5';

/**
 * Card container, 26rem (416 px) at the smallest width. The tallest card is the result with a
 * five-item checklist wrapped to three rows (details closed): 42 border and padding + 60 header
 * + 28 verdict row + 48 two-line reason + 44 "Why this time?" + 20 title, 4 gap and 3 x 28 + 2 x 8
 * pills = 124, plus four 16 gaps = 410. Wider screens only get shorter content. The auto-switch
 * notice (up to two 20 px lines + 16 padding, 12 gap) sits under the card inside this container, so
 * it takes room from the card's slack, not from the page.
 */
export const CARD_SLOT_CLASS = 'flex min-h-[26rem] flex-col gap-3';

/**
 * Hour strip: 44 cells, 8 gap, 6 free-time bar, 4 gap, 16 hour labels = 78, then a 4 gap, 4
 * margin and the legend. The legend wraps to two 16 px rows below 495 px (measured in the e2e
 * pass: two rows at 390 to 493 px, one row from 495 px): 78 + 8 + 36 = 122 px, otherwise 102 px.
 * The breakpoint is 32rem (512 px), a little above the measured one, because reserving too much
 * only leaves slack while reserving too little shifts the layout. The skeleton uses the same
 * heights.
 */
export const HOUR_STRIP_MIN_H_CLASS = 'min-h-[7.625rem] min-[32rem]:min-h-[6.375rem]';

/**
 * A translucent page-colour surface under text and graphics that would otherwise sit directly on
 * the sky (contrast AA over every phase: see the sky section of global.css). 16 px padding.
 */
export const PANEL_CLASS = 'sky-panel rounded-2xl p-4';

/**
 * Space held before hydration for the location block. First visit (no place): heading 32 + 12
 * gap + 124 search (button, 12 gap, input and message) = 168 px; 112 px from `sm`, where the
 * button sits next to the input. With a stored place (<html data-has-place>, set by an inline
 * script before first paint) the block is one 44 px row. Each block also carries the 32 px of
 * padding of its PANEL_CLASS surface.
 */
export const LOCATION_SKELETON_CLASS =
  'min-h-[12.5rem] sm:min-h-36 [[data-has-place]_&]:min-h-[4.75rem] lg:col-span-2';

/**
 * Space held before hydration for "Adjust your plan": heading 28, day control 52, free time
 * 20 + 4 + 84, duration and activity 20 + 4 + 52 each, four 16 gaps = 404 px, plus 32 of panel
 * padding.
 */
export const ADJUST_SKELETON_CLASS = 'min-h-[27.25rem] lg:col-start-1 lg:row-start-3';

export const BUTTON_CLASS =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border bg-surface-strong px-4 text-sm font-medium text-text hover:bg-surface';
