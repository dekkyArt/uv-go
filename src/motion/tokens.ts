/** Starting motion values; tuned in the polish stage (ТЗ 10.1). */
export const springs = {
  snappy: { type: 'spring', stiffness: 500, damping: 35 },
  gentle: { type: 'spring', stiffness: 220, damping: 28 },
  bouncy: { type: 'spring', stiffness: 400, damping: 18 },
  sheet: { type: 'spring', duration: 0.45, bounce: 0.08 },
} as const;

export const durations = { fast: 0.15, base: 0.3, slow: 0.6 } as const;

export const ease = [0.22, 1, 0.36, 1] as const;
