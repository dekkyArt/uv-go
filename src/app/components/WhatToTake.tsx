import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import type { ComponentType } from 'react';
import { rules } from '../../domain/rules.config';
import type { ChecklistItem } from '../../domain/types';
import { firstResult } from '../../motion/choreography';
import { durations, springs } from '../../motion/tokens';
import { HatSunglasses } from '../icons/checklist/HatSunglasses';
import { RainJacket } from '../icons/checklist/RainJacket';
import type { IconProps } from '../icons/checklist/shared';
import { Sunscreen } from '../icons/checklist/Sunscreen';
import { WarmLayer } from '../icons/checklist/WarmLayer';
import { Water } from '../icons/checklist/Water';

interface Props {
  items: ChecklistItem[];
  /** First result: items appear one after another once the card reveals. */
  intro?: boolean;
}

const ICONS: Record<ChecklistItem['id'], ComponentType<IconProps>> = {
  sunscreen: Sunscreen,
  'hat-sunglasses': HatSunglasses,
  'rain-jacket': RainJacket,
  water: Water,
  'warm-layer': WarmLayer,
};

/**
 * The icon plays once, when its item mounts: `play` is decided at mount and never changes, so a
 * recalculation that keeps the item does not replay it. Items already there at the first render
 * only play during the intro.
 */
function ItemIcon({ id, play, delay }: { id: ChecklistItem['id']; play: boolean; delay: number }) {
  const [playOnce] = useState(play);
  const Icon = ICONS[id];
  return <Icon play={playOnce} delay={delay} />;
}

export function WhatToTake({ items, intro = false }: Props) {
  const reduced = useReducedMotion() ?? false;
  const staggered = intro && !reduced;
  // Items of the first render, minus the ones that have left since: only those do not play.
  const ids = items.map((item) => item.id);
  const [initialIds, setInitialIds] = useState(ids);
  if (initialIds.some((id) => !ids.includes(id))) {
    setInitialIds(initialIds.filter((id) => ids.includes(id)));
  }
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
            {items.map((item, i) => {
              const delay = staggered
                ? firstResult.cardReveal + i * firstResult.checklistStagger
                : 0;
              return (
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
                      delay,
                    },
                  }}
                  exit={{ opacity: 0, transition: { duration: durations.fast } }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-surface-strong px-3 py-1 text-sm font-medium"
                >
                  <ItemIcon
                    id={item.id}
                    play={staggered || !initialIds.includes(item.id)}
                    delay={delay}
                  />
                  {item.label}
                </m.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
