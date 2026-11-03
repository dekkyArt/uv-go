import { useEffect, useRef } from 'react';
import type { ScoredHour } from '../../domain/types';
import { FACTORS, FACTOR_LABELS, KEEP_DETAILS_ATTR, formatHour, verdictLabel } from '../ui';

interface Props {
  hour: ScoredHour;
  /** `restoreFocus`: the user closed it with the × button or Esc, so focus should go back to the strip. */
  onClose(restoreFocus: boolean): void;
}

const NO_DATA = 'no data';

const ICONS: Record<string, string> = { UV: '☀️', Rain: '💧', 'Feels like': '🌡️', Wind: '💨' };

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
      className="px-1 pt-2 pb-1"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-3xl font-semibold tracking-tight">{time}</h3>
          <p className="text-sm text-text-muted">
            {hour.verdict === 'night' ? '🌙 Night' : verdictLabel(hour.verdict)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onClose(true)}
          aria-label="Close hour details"
          className="-mr-2 -mt-1 inline-flex size-11 items-center justify-center rounded-full text-xl text-text-muted hover:text-text"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-6">
        {rows.map(([label, text]) => (
          <div key={label}>
            <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-text-muted">
              <span aria-hidden="true">{ICONS[label]}</span>
              {label}
            </dt>
            <dd className="text-xl font-semibold">{text}</dd>
          </div>
        ))}
      </dl>
      <h4 className="mt-8 text-xs font-medium uppercase tracking-wide text-text-muted">
        Points (lower is better)
      </h4>
      <ul className="mt-3 flex flex-wrap justify-between gap-x-4 gap-y-2 text-sm text-text-muted">
        {FACTORS.map((factor) => (
          <li key={factor}>
            {FACTOR_LABELS[factor]} {hour.points[factor]}
          </li>
        ))}
        <li className="font-semibold text-text">Total {hour.score}</li>
      </ul>
    </section>
  );
}
