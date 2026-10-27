import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import type { Verdict } from '../../domain/types';
import { durations, springs } from '../../motion/tokens';
import { VerdictIcon } from '../icons/VerdictIcon';
import { verdictLabel } from '../ui';

interface Props {
  label: string;
  verdict: Verdict;
  visible: boolean;
  onClick(): void;
}

/**
 * Sticky pill with the answer, shown while the result card is scrolled out of view. It is a
 * fixed overlay, so it never takes part in the page flow (no layout shift).
 */
export function MiniResult({ label, verdict, visible, onClick }: Props) {
  const reduced = useReducedMotion() ?? false;
  return (
    <AnimatePresence>
      {visible && (
        <m.div
          key="mini-result"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: -48 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -48 }}
          transition={reduced ? { duration: durations.fast } : springs.snappy}
          className="pointer-events-none fixed inset-x-0 top-2 z-30 flex justify-center px-4"
        >
          <button
            type="button"
            onClick={onClick}
            className="pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface py-1 pr-4 pl-2 text-sm font-semibold text-text shadow-lg"
          >
            <VerdictIcon verdict={verdict} />
            {`${label} · ${verdictLabel(verdict)}`}
          </button>
        </m.div>
      )}
    </AnimatePresence>
  );
}
