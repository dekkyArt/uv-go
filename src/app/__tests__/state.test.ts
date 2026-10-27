import { describe, expect, it } from 'vitest';
import { mapForecast } from '../../data/openMeteo';
import type { Place } from '../../data/types';
import { makeForecastJson } from '../../test/forecastJson';
import { DEFAULT_INPUTS, initialState, isForecastStale, reducer, type AppState } from '../state';

const lisbon: Place = { id: 1, name: 'Lisbon', country: 'Portugal', lat: 38.72, lon: -9.14 };
const porto: Place = { id: 2, name: 'Porto', country: 'Portugal', lat: 41.15, lon: -8.61 };
const forecast = mapForecast(makeForecastJson({ date: '2026-10-27' }));

function fresh(): AppState {
  return initialState({ place: lisbon, inputs: {} });
}

describe('initialState', () => {
  it('merges stored inputs over the defaults', () => {
    const state = initialState({ place: null, inputs: { duration: 120 } });
    expect(state.inputs).toEqual({ ...DEFAULT_INPUTS, duration: 120 });
    expect(state.place).toBeNull();
    expect(state.forecast).toEqual({ status: 'idle' });
    expect(state.selectedHour).toBeNull();
    expect(state.autoSwitchDisabled).toBe(false);
    expect(state.autoSwitchNotice).toBe(false);
    expect(state.retryToken).toBe(0);
  });

  it('uses the documented defaults', () => {
    expect(DEFAULT_INPUTS).toEqual({
      day: 'today',
      freeTime: { start: 13, end: 19 },
      duration: 60,
      activity: 'relaxed',
    });
  });
});

describe('auto-switch to Tomorrow', () => {
  it('switches to tomorrow with a notice when today has passed', () => {
    const next = reducer(fresh(), {
      type: 'forecastLoaded',
      forecast,
      now: { date: '2026-10-27', hour: 20, minute: 0 },
    });
    expect(next.forecast).toEqual({ status: 'success', forecast });
    expect(next.inputs.day).toBe('tomorrow');
    expect(next.autoSwitchNotice).toBe(true);
  });

  it('a manual setDay(today) afterwards disables auto-switch and clears the notice', () => {
    const switched = reducer(fresh(), {
      type: 'forecastLoaded',
      forecast,
      now: { date: '2026-10-27', hour: 20, minute: 0 },
    });
    const next = reducer(switched, { type: 'setDay', day: 'today' });
    expect(next.inputs.day).toBe('today');
    expect(next.autoSwitchDisabled).toBe(true);
    expect(next.autoSwitchNotice).toBe(false);
  });

  it('does not switch again once disabled', () => {
    const state: AppState = { ...fresh(), autoSwitchDisabled: true };
    const next = reducer(state, {
      type: 'forecastLoaded',
      forecast,
      now: { date: '2026-10-27', hour: 20, minute: 0 },
    });
    expect(next.inputs.day).toBe('today');
    expect(next.autoSwitchNotice).toBe(false);
  });

  it('stays on today when the free time is still ahead', () => {
    const next = reducer(fresh(), {
      type: 'forecastLoaded',
      forecast,
      now: { date: '2026-10-27', hour: 10, minute: 0 },
    });
    expect(next.inputs.day).toBe('today');
    expect(next.autoSwitchNotice).toBe(false);
  });

  it('any manual setDay clears the notice without disabling auto-switch', () => {
    const switched = reducer(fresh(), {
      type: 'forecastLoaded',
      forecast,
      now: { date: '2026-10-27', hour: 20, minute: 0 },
    });
    const next = reducer(switched, { type: 'setDay', day: 'tomorrow' });
    expect(next.inputs.day).toBe('tomorrow');
    expect(next.autoSwitchNotice).toBe(false);
    expect(next.autoSwitchDisabled).toBe(false);
  });

  it('stays disabled after auto-switch, a place change and a manual return to Today', () => {
    const late = { date: '2026-10-27', hour: 20, minute: 0 };
    let state = reducer(fresh(), { type: 'forecastLoaded', forecast, now: late });
    expect(state.autoSwitched).toBe(true);
    state = reducer(state, { type: 'setPlace', place: porto });
    expect(state.autoSwitchNotice).toBe(false);
    expect(state.inputs.day).toBe('tomorrow');
    state = reducer(state, { type: 'setDay', day: 'today' });
    expect(state.autoSwitchDisabled).toBe(true);
    state = reducer(state, { type: 'forecastLoaded', forecast, now: late });
    expect(state.inputs.day).toBe('today');
    expect(state.autoSwitchNotice).toBe(false);
  });

  it('is disabled by Tomorrow then Today after an auto-switch', () => {
    const late = { date: '2026-10-27', hour: 20, minute: 0 };
    let state = reducer(fresh(), { type: 'forecastLoaded', forecast, now: late });
    state = reducer(state, { type: 'setDay', day: 'tomorrow' });
    expect(state.autoSwitchDisabled).toBe(false);
    state = reducer(state, { type: 'setDay', day: 'today' });
    expect(state.autoSwitchDisabled).toBe(true);
    state = reducer(state, { type: 'forecastLoaded', forecast, now: late });
    expect(state.inputs.day).toBe('today');
  });

  it('does not disable auto-switch when Today is chosen without a prior auto-switch', () => {
    const state = reducer(fresh(), { type: 'setDay', day: 'today' });
    expect(state.autoSwitchDisabled).toBe(false);
  });
});

