import { m, useReducedMotion, useScroll } from 'motion/react';
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import type { ComponentType, ReactNode, RefObject } from 'react';
import { rules } from '../../domain/rules.config';
import type { Activity, ChecklistId, ChecklistItem, TimeWindow } from '../../domain/types';
import { chipDelay } from '../../motion/choreography';
import { durations, springs } from '../../motion/tokens';
import { HatSunglasses } from '../icons/checklist/HatSunglasses';
import { RainJacket } from '../icons/checklist/RainJacket';
import type { IconProps } from '../icons/checklist/shared';
import { Sunscreen } from '../icons/checklist/Sunscreen';
import { WarmLayer } from '../icons/checklist/WarmLayer';
import { Water } from '../icons/checklist/Water';
import { COLLAPSED_H } from '../hero/useHeroCollapse';
import { TAKE_BADGE_CLASS, TAKE_ICON_CLASS } from '../ui';
import { takeReason } from './takeReason';

interface Props {
  items: ChecklistItem[];
  /** The best window: the values are read from its hours. */
  window: TimeWindow;
  activity: Activity;
  /** The first-result choreography is playing: the pills pop in one after another. */
  intro: boolean;
}

type Size = 'full' | 'compact';

const ICONS: Record<ChecklistId, ComponentType<IconProps>> = {
  sunscreen: Sunscreen,
  'hat-sunglasses': HatSunglasses,
  'rain-jacket': RainJacket,
  water: Water,
  'warm-layer': WarmLayer,
};

/** One pill, 40 px tall: the loading reserve under the hero (UvGoApp) is one row of them. */
export const CHIP_H = 40;

/**
 * The strip the pills fold into under the pinned bar on a phone: one row of 32 px pills with 6 px
 * above and below. The cards tuck under its bottom edge instead of the bar's.
 */
export const STRIP_H = 44;
const COMPACT_CHIP_H = 32;
/** Where a pill's top sits in the strip: the pills on the page hand over on reaching it. */
export const STRIP_CHIP_TOP = COLLAPSED_H + (STRIP_H - COMPACT_CHIP_H) / 2;

/** A glass pill with a brighter rim than the cards; the strip's are smaller and never wrap. */
const CHIP_CLASS: Record<Size, string> = {
  full: 'glass flex h-10 min-w-0 items-center gap-2 rounded-full border-white/40 py-1.5 pl-1.5 pr-3.5 text-[15px] font-semibold leading-5 text-text',
  compact:
    'glass flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-white/40 py-1 pl-1 pr-3 text-[13px] font-semibold leading-4 text-text',
};
const BADGE_SIZE: Record<Size, string> = { full: 'size-7', compact: 'size-6' };

const REST = { opacity: 1, scale: 1 };

function Chip({
  size,
  badge,
  icon,
  order,
  intro,
  children,
}: {
  size: Size;
  badge: string;
  icon: ReactNode;
  order: number;
  intro: boolean;
  children: ReactNode;
}) {
  const reduced = useReducedMotion() ?? false;
  const play = intro && !reduced;
  return (
    <m.li
      initial={play ? { opacity: 0, scale: 0.94 } : false}
      animate={
        play
          ? {
              opacity: [0, 1],
              scale: [0.94, 1],
              transition: { ...springs.smooth, duration: durations.base, delay: chipDelay(order) },
            }
          : REST
      }
      className={CHIP_CLASS[size]}
    >
      <span
        aria-hidden="true"
        className={`grid ${BADGE_SIZE[size]} shrink-0 place-items-center rounded-full ${TAKE_ICON_CLASS} ${badge}`}
      >
        {icon}
      </span>
      <span className="min-w-0 truncate">{children}</span>
    </m.li>
  );
}

function Check() {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="M8 16.5l5.5 5.5L24 11" />
    </svg>
  );
}

/** The pills of a checklist; the reasons go to screen readers only, so the strip leaves them out. */
function Chips({ items, window, activity, intro, size }: Props & { size: Size }) {
  const reasons = size === 'full';
  if (items.length === 0) {
    return (
      <Chip size={size} badge={TAKE_BADGE_CLASS.none} icon={<Check />} order={0} intro={intro}>
        {rules.emptyChecklistText.replace(/\.$/, '')}
        {reasons && <span className="sr-only">.</span>}
      </Chip>
    );
  }
  return items.map((item, i) => {
    const Icon = ICONS[item.id];
    const { value, detail } = takeReason(item.id, window, activity);
    return (
      <Chip
        key={item.id}
        size={size}
        badge={TAKE_BADGE_CLASS[item.id]}
        icon={<Icon play={false} />}
        order={i}
        intro={intro}
      >
        {item.label}
        {value !== null && <span className="font-normal"> {value}</span>}
        {reasons && <span className="sr-only">. {detail}</span>}
      </Chip>
    );
  });
}

