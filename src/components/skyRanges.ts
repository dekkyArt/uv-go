import { articlePhase } from '../domain/sky';
import type { SkyPhase } from '../domain/sky';

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

/**
 * Phase boundaries of an article day, as [first minute of the day, phase] pairs. Taken from
 * articlePhase() at build time, so the inline script in SkyScript.astro needs no sky logic.
 */
export function skyRanges(): [number, SkyPhase][] {
  const ranges: [number, SkyPhase][] = [];
  for (let minute = 0; minute < MINUTES_PER_DAY; minute++) {
    const phase = articlePhase(Math.floor(minute / MINUTES_PER_HOUR), minute % MINUTES_PER_HOUR);
    if (ranges.length === 0 || ranges[ranges.length - 1][1] !== phase) ranges.push([minute, phase]);
  }
  return ranges;
}
