import { describe, expect, it } from 'vitest';
import type { DurationMin, Inputs, TimeWindow } from '../types';
import {
  buildWindows,
  earliestStartHour,
  formatWindowLabel,
  pickBestWindow,
  windowLength,
} from '../windows';
import { makeDay, scored } from './factories';

function inputs(start: number, end: number, duration: DurationMin): Inputs {
  return { day: 'today', freeTime: { start, end }, duration, activity: 'relaxed' };
}

function build(
  overrides: Parameters<typeof makeDay>[0],
  start: number,
  end: number,
  duration: DurationMin,
  now: { hour: number; minute: number } | null = null,
) {
  const hours = scored(makeDay(overrides), 'relaxed');
  return buildWindows(hours, inputs(start, end, duration), now);
}

const starts = (ws: TimeWindow[]) => ws.map((w) => w.startHour);

describe('windowLength', () => {
  it.each([
    [30, 1],
    [60, 1],
    [120, 2],
    [180, 3],
  ] as const)('%s min -> %s h', (d, n) => {
    expect(windowLength(d)).toBe(n);
  });
});

describe('earliestStartHour', () => {
  it('null -> 0', () => expect(earliestStartHour(null)).toBe(0));
  it('on the hour stays', () => expect(earliestStartHour({ hour: 14, minute: 0 })).toBe(14));
  it('rounds up', () => expect(earliestStartHour({ hour: 14, minute: 10 })).toBe(15));
});

describe('formatWindowLabel', () => {
  it.each([
    [17, 30, '17:00–17:30'],
    [17, 60, '17:00–18:00'],
    [16, 180, '16:00–19:00'],
    [23, 60, '23:00–24:00'],
  ] as const)('(%s, %s) -> %s', (start, d, label) => {
    expect(formatWindowLabel(start, d)).toBe(label);
  });
});

describe('buildWindows', () => {
  it('free time end is exclusive', () => {
    const { windows, emptyReason } = build({}, 13, 19, 60);
    expect(starts(windows)).toEqual([13, 14, 15, 16, 17, 18]);
    expect(emptyReason).toBeNull();
  });

  it('3h windows', () => {
    expect(starts(build({}, 13, 19, 180).windows)).toEqual([13, 14, 15, 16]);
  });

  it('fills label and hours', () => {
    const [w] = build({}, 13, 19, 120).windows;
    expect(w.label).toBe('13:00–15:00');
    expect(w.hours.map((h) => h.hour)).toEqual([13, 14]);
  });

  it('too-short', () => {
    expect(build({}, 13, 14, 120)).toEqual({ windows: [], emptyReason: 'too-short' });
  });

  it('dark', () => {
    const dark = Object.fromEntries([19, 20, 21, 22, 23].map((h) => [h, { isDay: false }]));
    expect(build(dark, 20, 23, 60)).toEqual({ windows: [], emptyReason: 'dark' });
  });

  it('past', () => {
    expect(build({}, 13, 19, 60, { hour: 20, minute: 0 })).toEqual({
      windows: [],
      emptyReason: 'past',
    });
  });

  it('precedence: too-short wins over dark and past', () => {
    const allDark = Object.fromEntries(Array.from({ length: 24 }, (_, h) => [h, { isDay: false }]));
    expect(build(allDark, 13, 14, 120, { hour: 23, minute: 0 }).emptyReason).toBe('too-short');
  });

  it('now inside free time', () => {
    const { windows } = build({}, 13, 19, 60, { hour: 14, minute: 10 });
    expect(starts(windows)).toEqual([15, 16, 17, 18]);
  });

  it('window with a dark hour is skipped', () => {
    expect(starts(build({ 19: { isDay: false } }, 17, 21, 120).windows)).toEqual([17]);
  });

  it('score is average, verdict rounds', () => {
    // hour 13: uv 3 -> 2 pts; hour 14: wind 40 -> 3 pts
    const { windows } = build({ 13: { uv: 3 }, 14: { windKmh: 40 } }, 13, 15, 120);
    expect(windows).toHaveLength(1);
    expect(windows[0].score).toBe(2.5);
    expect(windows[0].verdict).toBe('yellow');
  });
});

function win(startHour: number, scores: number[]): TimeWindow {
  const hours = scores.map((score, i) => ({ hour: startHour + i, score })) as never;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  return { startHour, hours, score: mean, verdict: 'green', label: '' };
}

describe('pickBestWindow', () => {
  it('minimum score wins', () => {
    const ws = [win(10, [3]), win(11, [1]), win(12, [1])];
    expect(pickBestWindow(ws)?.startHour).toBe(11);
  });

  it('equal score: lower max hour score wins', () => {
    const ws = [win(10, [0, 4]), win(11, [2, 2])];
    expect(pickBestWindow(ws)?.startHour).toBe(11);
  });

  it('full tie: earlier start wins', () => {
    const ws = [win(12, [2, 2]), win(10, [2, 2]), win(11, [2, 2])];
    expect(pickBestWindow(ws)?.startHour).toBe(10);
  });

  it('empty -> null', () => {
    expect(pickBestWindow([])).toBeNull();
  });
});
