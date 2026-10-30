import {
  m,
  useMotionValue,
  useReducedMotion,
  type MotionStyle,
  type MotionValue,
  type ValueAnimationTransition,
} from 'motion/react';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import type { Inputs } from '../../domain/types';
import { durations, ease, springs } from '../../motion/tokens';

/** A swipe switches the day at a quarter of the width, or faster than this (px/s). */
const SWITCH_FRACTION = 0.25;
const SWITCH_VELOCITY = 500;
/** Travel before the gesture picks an axis, and the steepest angle still taken as horizontal. */
const LOCK_DISTANCE = 10;
const MAX_ANGLE = Math.PI / 6;
/** Past the first or last page the content follows the finger only this far. */
const EDGE_RESISTANCE = 0.3;
/** The velocity is measured over the last part of the gesture. */
const VELOCITY_WINDOW_MS = 100;
/** The click that ends a swipe is swallowed for this long. */
const CLICK_GUARD_MS = 100;
/** Leaving a page is quicker than arriving on the next one. */
const EXIT_SPRING = { ...springs.sheet, duration: 0.3 } as const;

/** Where a released swipe lands: left (negative) is Tomorrow, right is Today, never past an edge. */
export function pagerDecision(
  offsetX: number,
  velocityX: number,
  width: number,
  day: Inputs['day'],
): Inputs['day'] {
  const fling = Math.abs(velocityX) > SWITCH_VELOCITY;
  if (!fling && Math.abs(offsetX) < SWITCH_FRACTION * width) return day;
  // A fling decides the direction; with a slow release the distance does.
  return (fling ? velocityX : offsetX) < 0 ? 'tomorrow' : 'today';
}

/** The axis of a gesture once it has travelled 10 px; steeper than 30 degrees is vertical. */
export function lockAxis(dx: number, dy: number): 'x' | 'y' | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < LOCK_DISTANCE) return null;
  return Math.atan2(Math.abs(dy), Math.abs(dx)) > MAX_ANGLE ? 'y' : 'x';
}

/** Drag past the first or last page resists the finger. */
export function rubberBand(offset: number, atEdge: boolean): number {
  return atEdge ? offset * EDGE_RESISTANCE : offset;
}

interface Gesture {
  id: number;
  startX: number;
  startY: number;
  axis: 'x' | null;
  /** The finger's x where the drag began, and the content's x at that moment. */
  originX: number;
  baseX: number;
  width: number;
  lastOffset: number;
  samples: { t: number; x: number }[];
}

interface Stoppable {
  stop(): void;
}

/**
 * `animate` is loaded with the lazy features, so a value starts moving a microtask later. The
 * handle stops it either way; a stopped animation does not call `onComplete`.
 */
function animateTo(
  value: MotionValue<number>,
  to: number,
  transition: ValueAnimationTransition<number>,
  onComplete?: () => void,
): Stoppable {
  let controls: Stoppable | null = null;
  let stopped = false;
  void import('../../motion/features')
    .then(({ animate }) => {
      if (stopped) return;
      controls = animate(value, to, { ...transition, onComplete });
    })
    .catch(() => {
      // The features chunk did not load: snap to the end so nothing waits on this forever.
      if (stopped) return;
      value.set(to);
      onComplete?.();
    });
  return {
    stop() {
      stopped = true;
      controls?.stop();
    },
  };
}

const progressOf = (day: Inputs['day']) => (day === 'tomorrow' ? 1 : 0);

interface Props {
  day: Inputs['day'];
  onDay(d: Inputs['day']): void;
  /** Off on desktop and with reduced motion: no swipe, the dots and arrow keys still work. */
  enabled: boolean;
  /** 0 (Today) to 1 (Tomorrow); follows the finger during a swipe, the sky reads it. */
  progress: MotionValue<number>;
  className?: string;
  children: ReactNode;
}

/**
 * Today and Tomorrow are one page whose content changes with the day. On a touch device a
 * horizontal swipe drags it sideways; on release it slides off, the day changes and the new
 * content slides in from the other side. Vertical gestures stay with native scrolling.
 *
 * With reduced motion the day change is a short fade instead.
 */
