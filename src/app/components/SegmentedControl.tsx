import { m } from 'motion/react';
import { useId, useRef, type KeyboardEvent } from 'react';
import { springs } from '../../motion/tokens';

interface Props<T extends string | number> {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange(v: T): void;
}

export function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: Props<T>) {
  const indicatorId = `seg-${useId()}`;
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

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
      className="inline-flex flex-wrap gap-1 rounded-xl bg-surface-strong p-1"
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
            whileTap={{ scale: 0.96 }}
            className={`relative min-h-11 min-w-11 rounded-lg px-4 text-sm font-medium ${
              checked ? 'text-bg' : 'text-text hover:bg-surface'
            }`}
          >
            {checked && (
              <m.span
                layoutId={indicatorId}
                data-segment-indicator=""
                aria-hidden="true"
                transition={springs.snappy}
                className="absolute inset-0 rounded-lg bg-text"
              />
            )}
            <span className="relative">{option.label}</span>
          </m.button>
        );
      })}
    </div>
  );
}
