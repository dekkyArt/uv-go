import { describe, expect, it } from 'vitest';
import { evaluate } from '../evaluate';
import type { DurationMin, Inputs } from '../types';
import { makeDay } from './factories';

const UV_BY_HOUR = { 13: 7, 14: 6, 15: 5, 16: 4, 17: 3, 18: 1 };

function dayWithUv() {
  return makeDay(Object.fromEntries(Object.entries(UV_BY_HOUR).map(([h, uv]) => [h, { uv }])));
}

function inputs(start = 13, end = 19, duration: DurationMin = 60): Inputs {
  return { day: 'today', freeTime: { start, end }, duration, activity: 'relaxed' };
}

describe('evaluate', () => {
  it('picks the best window with reason and checklist', () => {
    const result = evaluate(dayWithUv(), inputs(), null);
    expect(result.best?.label).toBe('18:00–19:00');
    expect(result.best?.verdict).toBe('green');
    expect(result.emptyReason).toBeNull();
    expect(result.reason).toBe('No points from available forecast data');
    expect(result.checklist).toEqual([]);
  });

  it('returns 24 scored hours, night hours marked', () => {
    const result = evaluate(dayWithUv(), inputs(), null);
    expect(result.scoredHours).toHaveLength(24);
    expect(result.scoredHours[3].verdict).toBe('night');
  });

  it('sets isPast from now and inFreeTime from free time (end exclusive)', () => {
    const { scoredHours } = evaluate(dayWithUv(), inputs(), { hour: 15, minute: 30 });
    expect(scoredHours[14].isPast).toBe(true);
    expect(scoredHours[15].isPast).toBe(false);
    for (const h of [13, 14, 15, 16, 17, 18]) expect(scoredHours[h].inFreeTime).toBe(true);
    expect(scoredHours[19].inFreeTime).toBe(false);
    expect(scoredHours[12].inFreeTime).toBe(false);
  });

  it('never marks hours as past when now is null', () => {
    const { scoredHours } = evaluate(dayWithUv(), inputs(), null);
    expect(scoredHours.every((h) => !h.isPast)).toBe(true);
  });

  it('returns an empty result with the reason when no window fits', () => {
    const result = evaluate(dayWithUv(), inputs(13, 14, 120), null);
    expect(result.best).toBeNull();
    expect(result.reason).toBeNull();
    expect(result.checklist).toEqual([]);
    expect(result.emptyReason).toBe('too-short');
  });
});
