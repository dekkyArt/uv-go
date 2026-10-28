import { m, useReducedMotion } from 'motion/react';
import { firstResult } from '../../motion/choreography';
import { ease, springs } from '../../motion/tokens';

/** Fixed across the full track, so the colour at the end of the fill shows how heavy the hour is. */
const SCALE_GRADIENT = 'linear-gradient(to right, #4cd964, #ffd60a, #ff9f0a, #ff6961)';

const DOT = 8;

interface Props {
  /** Share of the track that is filled, 0 to 1. */
  fill: number;
  /** The current hour: a white dot sits at the end of the fill. */
  now: boolean;
  /** The first-result choreography is playing: the fill grows from the left. */
  intro: boolean;
  /** Seconds before this bar starts to grow. */
  delay: number;
  className?: string;
}

const clip = (fill: number) => `inset(0 ${(1 - fill) * 100}% 0 0 round 999px)`;

/**
 * Track plus a scale gradient laid over its full width. The fill is a mask over the gradient
 * (clip-path), not a shorter bar, so the gradient never squeezes; the intro grows the mask, not
 * the gradient. Decorative: the verdict text next to it carries the meaning.
 */
export function ScoreBar({ fill, now, intro, delay, className }: Props) {
  const reduced = useReducedMotion() ?? false;
  const play = intro && !reduced;
  const grow = { ...springs.smooth, duration: firstResult.barsDuration, delay };
  return (
    <div
      aria-hidden="true"
      data-score-bar=""
      data-fill={fill}
      className={className ? `relative h-2 w-full ${className}` : 'relative h-2 w-full'}
    >
      <div className="absolute inset-0 overflow-hidden rounded-full bg-white/[0.12]">
        <m.div
          data-bar-fill=""
          className="absolute inset-0"
          style={{ backgroundImage: SCALE_GRADIENT }}
          initial={play ? { clipPath: clip(0) } : false}
          animate={
            play
              ? { clipPath: [clip(0), clip(fill)], transition: grow }
              : { clipPath: clip(fill), transition: { duration: 0 } }
          }
        />
      </div>
      {now && (
        // The dot shows up as the fill reaches it.
        <m.span
          data-bar-now=""
          className="absolute top-0 rounded-full bg-white shadow-[0_0_0_1.5px_rgb(0_0_0/0.35)]"
          style={{ width: DOT, height: DOT, left: `calc((100% - ${DOT}px) * ${fill})` }}
          initial={play ? { opacity: 0 } : false}
          animate={
            play
              ? {
                  opacity: [0, 1],
                  transition: {
                    duration: firstResult.barsDuration / 2,
                    delay: delay + firstResult.barsDuration / 2,
                    ease,
                  },
                }
              : { opacity: 1 }
          }
        />
      )}
    </div>
  );
}
