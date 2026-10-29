import { AnimatePresence, m, useReducedMotion, type Variants } from 'motion/react';
import { useState } from 'react';
import { durations, springs } from '../../motion/tokens';

/** How far a digit travels, how blurred it gets, and the settle time of the spring (spec 5.5). */
const SHIFT_EM = 0.6;
const BLUR = 'blur(4px)';
const ROLL_DURATION = 0.35;
/** Neighbouring changed characters start this much later, one after another. */
const NEIGHBOUR_LAG = 0.03;

export interface RollPart {
  char: string;
  changed: boolean;
}

/** Splits `next` into characters and marks those that differ from `prev` at the same position. */
export function rollParts(prev: string, next: string): RollPart[] {
  const sameLength = prev.length === next.length;
  return [...next].map((char, i) => ({ char, changed: !sameLength || prev[i] !== char }));
}

const firstNumber = (s: string): number | null => {
  const digits = /\d+/.exec(s);
  return digits ? parseInt(digits[0], 10) : null;
};

/** 1 (roll up) when the new number is larger or the numbers cannot be compared, else -1. */
export function rollDirection(prev: string, next: string): 1 | -1 {
  const a = firstNumber(prev);
  const b = firstNumber(next);
  return a !== null && b !== null && b < a ? -1 : 1;
}

interface RollCustom {
  dir: 1 | -1;
  delay: number;
  reduced: boolean;
}

/** With reduced motion only the opacity changes: a short crossfade, no shift and no blur. */
const variants: Variants = {
  from: ({ dir, reduced }: RollCustom) =>
    reduced ? { opacity: 0 } : { opacity: 0, y: `${dir * SHIFT_EM}em`, filter: BLUR },
  to: ({ delay, reduced }: RollCustom) =>
    reduced
      ? { opacity: 1, transition: { duration: durations.fast } }
      : {
          opacity: 1,
          y: '0em',
          filter: 'blur(0px)',
          transition: { ...springs.smooth, duration: ROLL_DURATION, delay },
          // No filter left behind: even blur(0px) keeps the digit on its own layer.
          transitionEnd: { filter: 'none' },
        },
  out: ({ dir, delay, reduced }: RollCustom) =>
    reduced
      ? { opacity: 0, transition: { duration: durations.fast } }
      : {
          opacity: 0,
          y: `${-dir * SHIFT_EM}em`,
          filter: BLUR,
          transition: { ...springs.smooth, duration: ROLL_DURATION, delay },
        },
};

interface NumericRollProps {
  value: string;
  className?: string;
}

/**
 * A string whose changed characters roll up or down when `value` changes, like iOS Weather; the
 * rest stay put. Each character sits in a one-line clipped slot, so the roll never changes the
 * line height or the width. Nothing rolls on the first render. The text itself lives once, in a
 * screen-reader-only node; a character is drawn from its `data-char`, so the rolling digits
 * never double the element's text.
 */
export function NumericRoll({ value, className }: NumericRollProps) {
  const reduced = useReducedMotion() ?? false;
  // The previous value, derived while rendering so it survives a strict-mode double render.
  const [track, setTrack] = useState<{ value: string; prev: string | null }>({
    value,
    prev: null,
  });
  if (track.value !== value) setTrack({ value, prev: track.value });
  const { prev } = track;

  const parts = rollParts(prev ?? value, value);
  const dir = rollDirection(prev ?? value, value);
  let order = 0;
  return (
    <span className={`relative whitespace-nowrap ${className ?? ''}`}>
      {/* The value as plain text for assistive tech (and for textContent): an aria-label on a
          bare span is prohibited. The characters below only draw it, from data-char. */}
      <span className="sr-only">{value}</span>
      {parts.map(({ char, changed }, i) => {
        const roll = prev !== null && changed;
        const delay = roll ? order++ * NEIGHBOUR_LAG : 0;
        const custom: RollCustom = { dir, delay, reduced };
        return (
          // Padding and a negative margin of the same size give the clip some air above and
          // below the glyph without moving the line.
          <span
            key={i}
            aria-hidden="true"
            className="relative -my-[0.1em] inline-block overflow-hidden whitespace-pre py-[0.1em] align-top"
          >
            <AnimatePresence mode="popLayout" initial={false} custom={custom}>
              <m.span
                key={`${i}-${char}`}
                custom={custom}
                variants={variants}
                initial={roll ? 'from' : false}
                animate={roll ? 'to' : undefined}
                exit="out"
                data-char={char}
                {...(roll ? { 'data-rolling': '' } : null)}
                className="inline-block after:content-[attr(data-char)]"
              />
            </AnimatePresence>
          </span>
        );
      })}
    </span>
  );
}
