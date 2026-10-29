import { useScroll, useTransform, type MotionValue } from 'motion/react';

/** Scroll distance over which the hero folds into the pinned bar (spec 5.3). */
export const COLLAPSE_DISTANCE = 140;
/** Height of the pinned bar; the sticky card headers sit below it. */
export const COLLAPSED_H = 56;

const TIME_SCALE_MIN = 0.38;
/** How far the big time rises by the end of the collapse. */
const TIME_RISE = 32;
const DETAILS_GONE_AT = 60;
const EYEBROW_GONE_AT = 100;
const BAR_FROM = 100;

/** 0 at `from`, 1 at `to`, clamped outside. */
function progress(y: number, from: number, to: number): number {
  return Math.min(1, Math.max(0, (y - from) / (to - from)));
}

export interface CollapseStyles {
  timeScale: number;
  timeY: number;
  detailsOpacity: number;
  eyebrowOpacity: number;
  barOpacity: number;
}

/** The collapse as a pure function of the scroll position, with no springs in between. */
export function collapseStyles(y: number): CollapseStyles {
  const whole = progress(y, 0, COLLAPSE_DISTANCE);
  return {
    timeScale: 1 - (1 - TIME_SCALE_MIN) * whole,
    timeY: 0 - TIME_RISE * whole,
    detailsOpacity: 1 - progress(y, 0, DETAILS_GONE_AT),
    eyebrowOpacity: 1 - progress(y, 0, EYEBROW_GONE_AT),
    barOpacity: progress(y, BAR_FROM, COLLAPSE_DISTANCE),
  };
}

export type HeroCollapse = Record<keyof CollapseStyles, MotionValue<number>>;

/**
 * Scroll-bound values for the hero and the pinned bar. Disabled (desktop), the values stay at the
 * rest position, so the same markup renders with nothing folded. Reduced motion does not turn
 * this off: the scroll drives it, and it has no blur.
 */
export function useHeroCollapse(enabled: boolean): HeroCollapse {
  const { scrollY } = useScroll();
  const at = (y: number) => collapseStyles(enabled ? y : 0);
  return {
    timeScale: useTransform(scrollY, (y) => at(y).timeScale),
    timeY: useTransform(scrollY, (y) => at(y).timeY),
    detailsOpacity: useTransform(scrollY, (y) => at(y).detailsOpacity),
    eyebrowOpacity: useTransform(scrollY, (y) => at(y).eyebrowOpacity),
    barOpacity: useTransform(scrollY, (y) => at(y).barOpacity),
  };
}
