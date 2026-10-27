import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import type { Verdict } from '../../domain/types';
import { durations, springs } from '../../motion/tokens';
import { VERDICT_FILL_CLASS } from '../ui';

interface Props {
  verdict: Verdict;
  /** Neutral grey badge, before the card has revealed its verdict colour. */
  neutral?: boolean;
}

const CLOUD = 'M7 20a4 4 0 0 1-.3-8 5.5 5.5 0 0 1 10.6 1.4A3.3 3.3 0 0 1 17 20z';

/** Sun for good, cloud with sun for OK with protection, rain for not recommended. */
function Glyph({ verdict }: { verdict: Verdict }) {
  if (verdict === 'green') {
    return (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
      </>
    );
  }
  if (verdict === 'yellow') {
    return (
      <>
        <circle cx="8" cy="8" r="2.6" />
        <path d="M8 2.5v1M2.5 8h1M4.1 4.1l.7.7M11.9 4.1l-.7.7" />
        <path d={CLOUD} />
      </>
    );
  }
  return (
    <>
      <path d="M7 14.5a4 4 0 0 1-.3-8 5.5 5.5 0 0 1 10.6 1.4A3.3 3.3 0 0 1 17 14.5z" />
      <path d="M8.5 17.5l-1 2.5M12.5 17.5l-1 2.5M16.5 17.5l-1 2.5" />
    </>
  );
}

/**
 * Verdict badge. The icon swaps through AnimatePresence; the colour change is a CSS transition
 * (a small element, so animating a colour is allowed). The verdict is always icon plus text.
 */
export function VerdictIcon({ verdict, neutral = false }: Props) {
  const reduced = useReducedMotion() ?? false;
  return (
    <span
      aria-hidden="true"
      data-verdict-icon={verdict}
      className={`relative inline-flex size-7 shrink-0 items-center justify-center rounded-full transition-colors duration-300 motion-reduce:duration-150 ${
        neutral ? 'bg-surface-strong text-text' : `${VERDICT_FILL_CLASS[verdict]} text-bg`
      }`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <m.svg
          key={verdict}
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, transition: { duration: durations.fast } }}
          transition={reduced ? { duration: durations.fast } : springs.snappy}
        >
          <Glyph verdict={verdict} />
        </m.svg>
      </AnimatePresence>
    </span>
  );
}
