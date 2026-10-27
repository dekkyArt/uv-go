import { durations } from './tokens';

/** Seconds from the moment the result is on screen (ТЗ 10.3). */
export const firstResult = {
  /** The day arc draws itself. */
  arcDraw: 0.5,
  /** Gap between neighbouring hour cells growing in. */
  hourStagger: 0.015,
  /** The search frame starts sliding along the free time. */
  searchStart: 0.3,
  searchDuration: 0.35,
  /** The time label leaves the frame and flows into the card header. */
  labelHandoff: 0.65,
  /** The card body (badge colour, UV counter, checklist) starts to reveal. */
  cardReveal: 0.8,
  checklistStagger: 0.06,
};

type Choreography = typeof firstResult;

const HOURS_PER_DAY = 24;
/** The checklist never has more than one item per factor. */
const MAX_CHECKLIST_ITEMS = 5;

/** When the best time is fully readable in the card header (ТЗ 10.1: <= 1.0 s). */
export function labelVisibleAt(c: Choreography = firstResult): number {
  return c.labelHandoff + durations.base;
}

/** End of the whole choreography: the latest finishing step (ТЗ 10.1: <= 1.8 s). */
export function totalDuration(c: Choreography = firstResult): number {
  const cells = (HOURS_PER_DAY - 1) * c.hourStagger + durations.base;
  // The frame overshoots at the end of its slide and settles back within one base duration.
  const frame = c.searchStart + c.searchDuration + durations.base;
  const checklist = c.cardReveal + (MAX_CHECKLIST_ITEMS - 1) * c.checklistStagger + durations.base;
  return Math.max(c.arcDraw, cells, frame, labelVisibleAt(c), checklist);
}
