import { useEffect, useRef } from 'react';
import type { ScoredHour } from '../../domain/types';
import { KEEP_DETAILS_ATTR } from './HourStrip';
import { FACTORS, FACTOR_LABELS, formatHour, verdictLabel } from '../ui';

interface Props {
  hour: ScoredHour;
  /** `restoreFocus`: the user closed it with the × button or Esc, so focus should go back to the strip. */
  onClose(restoreFocus: boolean): void;
}

const NO_DATA = 'no data';

function value(v: number | null, format: (n: number) => string): string {
  return v === null ? NO_DATA : format(v);
}

export function HourDetails({ hour, onClose }: Props) {
  const pressStartedInside = useRef(false);

  useEffect(() => {
    const insideKept = (target: EventTarget | null) =>
      target instanceof Element && target.closest(`[${KEEP_DETAILS_ATTR}]`) !== null;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose(true);
    }
    // Only a completed tap outside closes (FR-4): `click` does not fire after a touch scroll, and
    // a press that started on the strip or the details (a scrub) never counts as an outside tap.
    function onPointerDown(e: PointerEvent) {
      pressStartedInside.current = insideKept(e.target);
    }
    function onClick(e: MouseEvent) {
      const startedInside = pressStartedInside.current;
      pressStartedInside.current = false;
      if (startedInside || insideKept(e.target)) return;
      onClose(false);
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('click', onClick);
    };
  }, [onClose]);

  const time = formatHour(hour.hour);
  const rows: [string, string][] = [
    ['UV', value(hour.uv, (n) => String(Math.round(n * 10) / 10))],
    ['Rain', value(hour.rainProb, (n) => `${Math.round(n)}%`)],
    ['Feels like', value(hour.feelsLike, (n) => `${Math.round(n)}°C`)],
    ['Wind', value(hour.windKmh, (n) => `${Math.round(n)} km/h`)],
  ];

  return (
    <section
      {...{ [KEEP_DETAILS_ATTR]: '' }}
      aria-label={`Details for ${time}`}
      className="rounded-2xl border border-border bg-surface p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">{time}</h3>
          <p className="text-sm text-text-muted">
            {hour.verdict === 'night' ? 'Night' : verdictLabel(hour.verdict)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onClose(true)}
          aria-label="Close hour details"
          className="inline-flex size-11 items-center justify-center rounded-lg text-xl text-text hover:bg-surface-strong"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {rows.map(([label, text]) => (
          <div key={label}>
            <dt className="text-text-muted">{label}</dt>
            <dd className="font-medium">{text}</dd>
          </div>
        ))}
      </dl>
      <h4 className="mt-4 text-sm font-semibold">Points (lower is better)</h4>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {FACTORS.map((factor) => (
          <li key={factor}>
            {FACTOR_LABELS[factor]} {hour.points[factor]}
          </li>
        ))}
        <li className="font-medium">Total {hour.score}</li>
      </ul>
    </section>
  );
}
