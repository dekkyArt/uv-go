/** Fixed across the full track, so the colour at the end of the fill shows how heavy the hour is. */
const SCALE_GRADIENT = 'linear-gradient(to right, #4cd964, #ffd60a, #ff9f0a, #ff6961)';

const DOT = 8;

interface Props {
  /** Share of the track that is filled, 0 to 1. */
  fill: number;
  /** The current hour: a white dot sits at the end of the fill. */
  now: boolean;
  /** Reserved for the first-result choreography; the bar has no intro motion yet. */
  intro: boolean;
  delay: number;
  className?: string;
}

/**
 * Track plus a scale gradient laid over its full width. The fill is a mask over the gradient
 * (clip-path), not a shorter bar, so the gradient never squeezes. Decorative: the verdict text
 * next to it carries the meaning.
 */
export function ScoreBar({ fill, now, className }: Props) {
  return (
    <div
      aria-hidden="true"
      data-score-bar=""
      data-fill={fill}
      className={className ? `relative h-2 w-full ${className}` : 'relative h-2 w-full'}
    >
      <div className="absolute inset-0 overflow-hidden rounded-full bg-white/[0.12]">
        <div
          data-bar-fill=""
          className="absolute inset-0"
          style={{
            backgroundImage: SCALE_GRADIENT,
            clipPath: `inset(0 ${(1 - fill) * 100}% 0 0 round 999px)`,
          }}
        />
      </div>
      {now && (
        <span
          data-bar-now=""
          className="absolute top-0 rounded-full bg-white shadow-[0_0_0_1.5px_rgb(0_0_0/0.35)]"
          style={{ width: DOT, height: DOT, left: `calc((100% - ${DOT}px) * ${fill})` }}
        />
      )}
    </div>
  );
}
