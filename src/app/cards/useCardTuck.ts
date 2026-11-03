import { useMotionValue, useScroll, type MotionValue } from 'motion/react';
import { useEffect, type RefObject } from 'react';

/** Corner radius of the card; the clipped body keeps the same rounding. */
const RADIUS = 22;

/**
 * How many px of the body to cut from the top. The sticky header rests `pinnedH` below the
 * viewport top (the pinned bar, and the What to take strip under it when there is one), so the
 * body is hidden down to the header's bottom edge once the card top has passed that line.
 * `cardTop` is the card's `getBoundingClientRect().top`.
 */
export function tuckInset(
  cardTop: number,
  headerH: number,
  pinnedH: number,
  bodyH: number,
): number {
  const overlap = pinnedH + headerH - (cardTop + headerH);
  return Math.min(bodyH, Math.max(0, overlap));
}

const clipFor = (inset: number) => `inset(${inset}px 0 0 0 round ${RADIUS}px)`;
/**
 * The card is cut at the line itself, with no clamp: a title row pushed up by its card's bottom
 * goes under the line too, not behind the strip's pills. Only once the card reaches the line, so
 * nothing (a focus ring) is clipped at rest.
 */
const cardClipFor = (cardTop: number, pinned: number) =>
  cardTop < pinned ? clipFor(pinned - cardTop) : 'none';

/**
 * The card's top where layout puts it, without the vertical shift of its own transform (the
 * first-result rise). Measured with the shift, a scroll during the rise would leave the clips that
 * many px off once the rise ends, with no scroll to correct them.
 */
function layoutTop(card: HTMLElement): number {
  const { transform } = getComputedStyle(card);
  const shift =
    transform && transform !== 'none' && typeof DOMMatrix !== 'undefined'
      ? new DOMMatrix(transform).m42
      : 0;
  return card.getBoundingClientRect().top - shift;
}

export interface CardTuck {
  /** The body's clip: hidden down to the stuck header's bottom edge. */
  body: MotionValue<string>;
  /** The card's clip: its glass never shows above the line, behind the strip's pills. */
  card: MotionValue<string>;
}

/**
 * The `clip-path`s of a card and its body, bound to the page scroll. `pinned` is the height of
 * the fixed layers at the top (0: none, nothing tucks). Rects are read in the scroll callback
 * itself and written to MotionValues, so scrolling re-renders nothing. Disabled (desktop, no
 * pinned bar), it measures and listens to nothing, and leaves no clip behind.
 */
export function useCardTuck(cardRef: RefObject<HTMLElement | null>, pinned: number): CardTuck {
  const { scrollY } = useScroll();
  const clipPath = useMotionValue(clipFor(0));
  const cardClip = useMotionValue('none');

  useEffect(() => {
    const card = cardRef.current;
    if (pinned <= 0 || card === null) return;
    const header = card.querySelector<HTMLElement>('[data-card-header]');
    const body = card.querySelector<HTMLElement>('[data-card-body]');
    if (header === null || body === null) return;
    const measure = () => {
      const top = layoutTop(card);
      return {
        body: clipFor(tuckInset(top, header.offsetHeight, pinned, body.offsetHeight)),
        card: cardClipFor(top, pinned),
      };
    };
    const update = () => {
      const clips = measure();
      clipPath.set(clips.body);
      cardClip.set(clips.card);
    };
    // A page restored mid-scroll starts clipped right. The motion features load lazily, and an
    // element that mounts after this write would never render it, so it also goes straight on
    // the node.
    const first = measure();
    clipPath.set(first.body);
    cardClip.set(first.card);
    body.style.clipPath = first.body;
    card.style.clipPath = first.card;
    const off = scrollY.on('change', update);
    // The body grows and shrinks with the hour details; the clamp follows its height.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(body);
    return () => {
      off();
      observer?.disconnect();
      // Motion leaves its last render on the node when the style prop goes away.
      clipPath.set(clipFor(0));
      cardClip.set('none');
      body.style.clipPath = '';
      card.style.clipPath = '';
    };
  }, [cardRef, pinned, scrollY, clipPath, cardClip]);

  return { body: clipPath, card: cardClip };
}
