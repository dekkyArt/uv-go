import { useReducedMotion } from 'motion/react';
import { springs } from './tokens';

const PRESS = { whileTap: { scale: 0.97 }, transition: springs.snappy } as const;

/**
 * Props for a pressable `m.*` element (spec 5.6): it gives a little under the finger. None with
 * reduced motion. `whileTap` makes a non-focusable element focusable unless it has a tabindex.
 */
export function usePress(): Partial<typeof PRESS> {
  const reduced = useReducedMotion() ?? false;
  return reduced ? {} : PRESS;
}
