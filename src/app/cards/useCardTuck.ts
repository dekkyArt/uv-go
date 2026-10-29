import { useMotionValue, useScroll, type MotionValue } from 'motion/react';
import { useEffect, type RefObject } from 'react';
import { COLLAPSED_H } from '../hero/useHeroCollapse';

/** Corner radius of the card; the clipped body keeps the same rounding. */
const RADIUS = 22;

/**
 * How many px of the body to cut from the top. The sticky header rests `collapsedH` below the
 * viewport top, so the body is hidden down to the header's bottom edge once the card top has
 * passed under the pinned bar. `cardTop` is the card's `getBoundingClientRect().top`.
 */
export function tuckInset(
  cardTop: number,
  headerH: number,
  collapsedH: number,
  bodyH: number,
): number {
  const overlap = collapsedH + headerH - (cardTop + headerH);
  return Math.min(bodyH, Math.max(0, overlap));
}

const clipFor = (inset: number) => `inset(${inset}px 0 0 0 round ${RADIUS}px)`;

/**
 * The `clip-path` of a card body, bound to the page scroll. Rects are read in the scroll
 * callback itself and written to a MotionValue, so scrolling re-renders nothing. Disabled
 * (desktop, no pinned bar), it subscribes to nothing.
 */
export function useCardTuck(
  cardRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): MotionValue<string> {
  const { scrollY } = useScroll();
  const clipPath = useMotionValue(clipFor(0));

  useEffect(() => {
    const card = cardRef.current;
    if (!enabled || card === null) return;
    const header = card.querySelector<HTMLElement>('[data-card-header]');
    const body = card.querySelector<HTMLElement>('[data-card-body]');
    if (header === null || body === null) return;
    const measure = () =>
      clipFor(
        tuckInset(
          card.getBoundingClientRect().top,
          header.offsetHeight,
          COLLAPSED_H,
          body.offsetHeight,
        ),
      );
    const update = () => clipPath.set(measure());
    // A page restored mid-scroll starts clipped right. The motion features load lazily, and an
    // element that mounts after this write would never render it, so it also goes straight on
    // the node.
    const first = measure();
    clipPath.set(first);
    body.style.clipPath = first;
    const off = scrollY.on('change', update);
    // The body grows and shrinks with the hour details; the clamp follows its height.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(body);
    return () => {
      off();
      observer?.disconnect();
    };
  }, [cardRef, enabled, scrollY, clipPath]);

  return clipPath;
}
