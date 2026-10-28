import { describe, expect, it } from 'vitest';
import lisbon from '../../data/__fixtures__/lisbon.json';
import { mapForecast } from '../../data/openMeteo';
import { evaluate } from '../../domain/evaluate';
import { makeDay, scored } from '../../domain/__tests__/factories';
import type { DayForecast, HourData } from '../../domain/types';
import { cellName, metricValue, spanOf, stripItems, type StripItem } from '../cards/stripItems';
import { CELL_W } from '../ui';

const day = mapForecast(lisbon).days[0];
const hoursOf = (d: DayForecast) =>
  evaluate(
    d,
    { day: 'today', freeTime: { start: 9, end: 17 }, duration: 60, activity: 'relaxed' },
    null,
  ).scoredHours;

const suns = (items: StripItem[]) => items.filter((i) => i.kind === 'sun');

describe('stripItems', () => {
  const items = stripItems(day, hoursOf(day));

  it('is 24 hours plus sunrise and sunset', () => {
    expect(items).toHaveLength(26);
    expect(items.filter((i) => i.kind === 'hour')).toHaveLength(24);
  });

  it('puts each event right after the hour it happened in, with its HH:MM', () => {
    // Lisbon: sunrise 06:58, sunset 17:42
    const rise = items.findIndex((i) => i.kind === 'sun' && i.event === 'sunrise');
    const set = items.findIndex((i) => i.kind === 'sun' && i.event === 'sunset');
    const before = (i: number) => items[i - 1];
    expect(before(rise)).toMatchObject({ kind: 'hour', hour: { hour: 6 } });
    expect(items[rise + 1]).toMatchObject({ kind: 'hour', hour: { hour: 7 } });
    expect(items[rise]).toMatchObject({ time: '06:58' });
    expect(before(set)).toMatchObject({ kind: 'hour', hour: { hour: 17 } });
    expect(items[set]).toMatchObject({ time: '17:42' });
  });

  it.each([
    ['sunrise equals sunset', '2026-10-27T12:00', '2026-10-27T12:00'],
    ['sunrise after sunset', '2026-10-27T18:00', '2026-10-27T06:00'],
    ['both empty', '', ''],
    ['sunrise empty', '', '2026-10-27T18:00'],
    ['another day', '2026-10-28T06:30', '2026-10-28T19:30'],
    ['different dates', '2026-10-27T06:30', '2026-10-28T19:30'],
    ['impossible clock', '2026-10-27T06:75', '2026-10-27T25:00'],
  ])('has no sun cells when %s', (_name, sunrise, sunset) => {
    const d = makeDay({}, { sunrise, sunset });
    const result = stripItems(d, hoursOf(d));
    expect(suns(result)).toHaveLength(0);
    expect(result).toHaveLength(24);
  });

  it('skips only the broken event pair, never throws on bare HH:MM', () => {
    const d = makeDay({}, { sunrise: '06:30', sunset: '19:30' });
    expect(suns(stripItems(d, hoursOf(d)))).toHaveLength(2);
  });
});

function hourWith(p: Partial<HourData>) {
  const d = makeDay({ 14: p });
  return scored(d, 'relaxed')[14];
}

describe('metricValue', () => {
  it('formats UV, rain and feels-like', () => {
    expect(metricValue(hourWith({ uv: 5.4 }), 'uv')).toBe('5');
    expect(metricValue(hourWith({ rainProb: 30 }), 'rain')).toBe('30%');
    expect(metricValue(hourWith({ feelsLike: 23.5 }), 'feels')).toBe('24°');
  });

  it.each(['uv', 'rain', 'feels'] as const)('shows a dash for null %s', (metric) => {
    const hour = hourWith({ uv: null, rainProb: null, feelsLike: null });
    expect(metricValue(hour, metric)).toBe('–');
  });
});

describe('cellName', () => {
  it('names a day hour with UV, rain and the verdict', () => {
    expect(cellName(hourWith({ uv: 5.4, rainProb: 30 }))).toBe(
      '14:00, UV 5, rain 30%, OK with protection',
    );
  });

  it('names a night hour', () => {
    const night = scored(makeDay({ 3: { isDay: false } }), 'relaxed')[3];
    expect(cellName(night)).toBe('03:00, UV 0, rain 0%, Night');
  });

  it('says "no data" for null UV and rain', () => {
    const name = cellName(hourWith({ uv: null, rainProb: null }));
    expect(name).toContain('UV no data, rain no data');
    expect(name).not.toContain('null');
  });
});

describe('spanOf', () => {
  it('counts the sun cell before the range and measures hours only inside it', () => {
    // 12 hour cells (0..11) + sunrise after 6 -> hour 13 is at index 14
    const d = makeDay({}, { sunrise: '2026-10-27T06:30', sunset: '2026-10-27T19:30' });
    const list = stripItems(d, hoursOf(d));
    const span = spanOf(list, 13, 16);
    expect(span).toEqual({ left: 14 * CELL_W, width: 3 * CELL_W });
  });

  it('includes a sun cell inside the range', () => {
    const d = makeDay({}, { sunrise: '2026-10-27T06:30', sunset: '2026-10-27T19:30' });
    expect(spanOf(stripItems(d, hoursOf(d)), 6, 9)).toEqual({
      left: 6 * CELL_W,
      width: 4 * CELL_W,
    });
  });

  it('returns null when no hour falls in the range', () => {
    const d = makeDay();
    expect(spanOf(stripItems(d, hoursOf(d)), 10, 10)).toBeNull();
  });
});
