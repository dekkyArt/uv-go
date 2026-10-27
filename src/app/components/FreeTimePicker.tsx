import { m } from 'motion/react';
import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { springs } from '../../motion/tokens';
import { formatHour } from '../ui';

interface Props {
  value: { start: number; end: number };
  onChange(v: { start: number; end: number }): void;
}

type Handle = 'start' | 'end';
/** `tie` means the press was exactly between the handles; the first move resolves it. */
type Grab = Handle | 'tie';

const HOURS_PER_DAY = 24;
const MIN_SPAN = 1;
const TICKS = [0, 6, 12, 18, 24];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function FreeTimePicker({ value, onChange }: Props) {
  const { start, end } = value;
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<Grab | null>(null);

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

  /** Pointer position in (fractional) hours from the track's left edge, or null if unmeasurable. */
  function hoursAt(e: PointerEvent): number | null {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    return ((e.clientX - rect.left) / rect.width) * HOURS_PER_DAY;
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    const at = hoursAt(e);
    if (at === null) return;
    // The nearer handle wins, whatever element was hit: short windows overlap the
    // two 44 px touch areas, so the DOM target alone cannot tell them apart.
    const toStart = Math.abs(at - start);
    const toEnd = Math.abs(at - end);
    dragging.current = toStart < toEnd ? 'start' : toEnd < toStart ? 'end' : 'tie';
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Capture is best-effort; the track still receives moves while the pointer is over it.
    }
    if (dragging.current !== 'tie') move(dragging.current, Math.round(at));
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (dragging.current === null) return;
    const at = hoursAt(e);
    if (at === null) return;
    const hour = Math.round(at);
    if (dragging.current === 'tie') {
      // Equidistant: the first real movement decides, towards a handle that has room to go.
      const centre = (start + end) / 2;
      if (at === centre) return;
      const left = at < centre;
      dragging.current = left
        ? start > 0
          ? 'start'
          : 'end'
        : end < HOURS_PER_DAY
          ? 'end'
          : 'start';
    }
    move(dragging.current, hour);
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
      {/* Clip horizontally: the track-wide carriers are translated right and would otherwise
          widen the page. The 22 px padding keeps the knobs at 00 and 24 fully visible. */}
      <div className="overflow-x-clip px-[22px]">
        <div
          ref={trackRef}
          data-track=""
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          style={{ touchAction: 'none' }}
          className="relative h-11 cursor-pointer select-none"
        >
          <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-surface-strong" />
          {/* Full-width bar scaled from its left edge and shifted to `start`: transform only. */}
          <m.div
            aria-hidden="true"
            initial={false}
            animate={{ x: pct(start), scaleX: (end - start) / HOURS_PER_DAY }}
            transition={springs.snappy}
            style={{ transformOrigin: 'left' }}
            className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-text-muted"
          />
          {(['start', 'end'] as const).map((handle) => {
            const hour = handle === 'start' ? start : end;
            return (
              // Full-width, click-through carrier: a percentage `x` is relative to the track.
              <m.div
                key={handle}
                initial={false}
                animate={{ x: pct(hour) }}
                transition={springs.snappy}
                className="pointer-events-none absolute inset-x-0 top-0 h-11"
              >
                <div
                  data-handle={handle}
                  role="slider"
                  tabIndex={0}
                  aria-label={handle === 'start' ? 'Free time start' : 'Free time end'}
                  aria-valuemin={handle === 'start' ? 0 : MIN_SPAN}
                  aria-valuemax={handle === 'start' ? HOURS_PER_DAY - MIN_SPAN : HOURS_PER_DAY}
                  aria-valuenow={hour}
                  aria-valuetext={formatHour(hour)}
                  onKeyDown={(e) => onKeyDown(e, handle)}
                  className="pointer-events-auto absolute top-0 -left-[22px] flex size-11 items-center justify-center rounded-full"
                >
                  <span className="size-5 rounded-full border-2 border-text bg-surface shadow" />
                </div>
              </m.div>
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
