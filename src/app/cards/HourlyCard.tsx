import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { DayForecast, ScoredHour, TimeWindow } from '../../domain/types';
import { HourDetails } from '../components/HourDetails';
import { CELL_W, KEEP_DETAILS_ATTR } from '../ui';
import { CELL_H, HourCell, SunCell } from './HourCell';
import { GlassCard } from './GlassCard';
import { MetricSwitch } from './MetricSwitch';
import { spanOf, stripItems, type Metric } from './stripItems';

interface Props {
  day: DayForecast;
  hours: ScoredHour[];
  freeTime: { start: number; end: number };
  best: TimeWindow | null;
  selectedHour: number | null;
  /** Current hour of the shown day (Today), or null (Tomorrow). */
  nowHour: number | null;
  onSelect(hour: number | null): void;
  /** Reserved for the first-result choreography; the card has no intro motion yet. */
  intro: boolean;
}

const SUBTITLES: Record<Metric, string> = {
  uv: 'UV index',
  rain: 'Chance of rain (%)',
  feels: 'Feels like (°C)',
};

const LAST_HOUR = 23;
const OUTLINE_RADIUS = 14;
const OUTLINE_STROKE = 1.5;

export function HourlyCard({ day, hours, freeTime, best, selectedHour, nowHour, onSelect }: Props) {
  const [metric, setMetric] = useState<Metric>('uv');
  // The hour that holds focus inside the strip; null while focus is elsewhere.
  const [focusedHour, setFocusedHour] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const cells = useRef(new Map<number, HTMLButtonElement>());

  const items = stripItems(day, hours);
  const freeBand = spanOf(items, freeTime.start, freeTime.end);
  const bestSpan = best ? spanOf(items, best.startHour, best.startHour + best.hours.length) : null;

  // The one tab stop: the selected hour, else "Now", else the first free hour.
  const tabStop = focusedHour ?? selectedHour ?? nowHour ?? freeTime.start;

  // First placement is instant (no animation): "Now" for Today, the free time for Tomorrow.
  // Only a different day re-places the strip; the hourly "Now" tick must not move it.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const anchorHour = nowHour ?? freeTime.start;
    const target = spanOf(items, anchorHour, anchorHour + 1);
    if (target) el.scrollLeft = target.left;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day.date]);

  function onKeyDown(e: KeyboardEvent) {
    let next: number;
    const current = focusedHour ?? tabStop;
    if (e.key === 'ArrowRight') next = current + 1;
    else if (e.key === 'ArrowLeft') next = current - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = LAST_HOUR;
    else return;
    e.preventDefault();
    next = Math.min(LAST_HOUR, Math.max(0, next));
    cells.current.get(next)?.focus();
  }

  const selected =
    selectedHour === null ? null : (hours.find((h) => h.hour === selectedHour) ?? null);

  const closeDetails = useCallback(
    (restoreFocus: boolean) => {
      onSelect(null);
      if (restoreFocus && selectedHour !== null) cells.current.get(selectedHour)?.focus();
    },
    [onSelect, selectedHour],
  );

  return (
    <GlassCard
      title="Hourly"
      subtitle={SUBTITLES[metric]}
      action={
        <div {...{ [KEEP_DETAILS_ATTR]: '' }}>
          <MetricSwitch value={metric} onChange={setMetric} />
        </div>
      }
    >
      <div
        ref={scroller}
        {...{ [KEEP_DETAILS_ATTR]: '' }}
        className="-mx-4 snap-x snap-mandatory overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div
          role="group"
          aria-label="Hourly forecast"
          onKeyDown={onKeyDown}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setFocusedHour(null);
          }}
          className="relative flex"
          style={{ width: items.length * CELL_W, height: CELL_H }}
        >
          {freeBand && (
            <div
              aria-hidden="true"
              data-free-band=""
              className="absolute inset-y-0 rounded-2xl bg-white/[0.08]"
              style={{ left: freeBand.left, width: freeBand.width }}
            />
          )}
          {items.map((item) =>
            item.kind === 'hour' ? (
              <HourCell
                key={`h${item.hour.hour}`}
                ref={(el) => {
                  if (el) cells.current.set(item.hour.hour, el);
                  else cells.current.delete(item.hour.hour);
                }}
                hour={item.hour}
                metric={metric}
                isNow={item.hour.hour === nowHour}
                selected={item.hour.hour === selectedHour}
                tabbable={item.hour.hour === tabStop}
                onPress={() => onSelect(item.hour.hour === selectedHour ? null : item.hour.hour)}
                onFocus={() => setFocusedHour(item.hour.hour)}
              />
            ) : (
              <SunCell key={item.event} item={item} />
            ),
          )}
          {bestSpan && (
            <svg
              aria-hidden="true"
              data-best-outline=""
              className="pointer-events-none absolute top-0"
              style={{ left: bestSpan.left }}
              width={bestSpan.width}
              height={CELL_H}
              fill="none"
            >
              <rect
                x={OUTLINE_STROKE / 2}
                y={OUTLINE_STROKE / 2}
                width={bestSpan.width - OUTLINE_STROKE}
                height={CELL_H - OUTLINE_STROKE}
                rx={OUTLINE_RADIUS}
                stroke="#fff"
                strokeWidth={OUTLINE_STROKE}
              />
            </svg>
          )}
        </div>
      </div>
      {selected && (
        <div className="mt-4">
          <HourDetails hour={selected} onClose={closeDetails} />
        </div>
      )}
    </GlassCard>
  );
}
