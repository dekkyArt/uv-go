import {
  m,
  useAnimationControls,
  useMotionValue,
  useReducedMotion,
  type PanInfo,
} from 'motion/react';
import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { roundHalfUp } from '../../domain/scoring';
import type { ScoredHour, TimeWindow } from '../../domain/types';
import { firstResult } from '../../motion/choreography';
import { durations, ease, springs } from '../../motion/tokens';
import { VERDICT_FILL_CLASS, formatHour, verdictLabel } from '../ui';

/** Marks UI that must not count as an "outside tap" for HourDetails. */
export const KEEP_DETAILS_ATTR = 'data-keep-hour-details';

interface Props {
  hours: ScoredHour[];
  freeTime: { start: number; end: number };
  best: TimeWindow | null;
  selectedHour: number | null;
  onSelect(h: number | null): void;
  /** Cells grow in along the strip; ignored with reduced motion. */
  playIntro?: boolean;
  /** First result: the time label rides in the search frame until it moves into the card. */
  labelInFrame?: boolean;
}

const LAST_HOUR = 23;
const HOURS_PER_DAY = 24;
const LABEL_HOURS = [0, 6, 12, 18];
/** Horizontal travel before a press turns into a scrub, so a vertical page scroll never selects. */
const SCRUB_THRESHOLD_PX = 8;
/** Touch layout: one hour is one 44 px tap target, so the day is wider than the screen. */
const HOUR_PX = 44;
const STRIP_PX = HOUR_PX * HOURS_PER_DAY;
/** How far (in hours) the search frame overshoots the best window before it snaps back. */
const FRAME_OVERSHOOT_HOURS = 0.5;
/** How far a flick carries the strip before it snaps to an hour, in seconds of release velocity. */
const FLICK_SECONDS = 0.15;
const TOUCH_QUERY = '(hover: none)';

function subscribeTouch(notify: () => void) {
  const query = typeof window.matchMedia === 'function' ? window.matchMedia(TOUCH_QUERY) : null;
  query?.addEventListener?.('change', notify);
  return () => query?.removeEventListener?.('change', notify);
}

function isTouchDevice() {
  return typeof window.matchMedia === 'function' && window.matchMedia(TOUCH_QUERY).matches;
}

/** True on devices without hover (phones): the strip is dragged instead of shown whole. */
function useTouchDevice() {
  return useSyncExternalStore(subscribeTouch, isTouchDevice, () => false);
}

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

/**
 * Outline of the best window. On the first result it starts at the beginning of the free time,
 * slides to the window and settles with a small overshoot (x in percent of its own width, so the
 * border is never scaled). After that a changed window glides there on a layout spring.
 */
function BestFrame({
  best,
  freeStart,
  intro,
  searching,
  snapped,
  onSnapped,
}: {
  best: TimeWindow;
  freeStart: number;
  intro: boolean;
  searching: boolean;
  snapped: boolean;
  onSnapped(): void;
}) {
  const length = best.hours.length;
  const fromPct = ((freeStart - best.startHour) / length) * 100;
  const overshootPct = ((fromPct <= 0 ? 1 : -1) * FRAME_OVERSHOOT_HOURS * 100) / length;
  return (
    <m.div
      aria-hidden="true"
      data-best-frame=""
      {...(searching ? { 'data-search-frame': '' } : null)}
      layout="position"
      transition={springs.gentle}
      initial={{ x: intro ? `${fromPct}%` : '0%' }}
      animate={
        intro && !snapped
          ? {
              x: `${overshootPct}%`,
              transition: {
                delay: firstResult.searchStart,
                duration: firstResult.searchDuration,
                ease,
              },
            }
          : { x: '0%', transition: intro ? springs.bouncy : springs.gentle }
      }
      onAnimationComplete={() => {
        if (intro) onSnapped();
      }}
      className="pointer-events-none absolute -inset-y-1 rounded-md border-2 border-text"
      style={{ left: pct(best.startHour), width: pct(length) }}
    >
      {searching && (
        <span className="absolute inset-0 flex items-center justify-center">
          <m.span
            layoutId="best-window-label"
            className="whitespace-nowrap rounded-sm bg-text px-1.5 py-0.5 text-xs font-semibold text-bg"
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              transition: { delay: firstResult.searchStart, duration: durations.fast },
            }}
          >
            {best.label}
          </m.span>
        </span>
      )}
    </m.div>
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

