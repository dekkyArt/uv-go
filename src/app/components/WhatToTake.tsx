import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { rules } from '../../domain/rules.config';
import type { ChecklistItem } from '../../domain/types';
import { firstResult } from '../../motion/choreography';
import { durations, springs } from '../../motion/tokens';

interface Props {
  items: ChecklistItem[];
  /** First result: items appear one after another once the card reveals. */
  intro?: boolean;
}

export function WhatToTake({ items, intro = false }: Props) {
  const reduced = useReducedMotion() ?? false;
  const staggered = intro && !reduced;
  return (
    <div>
      <h3 className="text-sm font-semibold">What to take</h3>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-text-muted">{rules.emptyChecklistText}</p>
      ) : (
        <ul className="relative mt-1 flex flex-wrap gap-2">
          {/* Items present at the first render only animate in during the intro; items that
              appear after a recalculation always enter, and leaving ones exit. */}
          <AnimatePresence initial={staggered} mode="popLayout">
            {items.map((item, i) => (
              <m.li
                key={item.id}
                layout={!reduced}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.9 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: {
                    ...(reduced ? { duration: durations.fast } : springs.snappy),
                    delay: staggered
                      ? firstResult.cardReveal + i * firstResult.checklistStagger
                      : 0,
                  },
                }}
                exit={{ opacity: 0, transition: { duration: durations.fast } }}
                className="rounded-full bg-surface-strong px-3 py-1 text-sm font-medium"
              >
                {item.label}
              </m.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
