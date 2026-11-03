import { m, useReducedMotion } from 'motion/react';
import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { DayForecast, ScoredHour, TimeWindow } from '../../domain/types';
import { firstResult } from '../../motion/choreography';
import { useFeaturesFailed } from '../../motion/featuresFailed';
import { durations, springs } from '../../motion/tokens';
import { HourDetails } from '../components/HourDetails';
import { CELL_W, FREE_BAND_CLASS, formatShortDate, KEEP_DETAILS_ATTR } from '../ui';
import { CELL_H, HourCell, SunCell } from './HourCell';
import { GlassCard } from './GlassCard';
import { MetricSwitch } from './MetricSwitch';
import { spanOf, stripItems, type Metric } from './stripItems';

interface Props {
  day: DayForecast;
  /** Which day is shown, named next to its date in the header. */
  dayName: 'Today' | 'Tomorrow';
  hours: ScoredHour[];
  freeTime: { start: number; end: number };
  best: TimeWindow | null;
  selectedHour: number | null;
  /** Current hour of the shown day (Today), or null (Tomorrow). */
  nowHour: number | null;
  onSelect(hour: number | null): void;
  /** The first-result choreography is playing. */
  intro: boolean;
  /** Place in the card order, for the intro stagger. */
  index: number;
  /** Height of the pinned layers at the top (bar and What to take strip): the body slides under. */
  tuck?: number;
}

const SUBTITLES: Record<Metric, string> = {
  uv: 'UV index',
  rain: 'Chance of rain (%)',
  feels: 'Feels like (°C)',
};

const LAST_HOUR = 23;
const OUTLINE_RADIUS = 14;
const OUTLINE_STROKE = 1.5;

function outlineRect(width: number) {
  return {
    x: OUTLINE_STROKE / 2,
    y: OUTLINE_STROKE / 2,
    width: width - OUTLINE_STROKE,
    height: CELL_H - OUTLINE_STROKE,
    rx: OUTLINE_RADIUS,
    stroke: '#fff',
    strokeWidth: OUTLINE_STROKE,
  };
}

export function HourlyCard({
  day,
  dayName,
  hours,
  freeTime,
  best,
  selectedHour,
  nowHour,
  onSelect,
  intro,
  index,
  tuck,
}: Props) {
  const reduced = useReducedMotion() ?? false;
  const motionFailed = useFeaturesFailed();
  const play = intro && !reduced;
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

  // The strip is placed on "Now" for Today, the free time for Tomorrow. During the intro it
  // scrolls there by itself from the start of the day; otherwise it is placed at once. Only a
  // different day re-places the strip; the hourly "Now" tick must not move it.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const anchorHour = nowHour ?? freeTime.start;
    const target = spanOf(items, anchorHour, anchorHour + 1);
    if (!target) return;
    if (!play) {
      el.scrollLeft = target.left;
      return;
    }
    el.scrollLeft = 0;
    // Mandatory snapping would pull every in-between frame to a cell edge.
    el.style.scrollSnapType = 'none';
    let scroll: { stop(): void } | null = null;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      scroll?.stop();
      el.style.scrollSnapType = '';
      el.removeEventListener('pointerdown', release);
      el.removeEventListener('wheel', release);
    };
    // A finger or wheel on the strip takes over at once.
    el.addEventListener('pointerdown', release);
    el.addEventListener('wheel', release, { passive: true });
    void import('../../motion/features')
      .then(({ animate }) => {
        if (released) return;
        scroll = animate(0, target.left, {
          ...springs.smooth,
          delay: firstResult.hourScroll,
          onUpdate: (left) => {
            el.scrollLeft = left;
          },
          onComplete: release,
        });
      })
      .catch(() => {
        // The features chunk did not load: jump to "Now" instead of scrolling there.
        if (released) return;
        el.scrollLeft = target.left;
        release();
      });
    return release;
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
      intro={intro}
      index={index}
      tuck={tuck}
      layout
      title="Hourly"
      titleNote={[dayName, formatShortDate(day.date)].filter(Boolean).join(', ')}
      subtitle={SUBTITLES[metric]}
      action={
        <div {...{ [KEEP_DETAILS_ATTR]: '' }}>
          <MetricSwitch value={metric} onChange={setMetric} />
        </div>
      }
    >
      {/* scroll-px-4 puts the snap points where the cells start (56 px apart), so a scroll to a
          cell does not snap on. Layout: the card grows around the hour details, the strip keeps
          its shape. */}
      <m.div
        ref={scroller}
        {...{ [KEEP_DETAILS_ATTR]: '' }}
        // The day pager leaves a gesture that starts on the strip to the strip.
        data-hourly-strip=""
        layout={!reduced}
        transition={springs.smooth}
        className="-mx-4 snap-x snap-mandatory scroll-px-4 overflow-x-auto px-4 scrollbar-none [&::-webkit-scrollbar]:hidden [-webkit-mask-image:linear-gradient(to_right,transparent,#000_16px,#000_calc(100%-16px),transparent)] mask-[linear-gradient(to_right,transparent,#000_16px,#000_calc(100%-16px),transparent)]"
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
              className={`pointer-events-none absolute inset-y-0 rounded-2xl ${FREE_BAND_CLASS}`}
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
                onBand={item.hour.hour >= freeTime.start && item.hour.hour < freeTime.end}
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
              {/* Drawn along its path only during the intro; a plain rect otherwise, so the dash
                  never leaves a seam where the path starts. */}
              {play ? (
                <m.rect
                  {...outlineRect(bestSpan.width)}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: [0, 1] }}
                  transition={{
                    ...springs.smooth,
                    duration: firstResult.bestOutlineDuration,
                    delay: firstResult.bestOutline,
                  }}
                />
              ) : (
                <rect {...outlineRect(bestSpan.width)} />
              )}
            </svg>
          )}
        </div>
      </m.div>
      {selected && (
        <m.div
          layout={!reduced}
          initial={motionFailed ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={reduced ? { duration: durations.fast } : springs.smooth}
          className="mt-4"
        >
          <HourDetails hour={selected} onClose={closeDetails} />
        </m.div>
      )}
    </GlassCard>
  );
}
