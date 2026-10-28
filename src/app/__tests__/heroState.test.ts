import { describe, expect, it } from 'vitest';
import type { Place } from '../../data/types';
import type { EvaluationResult, NowLocal, ScoredHour, TimeWindow } from '../../domain/types';
import { heroState } from '../hero/heroState';
import { initialState, type AppState } from '../state';

const LISBON: Place = { id: 2267057, name: 'Lisbon', lat: 38.72, lon: -9.14 };
const NOW_10: NowLocal = { date: '2026-10-27', hour: 10, minute: 20 };

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

const HOURS = Array.from({ length: 24 }, (_, h) =>
  hour(h, h === 10 ? { uv: 5.6, feelsLike: 23.6 } : {}),
);

const BEST: TimeWindow = {
  startHour: 15,
  hours: [HOURS[15]],
  score: 0,
  verdict: 'green',
  label: '15:00–16:00',
};

function evaluation(over: Partial<EvaluationResult> = {}): EvaluationResult {
  return {
    scoredHours: HOURS,
    best: BEST,
    emptyReason: null,
    reason: 'Low UV, low chance of rain',
    checklist: [],
    ...over,
  };
}

function appState(over: Partial<AppState> = {}): AppState {
  return { ...initialState({ place: LISBON, inputs: { duration: 60 } }), ...over };
}

describe('heroState', () => {
  it('no place', () => {
    expect(heroState(appState({ place: null }), null, null)).toEqual({ kind: 'no-place' });
  });

  it('a failed forecast is an error', () => {
    expect(heroState(appState({ forecast: { status: 'error' } }), null, null)).toEqual({
      kind: 'error',
      place: LISBON,
    });
  });

  it('a place without an evaluation is loading', () => {
    expect(heroState(appState({ forecast: { status: 'loading' } }), null, null)).toEqual({
      kind: 'loading',
      place: LISBON,
    });
  });

  it('no best window is empty, with the reason and duration', () => {
    const result = heroState(
      appState(),
      evaluation({ best: null, emptyReason: 'dark', reason: null }),
      NOW_10,
    );
    expect(result).toEqual({ kind: 'empty', place: LISBON, reason: 'dark', duration: 60 });
  });

  it('a best window is the result, with the "now" line from heroText', () => {
    const result = heroState(appState(), evaluation(), NOW_10);
    expect(result).toEqual({
      kind: 'result',
      place: LISBON,
      best: BEST,
      reason: 'Low UV, low chance of rain',
      duration: 60,
      nowLine: 'Now UV 6 · Feels 24°',
    });
  });
});