export function DayPager({ day, onDay, enabled, progress, className, children }: Props) {
  const reduced = useReducedMotion() ?? false;
  const x = useMotionValue(0);
  const opacity = useMotionValue(1);

  const gesture = useRef<Gesture | null>(null);
  const running = useRef<Stoppable | null>(null);
  const progressMotion = useRef<Stoppable | null>(null);
  /** Set from the start of a drag until the new page has settled; a new swipe waits for it. */
  const busy = useRef(false);
  /** While set, `progress` follows `x` from `base` (the page the drag started on). */
  const drive = useRef<{ base: number; width: number } | null>(null);
  /** The x the incoming page starts from, once the day has changed after a swipe. */
  const entering = useRef<number | null>(null);
  const swiped = useRef(false);
  const clickGuard = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The day as last rendered, for animation callbacks that outlive a render. */
  const dayRef = useRef(day);

  useEffect(
    () =>
      x.on('change', (value) => {
        const d = drive.current;
        if (d) progress.set(Math.min(1, Math.max(0, d.base - value / d.width)));
      }),
    [x, progress],
  );

  useEffect(
    () => () => {
      running.current?.stop();
      progressMotion.current?.stop();
      if (clickGuard.current !== null) clearTimeout(clickGuard.current);
    },
    [],
  );
  // Leaving swipe mode (rotation, resize past 1024 px) drops whatever is in flight.
  useLayoutEffect(() => {
    if (enabled) return;
    running.current?.stop();
    gesture.current = null;
    busy.current = false;
    drive.current = null;
    entering.current = null;
    x.set(0);
  }, [enabled, x]);

  /** The new page arrives from `from`, the off-screen side the old one left towards. */
  function bringIn(from: number, forDay: Inputs['day']) {
    drive.current = null;
    progress.set(progressOf(forDay));
    x.set(from);
    running.current = animateTo(x, 0, springs.sheet, () => {
      busy.current = false;
    });
  }

  // After a swipe the day has changed under the off-screen content: bring the new page in.
  useLayoutEffect(() => {
    dayRef.current = day;
    const from = entering.current;
    if (from === null) return;
    entering.current = null;
    bringIn(from, day);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  // The day changed from outside (dots, arrow keys, auto-switch): the progress follows.
  useEffect(() => {
    if (gesture.current?.axis === 'x') return;
    const target = progressOf(day);
    if (progress.get() === target) return;
    progressMotion.current?.stop();
    if (reduced) progress.set(target);
    else progressMotion.current = animateTo(progress, target, springs.smooth);
  }, [day, progress, reduced]);

  // Reduced motion: the content changes at once and fades back in.
  const shownDay = useRef(day);
  useLayoutEffect(() => {
    if (shownDay.current === day) return;
    shownDay.current = day;
    if (!reduced) return;
    opacity.set(0);
    const fade = animateTo(opacity, 1, { duration: durations.fast, ease });
    return () => fade.stop();
  }, [day, reduced, opacity]);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' || busy.current || gesture.current) return;
    swiped.current = false;
    if (e.target instanceof Element && e.target.closest('[data-hourly-strip]')) return;
    // A finger on a springing-back page takes it over where it is.
    running.current?.stop();
    drive.current = null;
    gesture.current = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      axis: null,
      originX: e.clientX,
      baseX: x.get(),
      width: e.currentTarget.clientWidth,
      lastOffset: 0,
      samples: [],
    };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g || e.pointerId !== g.id) return;
    if (g.axis === null) {
      const axis = lockAxis(e.clientX - g.startX, e.clientY - g.startY);
      if (axis === null) return;
      if (axis === 'y') {
        gesture.current = null;
        return;
      }
      g.axis = 'x';
      g.originX = e.clientX;
      swiped.current = true;
      busy.current = true;
      drive.current = { base: progressOf(day), width: g.width };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // No active pointer to capture (a synthetic event): the events still bubble up.
      }
    }
    const offset = e.clientX - g.originX + g.baseX;
    g.lastOffset = offset;
    g.samples.push({ t: e.timeStamp, x: e.clientX });
    while (g.samples.length > 2 && e.timeStamp - g.samples[0].t > VELOCITY_WINDOW_MS)
      g.samples.shift();
    const atEdge = day === 'today' ? offset > 0 : offset < 0;
    x.set(Math.max(-g.width, Math.min(g.width, rubberBand(offset, atEdge))));
  }

  function release(e: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) {
    const g = gesture.current;
    if (!g || e.pointerId !== g.id) return;
    gesture.current = null;
    if (g.axis !== 'x') return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Nothing was captured.
    }
    if (clickGuard.current !== null) clearTimeout(clickGuard.current);
    clickGuard.current = setTimeout(() => {
      swiped.current = false;
    }, CLICK_GUARD_MS);

    const first = g.samples[0];
    const last = g.samples[g.samples.length - 1];
    const dt = last && first ? last.t - first.t : 0;
    const fresh = last !== undefined && e.timeStamp - last.t <= VELOCITY_WINDOW_MS;
    const velocity = fresh && dt > 0 ? ((last.x - first.x) / dt) * 1000 : 0;

    const next = cancelled ? day : pagerDecision(g.lastOffset, velocity, g.width, day);
    if (next === day) {
      running.current = animateTo(x, 0, { ...springs.sheet, velocity }, () => {
        drive.current = null;
        busy.current = false;
      });
      return;
    }
    // Off to the side it was swiped towards, then the day changes and the next page arrives.
    const dir = next === 'tomorrow' ? -1 : 1;
    running.current = animateTo(x, dir * g.width, { ...EXIT_SPRING, velocity }, () => {
      const from = -dir * g.width;
      // The day may already have moved on its own (dots, auto-switch) during the exit: no render
      // follows then, so the new page comes in from here.
      if (dayRef.current === next) {
        bringIn(from, next);
      } else {
        entering.current = from;
        onDay(next);
      }
    });
  }

  // No overflow clip here: it would cut the hero scrim's feathered sides. The page clips sideways
  // at the viewport edge instead ([data-page] in global.css).
  const style: MotionStyle = {
    ...(enabled ? { x, touchAction: 'pan-y pinch-zoom' } : null),
    ...(reduced ? { opacity } : null),
  };

  return (
    <m.div
      data-pager-enabled={enabled}
      className={className}
      style={style}
      onPointerDown={enabled ? onPointerDown : undefined}
      onPointerMove={enabled ? onPointerMove : undefined}
      onPointerUp={enabled ? (e) => release(e, false) : undefined}
      onPointerCancel={enabled ? (e) => release(e, true) : undefined}
      onClickCapture={
        enabled
          ? (e) => {
              if (!swiped.current) return;
              swiped.current = false;
              e.preventDefault();
              e.stopPropagation();
            }
          : undefined
      }
    >
      {children}
    </m.div>
  );
}
