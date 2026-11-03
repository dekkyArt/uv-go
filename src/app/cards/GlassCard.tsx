import { m, useReducedMotion } from 'motion/react';
import { type ReactNode, type Ref, useId, useImperativeHandle, useRef } from 'react';
import { cardDelay } from '../../motion/choreography';
import { durations, springs } from '../../motion/tokens';
import { CARD_TUCK_CLIP } from '../ui';
import { useCardTuck } from './useCardTuck';

interface GlassCardProps {
  title: string;
  subtitle?: string;
  /** Muted line under the title, above the subtitle (the Hourly card's day and date). */
  titleNote?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  cardRef?: Ref<HTMLElement>;
  /** The first-result choreography is playing: rise in after the cards before this one. */
  intro?: boolean;
  /** Place in the card order, for the intro stagger. */
  index?: number;
  /**
   * The card grows and shrinks with its content (spec 5.6: the hour details). Every child that
   * must not stretch on the way needs `layout` as well.
   */
  layout?: boolean;
  /**
   * Height in px of the pinned layers at the top (the hero bar, and the What to take strip under
   * it): the title row sticks right below them and the body slides under (spec 5.4). 0: none.
   */
  tuck?: number;
}

const RADIUS = 22;
const REST = { opacity: 1, y: 0 };

/**
 * Shared shell of the content cards: glass material, title row, padded body. The title row sticks
 * under the pinned layers only while they are there (`tuck`): elsewhere it has no background of its own
 * to hide the rows scrolling under it.
 */
export function GlassCard({
  title,
  subtitle,
  titleNote,
  action,
  children,
  className,
  cardRef,
  intro = false,
  index = 0,
  layout = false,
  tuck = 0,
}: GlassCardProps) {
  const titleId = `card-${useId().replace(/:/g, '')}`;
  const reduced = useReducedMotion() ?? false;
  const play = intro && !reduced;
  const animateLayout = layout && !reduced;
  const tucking = tuck > 0 && CARD_TUCK_CLIP;
  const ownRef = useRef<HTMLElement | null>(null);
  const clip = useCardTuck(ownRef, tucking ? tuck : 0);
  // The caller's ref and the tuck's own both point at the section.
  useImperativeHandle(cardRef, () => ownRef.current as HTMLElement);
  return (
    <m.section
      ref={ownRef}
      aria-labelledby={titleId}
      className={className ? `glass ${className}` : 'glass'}
      // The radius is repeated inline so the layout animation can keep the corners round.
      style={{
        ...(animateLayout ? { borderRadius: RADIUS } : null),
        ...(tucking ? { clipPath: clip.card } : null),
      }}
      layout={animateLayout}
      initial={play ? { opacity: 0, y: 16 } : false}
      // Every animated key stays in the target after the intro: a key left out would animate back
      // to `initial`.
      animate={
        play
          ? {
              opacity: [0, 1],
              y: [16, 0],
              transition: { ...springs.smooth, duration: durations.base, delay: cardDelay(index) },
            }
          : REST
      }
      transition={springs.smooth}
    >
      <m.header
        data-card-header
        layout={animateLayout}
        transition={springs.smooth}
        style={tuck > 0 ? { top: tuck } : undefined}
        className={`${tuck > 0 ? 'sticky z-10 ' : ''}flex items-start justify-between gap-3 px-4 pt-4`}
      >
        <div className="min-w-0">
          <h2 id={titleId} className="m-0 text-[15px] font-semibold leading-5 text-text">
            {title}
          </h2>
          {titleNote ? (
            <p
              data-card-title-note=""
              className="m-0 text-[13px] font-normal leading-[18px] text-text-muted"
            >
              {titleNote}
            </p>
          ) : null}
          {subtitle ? (
            <p className="m-0 text-[13px] font-normal leading-[18px] text-text-muted">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </m.header>
      <m.div
        data-card-body
        layout={animateLayout}
        transition={springs.smooth}
        className="p-4"
        style={tucking ? { clipPath: clip.body } : undefined}
      >
        {children}
      </m.div>
    </m.section>
  );
}
