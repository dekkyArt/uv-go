import { m } from 'motion/react';
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { springs } from '../../motion/tokens';
import type { Metric } from './stripItems';

const ICON_PROPS = {
  viewBox: '0 0 20 20',
  width: 20,
  height: 20,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

const OPTIONS: { value: Metric; label: string; icon: ReactNode }[] = [
  {
    value: 'uv',
    label: 'UV',
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="10" cy="10" r="3.4" />
        <path d="M10 2.2v2M10 15.8v2M2.2 10h2M15.8 10h2M4.5 4.5l1.4 1.4M14.1 14.1l1.4 1.4M4.5 15.5l1.4-1.4M14.1 5.9l1.4-1.4" />
      </svg>
    ),
  },
  {
    value: 'rain',
    label: 'Rain',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M10 2.6C7.6 6 5.4 8.4 5.4 11.6a4.6 4.6 0 0 0 9.2 0C14.6 8.4 12.4 6 10 2.6z" />
      </svg>
    ),
  },
  {
    value: 'feels',
    label: 'Feels like',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M2.5 7.5h8.2a2.2 2.2 0 1 0-2.2-2.2M2.5 11h11.2a2.4 2.4 0 1 1-2.4 2.4M2.5 14.5h5" />
      </svg>
    ),
  },
];

interface Props {
  value: Metric;
  onChange(metric: Metric): void;
}

/** Three icon buttons on a glass pill; the selected one rides a sliding white pill. */
export function MetricSwitch({ value, onChange }: Props) {
  const indicatorId = `metric-${useId()}`;
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent, index: number) {
    let next: number;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % OPTIONS.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
      next = (index - 1 + OPTIONS.length) % OPTIONS.length;
    else return;
    e.preventDefault();
    onChange(OPTIONS[next].value);
    buttons.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label="Metric"
      className="inline-flex gap-0.5 rounded-full bg-surface-strong p-0.5"
    >
      {OPTIONS.map((option, i) => {
        const checked = option.value === value;
        return (
          <button
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
            className={`relative inline-flex size-11 items-center justify-center rounded-full ${
              checked ? 'text-bg' : 'text-text'
            }`}
          >
            {checked && (
              <m.span
                layoutId={indicatorId}
                data-metric-indicator=""
                aria-hidden="true"
                transition={springs.snappy}
                className="absolute inset-0 rounded-full bg-text"
              />
            )}
            <span className="relative">{option.icon}</span>
            <span className="sr-only">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
