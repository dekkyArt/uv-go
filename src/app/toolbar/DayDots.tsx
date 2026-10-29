import { m } from 'motion/react';
import { useRef, type KeyboardEvent } from 'react';
import type { Inputs } from '../../domain/types';
import { springs } from '../../motion/tokens';
import { DAY_OPTIONS } from '../ui';

interface Props {
  day: Inputs['day'];
  onDay(d: Inputs['day']): void;
  /** The id of the tabpanel the tabs control. */
  panelId: string;
}

/**
 * Two dots (Today / Tomorrow) as a tablist. Each tab is a 44 px target around an 8 px dot; the
 * selected one is a 16 px pill that slides from one tab to the other.
 */
export function DayDots({ day, onDay, panelId }: Props) {
  const tabs = useRef(new Map<Inputs['day'], HTMLButtonElement>());

  function select(next: Inputs['day']) {
    onDay(next);
    tabs.current.get(next)?.focus();
  }

  function onKeyDown(e: KeyboardEvent) {
    const index = DAY_OPTIONS.findIndex((o) => o.value === day);
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    e.preventDefault();
    const next = DAY_OPTIONS[index + step];
    if (next) select(next.value);
  }

  return (
    <div role="tablist" aria-label="Day" className="flex" onKeyDown={onKeyDown}>
      {DAY_OPTIONS.map((o) => {
        const selected = o.value === day;
        return (
          <button
            key={o.value}
            ref={(el) => {
              if (el) tabs.current.set(o.value, el);
              else tabs.current.delete(o.value);
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            aria-label={o.label}
            tabIndex={selected ? 0 : -1}
            onClick={() => onDay(o.value)}
            className="flex size-11 items-center justify-center rounded-full"
          >
            {selected ? (
              <m.span
                aria-hidden="true"
                layoutId="day-dot"
                transition={springs.snappy}
                className="block h-2 w-4 rounded-full bg-white"
              />
            ) : (
              <span aria-hidden="true" className="block size-2 rounded-full bg-white/40" />
            )}
          </button>
        );
      })}
    </div>
  );
}
