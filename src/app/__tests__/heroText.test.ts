import { describe, expect, it } from 'vitest';
import { YOUR_LOCATION_ID, yourLocationPlace } from '../../data/geolocation';
import type { Place } from '../../data/types';
import type { NowLocal, ScoredHour } from '../../domain/types';
import { nowLine, placeTitle } from '../hero/heroText';

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

const NOW_10: NowLocal = { date: '2026-10-27', hour: 10, minute: 20 };

describe('nowLine', () => {
  it('today shows the current hour: rounded UV and feels-like', () => {
    const hours = [hour(9), hour(10, { uv: 5.6, feelsLike: 23.6 }), hour(11, { uv: 8 })];
    expect(nowLine(hours, 'today', NOW_10)).toBe('Now UV 6 · Feels 24°');
  });

  it('today without a UV value for the current hour shows only the feels-like', () => {
    const hours = [hour(10, { uv: null, feelsLike: 23.6 })];
    expect(nowLine(hours, 'today', NOW_10)).toBe('Now Feels 24°');
  });

  it('today is empty without a clock or without data for the current hour', () => {
    expect(nowLine([hour(10)], 'today', null)).toBe('');
    expect(nowLine([hour(9)], 'today', NOW_10)).toBe('');
    expect(nowLine([hour(10, { uv: null, feelsLike: null })], 'today', NOW_10)).toBe('');
  });

  it('tomorrow shows the peak UV and the feels-like range over daylight hours only', () => {
    const hours = [
      hour(3, { isDay: false, uv: 9, feelsLike: 2 }),
      hour(9, { uv: 3, feelsLike: 18 }),
      hour(13, { uv: 6.6, feelsLike: 24 }),
      hour(15, { uv: 5, feelsLike: 21 }),
      hour(22, { isDay: false, uv: 9, feelsLike: 30 }),
    ];
    expect(nowLine(hours, 'tomorrow', NOW_10)).toBe('Peak UV 7 · Feels 18–24°');
  });

  it('tomorrow without UV shows only the range, and nothing without any value', () => {
    const noUv = [hour(9, { uv: null, feelsLike: 18 }), hour(13, { uv: null, feelsLike: 24 })];
    expect(nowLine(noUv, 'tomorrow', NOW_10)).toBe('Feels 18–24°');
    const nothing = [hour(9, { uv: null, feelsLike: null })];
    expect(nowLine(nothing, 'tomorrow', NOW_10)).toBe('');
  });

  it('tomorrow with a single feels-like value does not print a range', () => {
    const hours = [hour(9, { uv: 2, feelsLike: 20 }), hour(13, { uv: 2, feelsLike: 20.2 })];
    expect(nowLine(hours, 'tomorrow', null)).toBe('Peak UV 2 · Feels 20°');
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