/** What to take, as pills under the hero's answer (spec 4.5). The reasons are read out only. */
export function TakeChips({
  sectionRef,
  folded = false,
  ...props
}: Props & {
  sectionRef?: RefObject<HTMLElement | null>;
  /** The pills have folded into the strip under the pinned bar: these fade out. */
  folded?: boolean;
}) {
  const headingId = `take-${useId().replace(/:/g, '')}`;
  return (
    <section
      ref={sectionRef}
      aria-labelledby={headingId}
      data-folded={folded || undefined}
      className={`w-full transition-opacity duration-150 ${folded ? 'opacity-0' : ''}`.trim()}
    >
      <h2 id={headingId} className="sr-only">
        What to take
      </h2>
      <ul className="m-0 flex list-none flex-wrap justify-center gap-2 p-0 lg:justify-start">
        <Chips {...props} size="full" />
      </ul>
    </section>
  );
}

/** Width of the fade at a scrollable edge of the strip. */
const FADE = 24;

/**
 * The strip's mask: an edge fades out only where there is more to scroll to, so a fade says
 * "swipe this way". `none` when everything fits.
 */
export function edgeMask(scrollLeft: number, clientWidth: number, scrollWidth: number): string {
  const before = scrollLeft > 0.5;
  const after = scrollLeft + clientWidth < scrollWidth - 0.5;
  if (!before && !after) return 'none';
  const start = before ? `transparent 0, #000 ${FADE}px` : '#000 0';
  const end = after ? `#000 calc(100% - ${FADE}px), transparent 100%` : '#000 100%';
  return `linear-gradient(to right, ${start}, ${end})`;
}

/**
 * The pills folded into one row under the pinned bar on a phone (spec 5.3), straight on the sky.
 * The row scrolls sideways when it does not fit. A copy for the eye only: the list on the page is
 * what assistive technology reads, as with the bar.
 */
export function TakeStrip({ shown, ...props }: Props & { shown: boolean }) {
  const reduced = useReducedMotion() ?? false;
  const listRef = useRef<HTMLUListElement>(null);
  const [mask, setMask] = useState('none');
  const update = useCallback(() => {
    const el = listRef.current;
    if (el) setMask(edgeMask(el.scrollLeft, el.clientWidth, el.scrollWidth));
  }, []);
  useEffect(() => {
    const el = listRef.current;
    if (el === null || typeof ResizeObserver === 'undefined') return;
    // Also fires once on observe, which sets the first mask.
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [update]);

  return (
    <m.div
      aria-hidden="true"
      data-take-strip=""
      initial={false}
      animate={
        shown
          ? { opacity: 1, scale: 1, transition: { duration: reduced ? 0 : durations.fast } }
          : { opacity: 0, scale: 0.96, transition: { duration: reduced ? 0 : durations.fast } }
      }
      style={{ top: COLLAPSED_H, height: STRIP_H, pointerEvents: shown ? 'auto' : 'none' }}
      className="fixed inset-x-0 z-20 flex origin-top items-center"
    >
      <ul
        ref={listRef}
        onScroll={update}
        style={{ maskImage: mask, WebkitMaskImage: mask }}
        className="m-0 flex w-full list-none flex-nowrap gap-2 overflow-x-auto px-4 py-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <Chips {...props} size="compact" intro={false} />
      </ul>
    </m.div>
  );
}

/**
 * The pills on the page have scrolled up to the strip under the pinned bar: from here the strip
 * shows them. Read from the layout on scroll; a re-render only when the answer flips.
 */
export function useTakeFolded(ref: RefObject<HTMLElement | null>, enabled: boolean): boolean {
  const { scrollY } = useScroll();
  const subscribe = useCallback(
    (onChange: () => void) => {
      const off = scrollY.on('change', onChange);
      window.addEventListener('resize', onChange);
      return () => {
        off();
        window.removeEventListener('resize', onChange);
      };
    },
    [scrollY],
  );
  const folded = useSyncExternalStore(
    subscribe,
    () => (ref.current?.getBoundingClientRect().top ?? Infinity) <= STRIP_CHIP_TOP,
    () => false,
  );
  return enabled && folded;
}
