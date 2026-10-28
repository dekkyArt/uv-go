import { m, useReducedMotion } from 'motion/react';
import type { TargetAndTransition, Transition } from 'motion/react';
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { springs } from '../../../motion/tokens';

export interface IconProps {
  /** The item has just appeared: run the micro-animation once, on mount. */
  play: boolean;
  /** Seconds to wait before the micro-animation starts (the item is still entering). */
  delay?: number;
}

const Ctx = createContext({ go: false, delay: 0 });

/** Shared 32x32 line-icon frame; static unless `play` is set and motion is allowed. */
export function Frame({ play, delay = 0, children }: IconProps & { children: ReactNode }) {
  const reduced = useReducedMotion() ?? false;
  const go = play && !reduced;
  return (
    <svg
      data-testid="checklist-icon"
      data-play={go}
      aria-hidden="true"
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
    >
      <Ctx.Provider value={{ go, delay }}>{children}</Ctx.Provider>
    </svg>
  );
}

interface PartProps {
  from: TargetAndTransition;
  to: TargetAndTransition;
  /** transform-origin inside the part's own box. */
  at?: string;
  transition?: Transition;
  /** Extra stagger inside the icon, seconds. */
  after?: number;
  children: ReactNode;
}

/** One animated piece of an icon: only transform and opacity change. */
export function Part({
  from,
  to,
  at = '50% 50%',
  transition = springs.bouncy,
  after = 0,
  children,
}: PartProps) {
  const { go, delay } = useContext(Ctx);
  return (
    <m.g
      initial={go ? from : false}
      animate={go ? to : undefined}
      transition={{ ...transition, delay: delay + after }}
      style={{ transformBox: 'fill-box', transformOrigin: at }}
    >
      {children}
    </m.g>
  );
}
