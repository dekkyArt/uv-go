import { useLayoutEffect, useRef, type RefObject } from 'react';
import { durations } from '../../motion/tokens';

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

interface Options {
  /** First result: count up from 0 once `delay` seconds have passed. */
  intro: boolean;
  delay: number;
  /** Reduced motion: always show the final value. */
  reduced: boolean;
}

/**
 * Writes `value` into the element's text, counting up from the value it showed before
 * (from 0 on the intro). A small rAF tween instead of Motion's `animate()`, which would add
 * several KB to the bundle. The element must have no React children: the text is ours.
 */
export function useCountUp(
  ref: RefObject<HTMLElement | null>,
  value: number,
  { intro, delay, reduced }: Options,
): void {
  const shown = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const from = shown.current ?? (intro ? 0 : value);
    if (reduced || from === value) {
      el.textContent = String(value);
      shown.current = value;
      return;
    }

    el.textContent = String(from);
    let frame = 0;
    let startedAt = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / (durations.base * 1000));
      const current = Math.round(from + (value - from) * easeOutCubic(t));
      el.textContent = String(current);
      shown.current = current;
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    const wait = shown.current === null ? delay * 1000 : 0;
    const timer = setTimeout(() => {
      startedAt = performance.now();
      frame = requestAnimationFrame(tick);
    }, wait);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [ref, value, intro, delay, reduced]);
}