describe('inputs', () => {
  it('ignores an inverted free time (same state object)', () => {
    const state = fresh();
    expect(reducer(state, { type: 'setFreeTime', freeTime: { start: 19, end: 13 } })).toBe(state);
  });

  it('ignores an empty or out-of-range free time', () => {
    const state = fresh();
    expect(reducer(state, { type: 'setFreeTime', freeTime: { start: 13, end: 13 } })).toBe(state);
    expect(reducer(state, { type: 'setFreeTime', freeTime: { start: -1, end: 5 } })).toBe(state);
    expect(reducer(state, { type: 'setFreeTime', freeTime: { start: 20, end: 25 } })).toBe(state);
    expect(reducer(state, { type: 'setFreeTime', freeTime: { start: 24, end: 24 } })).toBe(state);
  });

  it('accepts a valid free time, duration and activity', () => {
    let state = reducer(fresh(), { type: 'setFreeTime', freeTime: { start: 0, end: 24 } });
    expect(state.inputs.freeTime).toEqual({ start: 0, end: 24 });
    state = reducer(state, { type: 'setDuration', duration: 180 });
    state = reducer(state, { type: 'setActivity', activity: 'active' });
    expect(state.inputs).toMatchObject({ duration: 180, activity: 'active' });
  });

  it('selectHour sets and clears the selected hour', () => {
    const state = reducer(fresh(), { type: 'selectHour', hour: 14 });
    expect(state.selectedHour).toBe(14);
    expect(reducer(state, { type: 'selectHour', hour: null }).selectedHour).toBeNull();
  });
});

describe('place and forecast lifecycle', () => {
  it('setPlace resets the selected hour and the notice', () => {
    const state: AppState = { ...fresh(), selectedHour: 14, autoSwitchNotice: true };
    const next = reducer(state, { type: 'setPlace', place: porto });
    expect(next.place).toBe(porto);
    expect(next.selectedHour).toBeNull();
    expect(next.autoSwitchNotice).toBe(false);
  });

  it('forecastLoading and forecastFailed set the status', () => {
    const loading = reducer(fresh(), { type: 'forecastLoading' });
    expect(loading.forecast).toEqual({ status: 'loading' });
    expect(reducer(loading, { type: 'forecastFailed' }).forecast).toEqual({ status: 'error' });
  });

  it('retry increments the token', () => {
    expect(reducer(fresh(), { type: 'retry' }).retryToken).toBe(1);
  });
});

describe('isForecastStale', () => {
  it('is true when the local date moved past days[0]', () => {
    expect(isForecastStale(forecast, { date: '2026-10-28', hour: 0, minute: 5 })).toBe(true);
  });

  it('is false on the same date', () => {
    expect(isForecastStale(forecast, { date: '2026-10-27', hour: 23, minute: 59 })).toBe(false);
  });
});
