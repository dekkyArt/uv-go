import type { KeyboardEvent, PointerEvent } from 'react';
import { roundHalfUp } from '../../domain/scoring';
import type { ScoredHour, TimeWindow } from '../../domain/types';
import { VERDICT_FILL_CLASS, formatHour, verdictLabel } from '../ui';

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

  // Dragging across the strip (touch pointers stay captured by the cell they started on).
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (e.buttons !== 1) return;
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
    <div className="flex flex-col gap-1">
      <div
        role="slider"
        tabIndex={0}
        aria-label="Hour of the day"
        aria-valuemin={0}
        aria-valuemax={LAST_HOUR}
        aria-valuenow={current}
        aria-valuetext={currentHour ? describe(currentHour) : formatHour(current)}
        onKeyDown={onKeyDown}
        onPointerMove={onPointerMove}
        style={{ touchAction: 'pan-y' }}
        className="relative select-none rounded-md"
      >
        <div className="flex h-11 gap-px">
          {hours.map((hour) => (
            <div
              key={hour.hour}
              data-hour={hour.hour}
              onPointerDown={() => onSelect(hour.hour)}
              className={`flex-1 cursor-pointer rounded-sm ${VERDICT_FILL_CLASS[hour.verdict]} ${
                hour.hour === selectedHour ? 'ring-2 ring-text ring-offset-2 ring-offset-bg' : ''
              }`}
              style={hour.isPast ? { opacity: 'var(--color-past-opacity)' } : undefined}
            />
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
    </div>
  );
}
