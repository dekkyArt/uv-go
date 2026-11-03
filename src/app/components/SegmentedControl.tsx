import { m, useReducedMotion } from 'motion/react';
import { useId, useRef, type KeyboardEvent } from 'react';
import { usePress } from '../../motion/press';
import { springs } from '../../motion/tokens';
import { SEGMENT_OFF_CLASS, SEGMENT_ON_CLASS, SEGMENT_PILL_CLASS } from '../ui';

interface Props<T extends string | number> {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange(v: T): void;
  /** When true, segments size proportionally according to content length rather than equal fractions. */
  proportional?: boolean;
}

export function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
  proportional = false,
}: Props<T>) {
  const indicatorId = `seg-${useId()}`;
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const reduced = useReducedMotion() ?? false;
  const press = usePress();

  function onKeyDown(e: KeyboardEvent, index: number) {
    let next: number;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % options.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
      next = (index - 1 + options.length) % options.length;
    else return;
    e.preventDefault();
    onChange(options[next].value);
    buttons.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="glass flex w-full items-center gap-1 rounded-full p-1"
    >
      {options.map((option, i) => {
        const checked = option.value === value;
        return (
          <m.button
            key={option.value}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            {...press}
            className={`relative flex min-h-11 ${
              proportional ? 'flex-auto' : 'flex-1 min-w-0'
            } items-center justify-center rounded-full px-2.5 py-2 text-center text-[13px] font-medium leading-none sm:text-sm ${
              checked ? SEGMENT_ON_CLASS : SEGMENT_OFF_CLASS
            }`}
          >
            {checked && (
              // With reduced motion the pill just appears under the new option.
              <m.span
                layoutId={reduced ? undefined : indicatorId}
                data-segment-indicator=""
                aria-hidden="true"
                transition={springs.snappy}
                className={`absolute inset-0 rounded-full shadow-sm ${SEGMENT_PILL_CLASS}`}
              />
            )}
            <span
              className={`relative z-10 select-none ${
                proportional ? 'whitespace-nowrap' : 'truncate'
              }`}
            >
              {option.label}
            </span>
          </m.button>
        );
      })}
    </div>
  );
}
