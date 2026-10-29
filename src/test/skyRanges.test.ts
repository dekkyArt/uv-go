import { describe, expect, it } from 'vitest';
import { skyRanges } from '../components/skyRanges';
import { articlePhase } from '../domain/sky';
import type { SkyPhase } from '../domain/sky';

describe('skyRanges', () => {
  const MINUTES_PER_DAY = 24 * 60;

  function phaseFromRanges(ranges: readonly (readonly [number, SkyPhase])[], minute: number) {
    let phase = ranges[0][1];
    for (const [from, name] of ranges) if (minute >= from) phase = name;
    return phase;
  }

  it('agrees with articlePhase on every minute of the day', () => {
    const ranges = skyRanges();
    for (let minute = 0; minute < MINUTES_PER_DAY; minute++) {
      expect(phaseFromRanges(ranges, minute)).toBe(
        articlePhase(Math.floor(minute / 60), minute % 60),
      );
    }
  });

  it('starts at midnight and lists each boundary once, in order', () => {
    const ranges = skyRanges();
    expect(ranges[0][0]).toBe(0);
    expect(ranges.map(([, phase]) => phase)).toEqual([
      'night',
      'dawn',
      'morning',
      'day',
      'golden',
      'dusk',
      'night',
    ]);
    expect(ranges.map(([from]) => from)).toEqual(
      [...ranges.map(([from]) => from)].sort((a, b) => a - b),
    );
  });
});
