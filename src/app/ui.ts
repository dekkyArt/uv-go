import { rules } from '../domain/rules.config';
import type { Activity, ChecklistId, DurationMin, Factor, Verdict } from '../domain/types';

const pad = (n: number) => String(n).padStart(2, '0');

/** 'HH:00' for an hour of the day (24 is allowed for the end of a free-time range). */
export function formatHour(hour: number): string {
  return `${pad(hour)}:00`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-11-02' → '2 Nov'; null for anything but a calendar date, so the caller can leave it out. */
export function formatShortDate(date: string): string | null {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const month = MONTHS[Number(m[1]) - 1];
  const day = Number(m[2]);
  return month && day >= 1 && day <= 31 ? `${day} ${month}` : null;
}

/** Marks UI that must not count as an "outside tap" for HourDetails. */
export const KEEP_DETAILS_ATTR = 'data-keep-hour-details';

/** Width in px of one cell of the Hourly strip (hour or sun event). */
export const CELL_W = 56;

/** Height in px of one row of the Your free time table. */
export const ROW_H = 44;

/** Let Plan determine the desktop grid row height, including while the cards are loading. */
export const FREE_TIME_DESKTOP_CLASS = 'lg:[contain:size] lg:self-stretch';

/** A score at or above this fills the whole bar of the Your free time table. */
export const SCORE_BAR_MAX = 8;

/** Shown when the browser can't give a position (denied, timed out or unavailable). */
export const GEO_ERROR = "Can't get your location. Search for a city instead.";

export const DAY_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
] as const;

/**
 * Card bodies slide under the pinned hero bar by a scroll-bound `clip-path` (spec 5.4). Turn off if
 * scrolling measures below 50 fps on a device: only the sticky headers are left.
 */
export const CARD_TUCK_CLIP = true;

/** Height in px the bottom toolbar occupies: 48 px buttons plus 12 px above and below. */
export const TOOLBAR_H = 72;

/** Height in px of the tallest card header stuck under the pinned bar (Hourly: title, day and date, subtitle). */
export const STUCK_HEADER_H = 72;

/** The day's cards, which change with the Today | Tomorrow switch (and the swipe on a phone). */
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

/**
 * Short verdict for table rows; the full text goes in `verdictLabel`. Verdict words are white: the
 * colour is carried by the dot next to them (green and red text fall short of 4.5:1 on glass).
 */
export const VERDICT_SHORT: Record<Verdict, string> = { green: 'Good', yellow: 'OK', red: 'Avoid' };

/** Full class names so Tailwind can see them. */
export const VERDICT_FILL_CLASS: Record<Verdict | 'night', string> = {
  green: 'bg-verdict-green',
  yellow: 'bg-verdict-yellow',
  red: 'bg-verdict-red',
  night: 'bg-night',
};

/**
 * What to take pills: a bright, opaque badge per item, the icon dark on it. The colour is what sets
 * the pills apart from the cards; the icons are decorative (the label is the text), and
 * textContrast.test.ts holds each pairing at 3:1, the non-text minimum. The empty pill's badge is
 * the verdict green (--uv-verdict-green).
 */
export const TAKE_BADGE_CLASS: Record<ChecklistId | 'none', string> = {
  sunscreen: 'bg-[#ffb340]',
  'hat-sunglasses': 'bg-[#ffd60a]',
  'rain-jacket': 'bg-[#64d2ff]',
  water: 'bg-[#9cc4ff]',
  'warm-layer': 'bg-[#ff9f7a]',
  none: 'bg-[#4cd964]',
};
/** The icon on a What to take badge: the night sky's navy (--uv-bg). */
export const TAKE_ICON_CLASS = 'text-[#0b1530]';

/*
 * Coloured text and the plates text sits on. White and secondary text on bare glass are proven by
 * glassFor; src/app/__tests__/textContrast.test.ts proves every pairing below at 4.5:1 over the
 * worst-case sky. Text on a plate is full white: the secondary colour holds AA only on bare glass.
 */

/** Chance of rain: the lightest step of the iOS rain blue #64d2ff that holds 4.5:1 on any glass. */
export const RAIN_TEXT_CLASS = 'text-[#8bddff]';

/** A lighter inset on glass: How it works steps and their numbers, the article TL;DR. */
export const INSET_CLASS = 'bg-white/8';

/** Under the free hours of the Hourly strip (spec 4.3). */
export const FREE_BAND_CLASS = 'bg-white/[0.08]';

/** Under the selected hour of the Hourly strip; it can sit on the free band as well. */
export const SELECTED_CELL_CLASS = 'bg-white/[0.08]';

/** The hero's buttons use the contrast-tested glass surface even on a bright sky. */
export const BUTTON_CLASS =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text hover:bg-surface';

/**
 * The hero's Cities pin on desktop, next to the chosen place: just the icon, a step dimmer than the
 * white around it and with no plate, until a hover or focus washes a circle in behind it. The face
 * is 36 px; the `before` box grows the touch target back to 44 px.
 */
export const HERO_PIN_BUTTON_CLASS =
  "relative flex size-9 shrink-0 items-center justify-center rounded-full text-white/75 before:absolute before:-inset-1 before:content-[''] hover:bg-white/10 hover:text-text focus-visible:bg-white/10 focus-visible:text-text";

/** A round glass icon button: the toolbar's Plan and Cities. */
export const ROUND_BUTTON_CLASS =
  'glass flex shrink-0 items-center justify-center rounded-full text-text';

/** Full-width buttons inside a sheet. */
export const SHEET_BUTTON_CLASS =
  'inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-white/15 bg-white/10 px-4 text-base font-medium text-white hover:bg-white/15 disabled:opacity-60';

/** The city search field in the Cities sheet. */
export const SEARCH_INPUT_CLASS =
  'min-h-11 w-full rounded-xl border border-white/15 bg-black/10 px-3 text-base text-white placeholder:text-text-muted';

/** The highlighted option of the city search list (glass inside the sheet's glass). */
export const OPTION_ACTIVE_CLASS = 'bg-white/15';

/** Segmented control: the selected segment's pill and text, an unselected segment. */
export const SEGMENT_PILL_CLASS = 'bg-white/90';
export const SEGMENT_ON_CLASS = 'text-black/85';
export const SEGMENT_OFF_CLASS = 'text-text hover:bg-white/10';

/** The white pill link of the article and 404 pages, on their glass. */
export const CTA_CLASS =
  'inline-flex min-h-11 items-center rounded-full bg-white px-5 font-bold text-black/85 hover:bg-white/90';
