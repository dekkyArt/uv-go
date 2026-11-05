import { describe, expect, it } from 'vitest';
import { rules } from '../rules.config';
import { buildReason } from '../reason';
import { makeWindow } from './factories';

describe('buildReason', () => {
  it('UV 3-5 -> sunscreen template, uv from max rounded UV', () => {
    expect(buildReason(makeWindow({ 10: { uv: 5 }, 11: { uv: 5 } }))).toBe('UV 5, use sunscreen');
  });

  it('UV 6-7 -> sunscreen and a hat', () => {
    expect(buildReason(makeWindow({ 10: { uv: 6 } }))).toBe('UV 6, sunscreen and a hat');
  });

  it('UV 8+ -> limit time in the sun', () => {
    expect(buildReason(makeWindow({ 10: { uv: 8 } }))).toBe('UV 8, limit time in the sun');
  });

  it('uses the max rounded UV of the window, not the hour with most points', () => {
    expect(buildReason(makeWindow({ 10: { uv: 3.4 }, 11: { uv: 6.4 } }))).toBe(
      'UV 6, sunscreen and a hat',
    );
  });

  it('appends the second factor when its sum is > 0', () => {
    expect(buildReason(makeWindow({ 10: { uv: 5, rainProb: 40 } }))).toBe(
      'UV 5, use sunscreen · 40% chance of rain',
    );
  });

  it('tie uv(2) = rain(2) is broken by priority (uv first)', () => {
    expect(buildReason(makeWindow({ 10: { uv: 4, rainProb: 35 } }))).toBe(
      'UV 4, use sunscreen · 35% chance of rain',
    );
  });

  it('tie heat(3) = wind(3) is broken by priority (heat first)', () => {
    expect(buildReason(makeWindow({ 10: { feelsLike: 31, windKmh: 42 } }))).toBe(
      'Feels like 31°C · Wind up to 42 km/h',
    );
  });

  it('rain with a larger sum leads over uv', () => {
    expect(buildReason(makeWindow({ 10: { uv: 4, rainProb: 65 } }))).toBe(
      '65% chance of rain · UV 4, use sunscreen',
    );
  });

  it('cold uses the min feels-like, rounded', () => {
    expect(buildReason(makeWindow({ 10: { feelsLike: -2.6 }, 11: { feelsLike: 0 } }))).toBe(
      'Feels like -3°C',
    );
  });

  it('heat uses the max feels-like, rounded', () => {
    expect(buildReason(makeWindow({ 10: { feelsLike: 30.4 }, 11: { feelsLike: 33.5 } }))).toBe(
      'Feels like 34°C',
    );
  });

  it('wind uses the max wind, rounded', () => {
    expect(buildReason(makeWindow({ 10: { windKmh: 40.2 }, 11: { windKmh: 44.6 } }))).toBe(
      'Wind up to 45 km/h',
    );
  });

  it('three factors with points -> exactly two parts', () => {
    const reason = buildReason(makeWindow({ 10: { uv: 6, rainProb: 40, windKmh: 45 } }));
    expect(reason.split(' · ')).toHaveLength(2);
    expect(reason).toBe('UV 6, sunscreen and a hat · Wind up to 45 km/h');
  });

  it('long-sun multiplier does not change the shown UV', () => {
    expect(buildReason(makeWindow({ 10: { uv: 5 } }, 'long-sun'))).toBe('UV 5, use sunscreen');
  });

  it('null values are ignored for the shown value', () => {
    expect(buildReason(makeWindow({ 10: { uv: null }, 11: { uv: 5 } }))).toBe(
      'UV 5, use sunscreen',
    );
  });

  it('zero points -> none template', () => {
    expect(buildReason(makeWindow({ 10: { uv: 1 }, 11: { uv: 2 } }))).toBe(
      'No points from available forecast data',
    );
  });

  it('no template contains forbidden words', () => {
    const t = rules.reasonTemplates;
    const all = [...t.uv.map((b) => b.text), t.rain, t.heat, t.cold, t.wind, t.none];
    for (const text of all) expect(text).not.toMatch(/safe|perfect/i);
  });
});
