import { m, useReducedMotion } from 'motion/react';
import { type ReactNode, type Ref, useId } from 'react';
import { cardDelay } from '../../motion/choreography';
import { durations, springs } from '../../motion/tokens';

interface GlassCardProps {
  title: string;
  subtitle?: string;
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
}

const RADIUS = 22;
const REST = { opacity: 1, y: 0 };

/** Shared shell of the content cards: glass material, sticky title row, padded body. */
export function GlassCard({
  title,
  subtitle,
  action,
  children,
  className,
  cardRef,
  intro = false,
  index = 0,
  layout = false,
}: GlassCardProps) {
  const titleId = `card-${useId().replace(/:/g, '')}`;
  const reduced = useReducedMotion() ?? false;
  const play = intro && !reduced;
  const animateLayout = layout && !reduced;
  return (
    <m.section
      ref={cardRef}
      aria-labelledby={titleId}
      className={className ? `glass ${className}` : 'glass'}
      // The radius is repeated inline so the layout animation can keep the corners round.
      style={animateLayout ? { borderRadius: RADIUS } : undefined}
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
        className="sticky top-[var(--hero-collapsed-h,0px)] z-10 flex items-start justify-between gap-3 px-4 pt-4"
      >
        <div className="min-w-0">
          <h2 id={titleId} className="m-0 text-[15px] font-semibold leading-5 text-text">
            {title}
          </h2>
          {subtitle ? (
            <p className="m-0 text-[13px] font-normal leading-[18px] text-text-muted">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </m.header>
      <m.div data-card-body layout={animateLayout} transition={springs.smooth} className="p-4">
        {children}
      </m.div>
    </m.section>
  );
}
