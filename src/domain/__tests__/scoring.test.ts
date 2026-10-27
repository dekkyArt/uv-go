import { describe, expect, it } from 'vitest';
import { hourVerdict, roundHalfUp, scoreHour, verdictFor } from '../scoring';
import type { Activity, Verdict } from '../types';
import { makeHour } from './factories';

const h = makeHour;

describe('roundHalfUp', () => {
  it.each([
    [5.45, 5],
    [5.5, 6],
    [2.4, 2],
    [2.5, 3],
  ])('%s -> %s', (n, expected) => {
    expect(roundHalfUp(n)).toBe(expected);
  });
});

describe('scoreHour', () => {
  describe('uv points, relaxed', () => {
    it.each([
      [2, 0],
      [2.4, 0],
      [2.5, 2],
      [3, 2],
      [5.45, 2],
      [5.5, 4],
      [7, 4],
      [7.5, 6],
      [8, 6],
      [11, 6],
    ])('uv %s -> %s', (uv, expected) => {
      expect(scoreHour(h({ hour: 12, uv }), 'relaxed').points.uv).toBe(expected);
    });
  });

  describe('uv points, long-sun', () => {
    it.each([
      [2, 0],
      [3, 3],
      [6, 6],
      [8, 9],
    ])('uv %s -> %s', (uv, expected) => {
      expect(scoreHour(h({ hour: 12, uv }), 'long-sun').points.uv).toBe(expected);
    });
  });

  it('uv null -> 0 points and noData', () => {
    const r = scoreHour(h({ hour: 12, uv: null }), 'relaxed');
    expect(r.points.uv).toBe(0);
    expect(r.noData).toEqual(['uv']);
  });

  describe('rain', () => {
    it.each([
      [29, 0],
      [30, 2],
      [59, 2],
      [60, 5],
      [100, 5],
    ])('rainProb %s -> %s', (rainProb, expected) => {
      expect(scoreHour(h({ hour: 12, rainProb }), 'relaxed').points.rain).toBe(expected);
    });

    it('null -> 0 points and noData', () => {
      const r = scoreHour(h({ hour: 12, rainProb: null }), 'relaxed');
      expect(r.points.rain).toBe(0);
      expect(r.noData).toEqual(['rain']);
    });
  });

  describe('heat', () => {
    it.each<[Activity, number, number]>([
      ['relaxed', 29.9, 0],
      ['relaxed', 30, 3],
      ['active', 30, 5],
      ['long-sun', 30, 3],
    ])('%s feelsLike %s -> %s', (activity, feelsLike, expected) => {
      expect(scoreHour(h({ hour: 12, feelsLike }), activity).points.heat).toBe(expected);
    });
  });

  describe('cold', () => {
    it.each([
      [-0.1, 2],
      [0, 0],
    ])('feelsLike %s -> %s', (feelsLike, expected) => {
      expect(scoreHour(h({ hour: 12, feelsLike }), 'relaxed').points.cold).toBe(expected);
    });

    it('feelsLike null -> heat 0, cold 0, noData heat+cold', () => {
      const r = scoreHour(h({ hour: 12, feelsLike: null }), 'relaxed');
      expect(r.points.heat).toBe(0);
      expect(r.points.cold).toBe(0);
      expect(r.noData).toEqual(['heat', 'cold']);
    });
  });

  describe('wind', () => {
    it.each([
      [39, 0],
      [39.9, 0],
      [40, 3],
    ])('windKmh %s -> %s', (windKmh, expected) => {
      expect(scoreHour(h({ hour: 12, windKmh }), 'relaxed').points.wind).toBe(expected);
    });
  });

  it('sums factor points', () => {
    const r = scoreHour(
      h({ hour: 12, uv: 6, rainProb: 60, feelsLike: 31, windKmh: 45 }),
      'relaxed',
    );
    expect(r.score).toBe(15);
    expect(r.noData).toEqual([]);
  });
});

describe('verdictFor', () => {
  it.each<[number, Verdict]>([
    [0, 'green'],
    [2.4, 'green'],
    [2.5, 'yellow'],
    [5.4, 'yellow'],
    [5.5, 'red'],
    [9, 'red'],
  ])('score %s -> %s', (score, expected) => {
    expect(verdictFor(score)).toBe(expected);
  });
});

describe('hourVerdict', () => {
  it('isDay false -> night', () => {
    expect(hourVerdict(h({ hour: 2, isDay: false }), 0)).toBe('night');
  });

  it('isDay true -> verdictFor(score)', () => {
    expect(hourVerdict(h({ hour: 12 }), 4)).toBe('yellow');
  });
});
