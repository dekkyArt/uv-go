import { durations, springs } from './tokens';

/** Seconds from the moment the first result is on screen (spec 5.2). */
export const firstResult = {
  /** The best time in the hero: blur, rise and fade in; the verdict line follows. */
  heroIn: 0.05,
  heroInDuration: 0.3,
  verdictLag: 0.06,
  /** The cards rise in one after another. */
  cardsIn: 0.25,
  cardStagger: 0.07,
  /** The hour strip scrolls itself to "Now" or the free time. */
  hourScroll: 0.45,
  /** The best-window outline draws along its path. */
  bestOutline: 0.45,
  bestOutlineDuration: 0.35,
  /** The score bars grow from the left; the stagger is capped, however many rows there are. */
  barsGrow: 0.6,
  barsDuration: 0.4,
  barStagger: 0.03,
  barStaggerMax: 0.2,
  /** The What to take pills pop in under the hero. */
  chipsIn: 0.7,
  chipStagger: 0.05,
};

type Choreography = typeof firstResult;

/** The most staggered cards (room for four) and What to take pills (five items) on the page. */
const MAX_CARDS = 4;
const MAX_CHIPS = 5;
const MAX_ROWS = 24;

export function cardDelay(index: number, c: Choreography = firstResult): number {
  return c.cardsIn + index * c.cardStagger;
}

export function barDelay(index: number, c: Choreography = firstResult): number {
  return c.barsGrow + Math.min(index * c.barStagger, c.barStaggerMax);
}

export function chipDelay(index: number, c: Choreography = firstResult): number {
  return c.chipsIn + index * c.chipStagger;
}

/** When the best time is fully readable in the hero (spec 5.2: <= 1.0 s). */
export function labelVisibleAt(c: Choreography = firstResult): number {
  return c.heroIn + c.heroInDuration;
}

/** End of the whole choreography: the latest finishing step (spec 5.2: <= 1.8 s). */
export function totalDuration(c: Choreography = firstResult): number {
  return Math.max(
    c.heroIn + c.verdictLag + c.heroInDuration,
    cardDelay(MAX_CARDS - 1, c) + durations.base,
    c.hourScroll + springs.smooth.duration,
    c.bestOutline + c.bestOutlineDuration,
    barDelay(MAX_ROWS - 1, c) + c.barsDuration,
    chipDelay(MAX_CHIPS - 1, c) + durations.base,
  );
}
