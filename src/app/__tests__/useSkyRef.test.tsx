import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Place } from '../../data/types';
import { articlePhase, skyState } from '../../domain/sky';
import type { DayForecast, EvaluationResult, NowLocal, TimeWindow } from '../../domain/types';
import { makeDay } from '../../domain/__tests__/factories';
import { useSkyPair, useSkyRef } from '../hooks/useSkyRef';
import { initialState, reducer } from '../state';
import type { AppState } from '../state';

const PLACE: Place = { id: 1, name: 'Lisbon', lat: 38.72, lon: -9.14 };

function stateWith(opts: {
  place?: Place | null;
  day?: 'today' | 'tomorrow';
  forecast?: boolean;
  selectedHour?: number | null;
}): AppState {
  const day: DayForecast = makeDay();
  const base = initialState({ place: opts.place === undefined ? PLACE : opts.place, inputs: {} });
  return {
    ...base,
    inputs: { ...base.inputs, day: opts.day ?? 'today' },
    forecast:
      opts.forecast === false
        ? { status: 'idle' }
        : {
            status: 'success',
            forecast: { days: [day, day], utcOffsetSeconds: 0, timezone: 'UTC' },
          },
    selectedHour: opts.selectedHour ?? null,
  };
}

function result(bestStart: number | null): EvaluationResult {
  return {
    scoredHours: [],
    best: bestStart === null ? null : ({ startHour: bestStart } as TimeWindow),
    emptyReason: null,
    reason: null,
    checklist: [],
  };
}

const NOW_15: NowLocal = { date: '2026-10-27', hour: 15, minute: 10 };

describe('useSkyRef', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date(2026, 9, 27, 21, 40));
  });
  afterEach(() => vi.useRealTimers());

  it('without a place falls back to the device hour', () => {
    const { result: r } = renderHook(() =>
      useSkyRef(stateWith({ place: null, forecast: false }), null, null),
    );
    expect(r.current).toEqual({ refHour: 21, day: null, deviceFallback: true });
  });

  it('keeps the device hour while the forecast has not arrived', () => {
    const { result: r } = renderHook(() => useSkyRef(stateWith({ forecast: false }), null, null));
    expect(r.current.deviceFallback).toBe(true);
    expect(r.current.refHour).toBe(21);
  });

  it('follows the start of the best window', () => {
    const { result: r } = renderHook(() => useSkyRef(stateWith({}), result(17), NOW_15));
    expect(r.current.refHour).toBe(17);
    expect(r.current.deviceFallback).toBe(false);
    expect(r.current.day?.date).toBe('2026-10-27');
  });

  it('without a best window uses the current hour for Today and 12 for Tomorrow', () => {
    const today = renderHook(() => useSkyRef(stateWith({}), result(null), NOW_15));
    expect(today.result.current.refHour).toBe(15);
    const tomorrow = renderHook(() =>
      useSkyRef(stateWith({ day: 'tomorrow' }), result(null), NOW_15),
    );
    expect(tomorrow.result.current.refHour).toBe(12);
  });

  it('the selected hour wins, and clearing it returns to the best window', () => {
    const picked = stateWith({ selectedHour: 9 });
    const { result: r, rerender } = renderHook(
      ({ state }: { state: AppState }) => useSkyRef(state, result(17), NOW_15),
      { initialProps: { state: picked } },
    );
    expect(r.current.refHour).toBe(9);
    rerender({ state: reducer(picked, { type: 'selectHour', hour: null }) });
    expect(r.current.refHour).toBe(17);
  });
});

describe('useSkyPair', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date(2026, 9, 27, 21, 40));
  });
  afterEach(() => vi.useRealTimers());

  const dayOf = (state: AppState, index: 0 | 1) =>
    (state.forecast.status === 'success'
      ? state.forecast.forecast.days[index]
      : null) as DayForecast;

  it('without a forecast shows the clear article sky of the device time on both days', () => {
    const { result: r } = renderHook(() =>
      useSkyPair(stateWith({ place: null, forecast: false }), null, null),
    );
    const device = { phase: articlePhase(21, 40), weather: 'clear', heat: false, wind: false };
    expect(r.current.today).toMatchObject(device);
    expect(r.current.tomorrow).toEqual(r.current.today);
  });

  it('with a forecast shows the active day at its reference hour, the other day by the clock', () => {
    const state = stateWith({});
    const { result: r } = renderHook(() => useSkyPair(state, result(17), NOW_15));
    expect(r.current.today).toEqual(skyState(17, dayOf(state, 0)));
    // Tomorrow is not on screen: no best window of its own, so noon.
    expect(r.current.tomorrow).toEqual(skyState(12, dayOf(state, 1)));
  });

  it('applies the selected hour and the best window only to the active day', () => {
    const state = stateWith({ day: 'tomorrow', selectedHour: 9 });
    const { result: r } = renderHook(() => useSkyPair(state, result(17), NOW_15));
    expect(r.current.tomorrow).toEqual(skyState(9, dayOf(state, 1)));
    // Today, off screen, follows the current hour.
    expect(r.current.today).toEqual(skyState(15, dayOf(state, 0)));
  });

  it('keeps both skies stable across renders with the same inputs', () => {
    const state = stateWith({});
    const { result: r, rerender } = renderHook(() => useSkyPair(state, result(17), NOW_15));
    const first = r.current;
    rerender();
    expect(r.current).toBe(first);
  });
});
