import { m, useReducedMotion } from 'motion/react';
import { useId } from 'react';
import { durations, ease } from '../../motion/tokens';

const HORIZON_Y = 64;
const SUN = { x: 60, y: 64 };
const CORE_RADIUS = 14;
const RAYS = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);
const RAY_INNER = CORE_RADIUS + 5;
const RAY_OUTER = CORE_RADIUS + 11;
/** How far below its resting place the sun starts, hidden behind the horizon. */
const HIDDEN_OFFSET = 36;
/** Resting place: the sun's centre sits a little above the horizon, so its top peeks out. */
const PEEK_Y = -8;
const SWAY_DEG = 8;
const SWAY_SECONDS = 1.6;

function Sun() {
  return (
    <>
      <circle
        cx={SUN.x}
        cy={SUN.y}
        r={CORE_RADIUS}
        fill="var(--color-verdict-yellow)"
        stroke="var(--color-text)"
        strokeWidth="2"
      />
      {RAYS.map((angle) => (
        <line
          key={angle}
          x1={SUN.x + RAY_INNER * Math.cos(angle)}
          y1={SUN.y + RAY_INNER * Math.sin(angle)}
          x2={SUN.x + RAY_OUTER * Math.cos(angle)}
          y2={SUN.y + RAY_OUTER * Math.sin(angle)}
          stroke="var(--color-verdict-yellow)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      ))}
    </>
  );
}

/**
 * The sun peeks over the horizon and sways while the forecast loads (ТЗ 10.2). It rises once,
 * then rocks to and fro (transform only). With reduced motion it stands still, already risen.
 */
export function LoadingSun() {
  const reduced = useReducedMotion() ?? false;
  const clip = `loading-sun-${useId().replace(/:/g, '')}`;
  return (
    <svg
      data-loading-sun=""
      viewBox="0 0 120 80"
      aria-hidden="true"
      className="h-auto w-40 max-w-full"
    >
      <clipPath id={clip}>
        <rect x="0" y="0" width="120" height={HORIZON_Y} />
      </clipPath>
      <line
        x1="8"
        y1={HORIZON_Y}
        x2="112"
        y2={HORIZON_Y}
        stroke="var(--color-border)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <g clipPath={`url(#${clip})`}>
        {reduced ? (
          <g transform={`translate(0 ${PEEK_Y})`}>
            <Sun />
          </g>
        ) : (
          <m.g
            data-sun-motion=""
            initial={{ y: HIDDEN_OFFSET }}
            animate={{ y: PEEK_Y, transition: { duration: durations.slow, ease } }}
          >
            <m.g
              initial={{ rotate: -SWAY_DEG }}
              animate={{
                rotate: SWAY_DEG,
                transition: {
                  duration: SWAY_SECONDS,
                  ease: 'easeInOut',
                  repeat: Infinity,
                  repeatType: 'mirror',
                },
              }}
            >
              <Sun />
            </m.g>
          </m.g>
        )}
      </g>
    </svg>
  );
}
