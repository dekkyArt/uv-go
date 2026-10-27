import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { formatHour } from '../ui';

interface Props {
  value: { start: number; end: number };
  onChange(v: { start: number; end: number }): void;
}

type Handle = 'start' | 'end';

const HOURS_PER_DAY = 24;
const MIN_SPAN = 1;
const TICKS = [0, 6, 12, 18, 24];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function FreeTimePicker({ value, onChange }: Props) {
  const { start, end } = value;
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<Handle | null>(null);

  function move(handle: Handle, hour: number) {
    if (handle === 'start') {
      const next = clamp(hour, 0, end - MIN_SPAN);
      if (next !== start) onChange({ start: next, end });
    } else {
      const next = clamp(hour, start + MIN_SPAN, HOURS_PER_DAY);
      if (next !== end) onChange({ start, end: next });
    }
  }

  function onKeyDown(e: KeyboardEvent, handle: Handle) {
    const current = handle === 'start' ? start : end;
    let next: number;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = current + 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = current - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = HOURS_PER_DAY;
    else return;
    e.preventDefault();
    move(handle, next);
  }

  function hourAt(e: PointerEvent): number | null {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    return Math.round(((e.clientX - rect.left) / rect.width) * HOURS_PER_DAY);
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    const hour = hourAt(e);
    if (hour === null) return;
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-handle]');
    const picked = target?.dataset.handle as Handle | undefined;
    // Pressing the bare track grabs whichever handle is closer.
    let handle: Handle;
    if (picked) handle = picked;
    else if (hour <= start) handle = 'start';
    else if (hour >= end) handle = 'end';
    else handle = hour - start <= end - hour ? 'start' : 'end';
    dragging.current = handle;
    e.currentTarget.setPointerCapture(e.pointerId);
    move(handle, hour);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (dragging.current === null) return;
    const hour = hourAt(e);
    if (hour !== null) move(dragging.current, hour);
  }

  function onPointerEnd() {
    dragging.current = null;
  }

  const pct = (hour: number) => `${(hour / HOURS_PER_DAY) * 100}%`;

  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-text-muted">
        <span className="font-medium text-text">
          {formatHour(start)} – {formatHour(end)}
        </span>
      </p>
      <div className="px-[22px]">
        <div
          ref={trackRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          style={{ touchAction: 'none' }}
          className="relative h-11 cursor-pointer select-none"
        >
          <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-surface-strong" />
          <div
            className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-text-muted"
            style={{ left: pct(start), width: pct(end - start) }}
          />
          {(['start', 'end'] as const).map((handle) => {
            const hour = handle === 'start' ? start : end;
            return (
              <div
                key={handle}
                data-handle={handle}
                role="slider"
                tabIndex={0}
                aria-label={handle === 'start' ? 'Free time start' : 'Free time end'}
                aria-valuemin={handle === 'start' ? 0 : MIN_SPAN}
                aria-valuemax={handle === 'start' ? HOURS_PER_DAY - MIN_SPAN : HOURS_PER_DAY}
                aria-valuenow={hour}
                aria-valuetext={formatHour(hour)}
                onKeyDown={(e) => onKeyDown(e, handle)}
                className="absolute top-0 flex size-11 -translate-x-1/2 items-center justify-center rounded-full"
                style={{ left: pct(hour) }}
              >
                <span className="size-5 rounded-full border-2 border-text bg-surface shadow" />
              </div>
            );
          })}
        </div>
        <div aria-hidden="true" className="relative h-4 text-xs text-text-muted">
          {TICKS.map((tick) => (
            <span key={tick} className="absolute -translate-x-1/2" style={{ left: pct(tick) }}>
              {String(tick).padStart(2, '0')}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
