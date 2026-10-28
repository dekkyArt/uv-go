/** iOS-style springs (spec 5.1): `duration` is the settle time, `bounce` the overshoot. */
export const springs = {
  /** Most transitions. */
  smooth: { type: 'spring', duration: 0.5, bounce: 0 },
  /** Presses and "pills". */
  snappy: { type: 'spring', duration: 0.3, bounce: 0.15 },
  /** Sheets and the day pager. */
  sheet: { type: 'spring', duration: 0.45, bounce: 0.08 },
} as const;

export const durations = { fast: 0.15, base: 0.3, slow: 0.6 } as const;

export const ease = [0.22, 1, 0.36, 1] as const;