export function HourStrip({
  hours,
  freeTime,
  best,
  selectedHour,
  onSelect,
  playIntro = false,
  labelInFrame = false,
}: Props) {
  // With nothing selected the slider rests on the best hour (or the start of free time).
  const current = clamp(selectedHour ?? best?.startHour ?? freeTime.start, 0, LAST_HOUR);
  const currentHour = hours[current];
  const touch = useTouchDevice();
  const reduced = useReducedMotion() ?? false;
  const intro = playIntro && !reduced;
  // The search frame exists only on the first result and never with reduced motion.
  const searching = intro && labelInFrame;
  const [snapped, setSnapped] = useState(false);

  const viewport = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const controls = useAnimationControls();

  /** Strip offset that puts the middle of `hour` in the middle of the viewport. */
  function centreOffset(hour: number): number {
    const width = viewport.current?.clientWidth ?? 0;
    const centred = width / 2 - ((hour + 0.5) / HOURS_PER_DAY) * STRIP_PX;
    return Math.min(0, Math.max(width - STRIP_PX, centred));
  }

  function hourAtOffset(offset: number): number {
    const width = viewport.current?.clientWidth ?? 0;
    return clamp(Math.round(((width / 2 - offset) / STRIP_PX) * HOURS_PER_DAY - 0.5), 0, LAST_HOUR);
  }

  // The selected hour sits in the middle of the viewport; the first placement is instant.
  const placed = useRef(false);
  useLayoutEffect(() => {
    if (!touch || !viewport.current?.clientWidth) return;
    const target = centreOffset(current);
    if (placed.current && !reduced) void controls.start({ x: target, transition: springs.gentle });
    else x.set(target);
    placed.current = true;
  }, [touch, current, reduced, x, controls]);

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

  // Desktop scrub by mouse; on touch the strip itself is dragged instead.
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (touch || e.buttons !== 1 || pressX.current === null) return;
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

  // Release: carry a flick a little further, then settle the nearest hour in the middle.
  function onDragEnd(_: unknown, info: PanInfo) {
    const flick = reduced ? 0 : info.velocity.x * FLICK_SECONDS;
    const hour = hourAtOffset(x.get() + flick);
    void controls.start({ x: centreOffset(hour), transition: springs.gentle });
    if (hour !== selectedHour) onSelect(hour);
  }

  return (
    <div className="flex flex-col gap-1" {...{ [KEEP_DETAILS_ATTR]: '' }}>
      <div
        ref={viewport}
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
        className={`relative select-none rounded-md ${touch ? '-my-1.5 overflow-hidden py-1.5' : ''}`}
      >
        <m.div
          animate={controls}
          drag={touch ? 'x' : false}
          dragConstraints={viewport}
          dragElastic={0.1}
          dragMomentum={!reduced}
          onDragStart={() => {
            scrubbing.current = true;
          }}
          onDragEnd={onDragEnd}
          style={touch ? { x, width: STRIP_PX, touchAction: 'pan-y' } : undefined}
          className="relative"
        >
          <div className="relative" data-strip-frame="">
            <div className="flex h-11 gap-px">
              {hours.map((hour, i) => (
                <m.div
                  key={hour.hour}
                  data-hour={hour.hour}
                  initial={intro ? { scaleY: 0 } : false}
                  animate={{
                    scaleY: 1,
                    transition: {
                      ...springs.snappy,
                      delay: intro ? i * firstResult.hourStagger : 0,
                    },
                  }}
                  whileHover={touch || reduced ? undefined : { y: -2 }}
                  onClick={() => {
                    // The click that ends a scrub must not re-select the cell it was released on.
                    if (scrubbing.current) scrubbing.current = false;
                    else onSelect(hour.hour);
                  }}
                  className={`flex flex-1 cursor-pointer items-center justify-center rounded-sm ${VERDICT_FILL_CLASS[hour.verdict]} ${
                    hour.hour === selectedHour
                      ? 'ring-2 ring-text ring-offset-2 ring-offset-bg'
                      : ''
                  }`}
                  style={{
                    transformOrigin: 'bottom',
                    ...(hour.isPast ? { opacity: 'var(--color-past-opacity)' } : null),
                  }}
                >
                  <HourGlyph kind={hour.verdict} />
                </m.div>
              ))}
            </div>
            {best && (
              <BestFrame
                best={best}
                freeStart={freeTime.start}
                intro={intro}
                searching={searching}
                snapped={snapped}
                onSnapped={() => setSnapped(true)}
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
          <div aria-hidden="true" className="relative mt-1 h-4 text-xs text-text-muted">
            {LABEL_HOURS.map((hour) => (
              <span key={hour} className="absolute" style={{ left: pct(hour) }}>
                {String(hour).padStart(2, '0')}
              </span>
            ))}
          </div>
        </m.div>
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
