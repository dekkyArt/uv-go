import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { skyRanges } from '../../components/skyRanges';
import type { Place } from '../../data/types';
import { articlePhase, skyState } from '../../domain/sky';
import type { SkyPhase, SkyState } from '../../domain/sky';
import type { DayForecast, EvaluationResult, NowLocal, TimeWindow } from '../../domain/types';
import { makeDay } from '../../domain/__tests__/factories';
import SkyLayer from '../components/SkyLayer';
import { useSky, useSkyRef } from '../hooks/useSkyRef';
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

describe('useSky', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date(2026, 9, 27, 21, 40));
  });
  afterEach(() => vi.useRealTimers());

  it('without a forecast shows the clear article sky of the device time', () => {
    const { result: r } = renderHook(() =>
      useSky(stateWith({ place: null, forecast: false }), null, null),
    );
    expect(r.current).toMatchObject({
      phase: articlePhase(21, 40),
      weather: 'clear',
      heat: false,
      wind: false,
    });
  });

  it('with a forecast shows the sky of the reference hour', () => {
    const state = stateWith({});
    const { result: r } = renderHook(() => useSky(state, result(17), NOW_15));
    const day = state.forecast.status === 'success' ? state.forecast.forecast.days[0] : null;
    expect(r.current).toEqual(skyState(17, day as DayForecast));
  });
});

const SKY: SkyState = {
  phase: 'day',
  weather: 'clear',
  uvGlow: 0,
  heat: false,
  wind: false,
  sunPosition: 0.5,
};

