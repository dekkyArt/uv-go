import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { roundHalfUp } from '../../domain/scoring';
import type { ScoredHour, TimeWindow } from '../../domain/types';
import { VERDICT_FILL_CLASS, formatHour, verdictLabel } from '../ui';

/** Marks UI that must not count as an "outside tap" for HourDetails. */
export const KEEP_DETAILS_ATTR = 'data-keep-hour-details';

interface Props {
  hours: ScoredHour[];
  freeTime: { start: number; end: number };
  best: TimeWindow | null;
  selectedHour: number | null;
  onSelect(h: number | null): void;
}

const LAST_HOUR = 23;
const HOURS_PER_DAY = 24;
const LABEL_HOURS = [0, 6, 12, 18];
/** Horizontal travel before a press turns into a scrub, so a vertical page scroll never selects. */
const SCRUB_THRESHOLD_PX = 8;

const LEGEND: { kind: ScoredHour['verdict']; label: string }[] = [
  { kind: 'green', label: 'Good hour' },
  { kind: 'yellow', label: 'Needs protection' },
  { kind: 'red', label: 'Not recommended' },
  { kind: 'night', label: 'Night' },
];

/**
 * Non-colour cue for an hour: check / exclamation / cross / dot. Drawn in the page background
 * colour, which has >= 3:1 against every verdict fill in both themes (see global.css).
 */
function HourGlyph({ kind }: { kind: ScoredHour['verdict'] }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-bg"
    >
      {kind === 'green' && <path d="M1.5 5.2l2.4 2.4 4.6-5" />}
      {kind === 'yellow' && <path d="M5 1.5v4M5 8.4v.1" />}
      {kind === 'red' && <path d="M2 2l6 6M8 2L2 8" />}
      {kind === 'night' && <circle cx="5" cy="5" r="1.2" fill="currentColor" />}
    </svg>
  );
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const pct = (hour: number) => `${(hour / HOURS_PER_DAY) * 100}%`;

function describe(hour: ScoredHour): string {
  const time = formatHour(hour.hour);
  if (hour.verdict === 'night') return `${time}, night`;
  const uv = hour.uv === null ? 'no UV data' : `UV ${roundHalfUp(hour.uv)}`;
  return `${time}, ${uv}, ${verdictLabel(hour.verdict)}`;
}

export function HourStrip({ hours, freeTime, best, selectedHour, onSelect }: Props) {
  // With nothing selected the slider rests on the best hour (or the start of free time).
  const current = clamp(selectedHour ?? best?.startHour ?? freeTime.start, 0, LAST_HOUR);
  const currentHour = hours[current];

  function onKeyDown(e: KeyboardEvent) {
    let next: number;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = current + 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = current - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = LAST_HOUR;
    else return;
    e.preventDefault();
    next = clamp(next, 0, LAST_HOUR);
    if (next !== current) onSelect(next);
  }

  // Taps select on click. A press only becomes a scrub after real horizontal travel, so the
  // pointerdown that starts a vertical page scroll on touch never selects an hour.
  const pressX = useRef<number | null>(null);
  const scrubbing = useRef(false);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    pressX.current = e.clientX;
    scrubbing.current = false;
  }

  function onPointerEnd() {
    pressX.current = null;
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (e.buttons !== 1 || pressX.current === null) return;
    if (!scrubbing.current && Math.abs(e.clientX - pressX.current) < SCRUB_THRESHOLD_PX) return;
    scrubbing.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const hour = clamp(
      Math.floor(((e.clientX - rect.left) / rect.width) * HOURS_PER_DAY),
      0,
      LAST_HOUR,
    );
    if (hour !== selectedHour) onSelect(hour);
  }

  return (
    <div className="flex flex-col gap-1" {...{ [KEEP_DETAILS_ATTR]: '' }}>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Hour of the day"
        aria-valuemin={0}
        aria-valuemax={LAST_HOUR}
        aria-valuenow={current}
        aria-valuetext={currentHour ? describe(currentHour) : formatHour(current)}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        style={{ touchAction: 'pan-y' }}
        className="relative select-none rounded-md"
      >
        <div className="flex h-11 gap-px">
          {hours.map((hour) => (
            <div
              key={hour.hour}
              data-hour={hour.hour}
              onClick={() => {
                // The click that ends a scrub must not re-select the cell it was released on.
                if (scrubbing.current) scrubbing.current = false;
                else onSelect(hour.hour);
              }}
              className={`flex flex-1 cursor-pointer items-center justify-center rounded-sm ${VERDICT_FILL_CLASS[hour.verdict]} ${
                hour.hour === selectedHour ? 'ring-2 ring-text ring-offset-2 ring-offset-bg' : ''
              }`}
              style={hour.isPast ? { opacity: 'var(--color-past-opacity)' } : undefined}
            >
              <HourGlyph kind={hour.verdict} />
            </div>
          ))}
        </div>
        {best && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-y-1 rounded-md border-2 border-text"
            style={{ left: pct(best.startHour), width: pct(best.hours.length) }}
          />
        )}
        <div aria-hidden="true" className="mt-2 h-1.5 rounded-full bg-surface-strong">
          <div
            className="h-full rounded-full bg-focus"
            style={{
              marginLeft: pct(freeTime.start),
              width: pct(freeTime.end - freeTime.start),
            }}
          />
        </div>
      </div>
      <div aria-hidden="true" className="relative h-4 text-xs text-text-muted">
        {LABEL_HOURS.map((hour) => (
          <span key={hour} className="absolute" style={{ left: pct(hour) }}>
            {String(hour).padStart(2, '0')}
          </span>
        ))}
      </div>
      <ul
        aria-hidden="true"
        className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted"
      >
        {LEGEND.map(({ kind, label }) => (
          <li key={kind} className="inline-flex items-center gap-1.5">
            <span
              className={`inline-flex size-4 items-center justify-center rounded-sm ${VERDICT_FILL_CLASS[kind]}`}
            >
              <HourGlyph kind={kind} />
            </span>
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
