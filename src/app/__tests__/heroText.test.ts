import { describe, expect, it } from 'vitest';
import { YOUR_LOCATION_ID, yourLocationPlace } from '../../data/geolocation';
import type { Place } from '../../data/types';
import type { ScoredHour } from '../../domain/types';
import { makeWindow } from '../../domain/__tests__/factories';
import { windowVerdictLabel, windowUvLine, nowLine, placeTitle } from '../hero/heroText';

function hour(h: number, over: Partial<ScoredHour> = {}): ScoredHour {
  return {
    time: `2026-10-27T${String(h).padStart(2, '0')}:00`,
    hour: h,
    uv: 0,
    rainProb: 0,
    feelsLike: 20,
    windKmh: 5,
    isDay: true,
    weatherCode: 0,
    cloudCover: 0,
    points: { uv: 0, rain: 0, heat: 0, cold: 0, wind: 0 },
    noData: [],
    score: 0,
    verdict: 'green',
    isPast: false,
    inFreeTime: false,
    ...over,
  };
}

describe('nowLine', () => {
  it('today labels the daylight peak even without a clock', () => {
    const hours = [hour(9), hour(10, { uv: 5.6, feelsLike: 23.6 }), hour(11, { uv: 8 })];
    expect(nowLine(hours, 'today')).toBe('Today’s peak UV 8 · Feels 20–24°');
  });

  it('tomorrow shows the peak UV and the feels-like range over daylight hours only', () => {
    const hours = [
      hour(3, { isDay: false, uv: 9, feelsLike: 2 }),
      hour(9, { uv: 3, feelsLike: 18 }),
      hour(13, { uv: 6.6, feelsLike: 24 }),
      hour(15, { uv: 5, feelsLike: 21 }),
      hour(22, { isDay: false, uv: 9, feelsLike: 30 }),
    ];
    expect(nowLine(hours, 'tomorrow')).toBe('Tomorrow’s peak UV 7 · Feels 18–24°');
  });

  it('tomorrow without UV shows only the range, and nothing without any value', () => {
    const noUv = [hour(9, { uv: null, feelsLike: 18 }), hour(13, { uv: null, feelsLike: 24 })];
    expect(nowLine(noUv, 'tomorrow')).toBe('Feels 18–24°');
    const nothing = [hour(9, { uv: null, feelsLike: null })];
    expect(nowLine(nothing, 'tomorrow')).toBe('');
  });

  it('tomorrow with a single feels-like value does not print a range', () => {
    const hours = [hour(9, { uv: 2, feelsLike: 20 }), hour(13, { uv: 2, feelsLike: 20.2 })];
    expect(nowLine(hours, 'tomorrow')).toBe('Tomorrow’s peak UV 2 · Feels 20°');
  });
});

describe('placeTitle', () => {
  it('names the geolocated place "My location"', () => {
    expect(placeTitle(yourLocationPlace(38.7, -9.1))).toEqual({ name: 'My location', mine: true });
    expect(YOUR_LOCATION_ID).toBe(-1);
  });

  it('uses the city name otherwise', () => {
    const lisbon: Place = {
      id: 2267057,
      name: 'Lisbon',
      admin1: 'Lisbon',
      country: 'Portugal',
      lat: 38.72,
      lon: -9.14,
    };
    expect(placeTitle(lisbon)).toEqual({ name: 'Lisbon', mine: false });
  });
});

describe('outing context', () => {
  it('names heat alone without implying UV protection', () => {
    const w = makeWindow({ 9: { uv: 2, feelsLike: 32 } });
    w.verdict = 'yellow';
    expect(windowVerdictLabel(w)).toBe('Hot — take precautions');
    expect(windowUvLine(w)).toBe('UV 2 during your outing');
  });
  it('preserves mixed-risk and red verdicts', () => {
    const w = makeWindow({ 9: { uv: 3, feelsLike: 32 } });
    w.verdict = 'yellow';
    expect(windowVerdictLabel(w)).toBe('OK with protection');
    w.verdict = 'red';
    expect(windowVerdictLabel(w)).toBe('Not recommended');
  });
  it('uses the window maximum and omits unavailable UV', () => {
    expect(windowUvLine(makeWindow({ 9: { uv: 2 }, 10: { uv: 3.6 } }))).toBe(
      'UV 4 during your outing',
    );
    expect(windowUvLine(makeWindow({ 9: { uv: null } }))).toBe('');
  });
});