function mockViewport(desktop: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query === '(min-width: 1024px)' ? desktop : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function particles(container: HTMLElement) {
  return container.querySelectorAll('[data-particle]');
}

describe('SkyLayer', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is a decorative fixed layer behind the page', () => {
    mockViewport(false);
    const { container } = render(<SkyLayer sky={SKY} reducedMotion={false} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute('aria-hidden', 'true');
    expect(root).toHaveClass('sky-layer');
    expect(root.querySelectorAll('.sky-phase')).toHaveLength(6);
  });

  it('shows only the current phase layer', () => {
    mockViewport(false);
    const { container, rerender } = render(<SkyLayer sky={SKY} reducedMotion={false} />);
    const active = () =>
      [...container.querySelectorAll('.sky-phase[data-active]')].map(
        (el) => (el.className.match(/sky-phase-(\w+)/) ?? [])[1],
      );
    expect(active()).toEqual(['day']);
    rerender(<SkyLayer sky={{ ...SKY, phase: 'golden' }} reducedMotion={false} />);
    expect(active()).toEqual(['golden']);
  });

  it('caps rain particles at 40 on a phone viewport', () => {
    mockViewport(false);
    const { container } = render(
      <SkyLayer sky={{ ...SKY, weather: 'rain', wind: true }} reducedMotion={false} />,
    );
    const count = particles(container).length;
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(40);
  });

  it('caps rain particles at 80 on a desktop viewport', () => {
    mockViewport(true);
    const { container } = render(
      <SkyLayer sky={{ ...SKY, weather: 'rain', wind: true }} reducedMotion={false} />,
    );
    const count = particles(container).length;
    expect(count).toBeGreaterThan(40);
    expect(count).toBeLessThanOrEqual(80);
  });

  it('draws no particles, flashes or shimmer with reduced motion', () => {
    mockViewport(true);
    for (const weather of ['rain', 'snow', 'thunder'] as const) {
      const { container, unmount } = render(
        <SkyLayer sky={{ ...SKY, weather, wind: true, heat: true }} reducedMotion />,
      );
      expect(particles(container)).toHaveLength(0);
      expect(container.querySelector('.sky-flash')).toBeNull();
      expect(container.querySelector('.sky-heat')).toBeNull();
      unmount();
    }
  });

  it('flashes only in thunderstorms', () => {
    mockViewport(false);
    const clear = render(<SkyLayer sky={SKY} reducedMotion={false} />);
    expect(clear.container.querySelector('.sky-flash')).toBeNull();
    clear.unmount();
    const storm = render(<SkyLayer sky={{ ...SKY, weather: 'thunder' }} reducedMotion={false} />);
    expect(storm.container.querySelector('.sky-flash')).not.toBeNull();
  });

  it('veils overcast and fog, not clear skies', () => {
    mockViewport(false);
    const veilOpacity = (weather: SkyState['weather']) => {
      const { container, unmount } = render(
        <SkyLayer sky={{ ...SKY, weather }} reducedMotion={false} />,
      );
      const value = Number((container.querySelector('.sky-veil') as HTMLElement).style.opacity);
      unmount();
      return value;
    };
    expect(veilOpacity('clear')).toBe(0);
    expect(veilOpacity('overcast')).toBeGreaterThan(0);
    expect(veilOpacity('fog')).toBeGreaterThan(0);
  });

  it('sets the sun glow opacity to uvGlow and shows the moon only at night', () => {
    mockViewport(false);
    const { container, rerender } = render(
      <SkyLayer sky={{ ...SKY, uvGlow: 0.6 }} reducedMotion={false} />,
    );
    const glow = () => container.querySelector('.sky-glow') as HTMLElement;
    const moon = () => container.querySelector('.sky-moon') as HTMLElement;
    expect(glow().style.opacity).toBe('0.6');
    expect(moon().style.opacity).toBe('0');
    rerender(<SkyLayer sky={{ ...SKY, phase: 'night', uvGlow: 0 }} reducedMotion={false} />);
    expect(glow().style.opacity).toBe('0');
    expect(moon().style.opacity).toBe('1');
  });

  it('uses only transform and opacity inline, and no backdrop filter', () => {
    mockViewport(true);
    const { container } = render(
      <SkyLayer
        sky={{ ...SKY, weather: 'snow', heat: true, wind: true, uvGlow: 1 }}
        reducedMotion={false}
      />,
    );
    const root = container.firstElementChild as HTMLElement;
    for (const el of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
      expect(el.getAttribute('style') ?? '').not.toMatch(/backdrop|filter|top:|left:\s*\d+px/);
    }
  });

  it('crossfades faster with reduced motion (150 ms at most)', () => {
    mockViewport(false);
    const fade = (reducedMotion: boolean) => {
      const { container, unmount } = render(<SkyLayer sky={SKY} reducedMotion={reducedMotion} />);
      const value = (container.firstElementChild as HTMLElement).style.getPropertyValue(
        '--sky-fade',
      );
      unmount();
      return value;
    };
    expect(fade(true)).toBe('150ms');
    expect(Number.parseInt(fade(false))).toBeGreaterThan(150);
  });

  it('marks the page as having a live sky while mounted', () => {
    mockViewport(false);
    const { unmount } = render(<SkyLayer sky={SKY} reducedMotion={false} />);
    expect(document.documentElement).toHaveAttribute('data-sky-live');
    act(() => unmount());
    expect(document.documentElement).not.toHaveAttribute('data-sky-live');
  });
});

describe('skyRanges', () => {
  const MINUTES_PER_DAY = 24 * 60;

  function phaseFromRanges(ranges: readonly (readonly [number, SkyPhase])[], minute: number) {
    let phase = ranges[0][1];
    for (const [from, name] of ranges) if (minute >= from) phase = name;
    return phase;
  }

  it('agrees with articlePhase on every minute of the day', () => {
    const ranges = skyRanges();
    for (let minute = 0; minute < MINUTES_PER_DAY; minute++) {
      expect(phaseFromRanges(ranges, minute)).toBe(
        articlePhase(Math.floor(minute / 60), minute % 60),
      );
    }
  });

  it('starts at midnight and lists each boundary once, in order', () => {
    const ranges = skyRanges();
    expect(ranges[0][0]).toBe(0);
    expect(ranges.map(([, phase]) => phase)).toEqual([
      'night',
      'dawn',
      'morning',
      'day',
      'golden',
      'dusk',
      'night',
    ]);
    expect(ranges.map(([from]) => from)).toEqual(
      [...ranges.map(([from]) => from)].sort((a, b) => a - b),
    );
  });
});
