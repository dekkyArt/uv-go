import { describe, expect, it } from 'vitest';
import { buildChecklist } from '../checklist';
import { rules } from '../rules.config';
import type { Activity, HourData } from '../types';
import { makeWindow } from './factories';

const ids = (o: Record<number, Partial<HourData>>, activity: Activity = 'relaxed') =>
  buildChecklist(makeWindow(o, activity), activity).map((i) => i.id);

describe('buildChecklist', () => {
  it('sunscreen from max rounded UV >= 3', () => {
    expect(ids({ 10: { uv: 2.4 } })).toEqual([]);
    expect(ids({ 10: { uv: 2.5 } })).toEqual(['sunscreen']);
    expect(ids({ 10: { uv: 5.4 } })).toEqual(['sunscreen']);
  });

  it('hat & sunglasses from max rounded UV >= 6', () => {
    expect(ids({ 10: { uv: 5.5 } })).toEqual(['sunscreen', 'hat-sunglasses']);
  });

  it('uses the max UV across the window', () => {
    expect(ids({ 10: { uv: 1 }, 11: { uv: 6 } })).toEqual(['sunscreen', 'hat-sunglasses']);
  });

  it('rain jacket from max rain >= 30', () => {
    expect(ids({ 10: { rainProb: 29 } })).toEqual([]);
    expect(ids({ 10: { rainProb: 30 } })).toEqual(['rain-jacket']);
  });

  it('water for relaxed only from feels like >= 25', () => {
    expect(ids({ 10: { feelsLike: 24.9 } })).toEqual([]);
    expect(ids({ 10: { feelsLike: 25 } })).toEqual(['water']);
  });

  it('water for active regardless of temperature', () => {
    expect(ids({ 10: { feelsLike: 10 } }, 'active')).toEqual(['water']);
  });

  it('warm layer from min feels like < 5', () => {
    expect(ids({ 10: { feelsLike: 5 } })).toEqual([]);
    expect(ids({ 10: { feelsLike: 4.9 } })).toEqual(['warm-layer']);
  });

  it('null values are ignored', () => {
    expect(ids({ 10: { uv: null, rainProb: null, feelsLike: null } })).toEqual([]);
  });

  it('items come in fixed order', () => {
    expect(ids({ 10: { uv: 9, rainProb: 80, feelsLike: 26 }, 11: { feelsLike: 3 } })).toEqual([
      'sunscreen',
      'hat-sunglasses',
      'rain-jacket',
      'water',
      'warm-layer',
    ]);
  });

  it('labels come from rules.checklistLabels', () => {
    const items = buildChecklist(makeWindow({ 10: { uv: 9, rainProb: 80 } }), 'relaxed');
    for (const item of items) expect(item.label).toBe(rules.checklistLabels[item.id]);
    expect(items.map((i) => i.label)).toEqual(['Sunscreen', 'Hat & sunglasses', 'Rain jacket']);
  });
});
