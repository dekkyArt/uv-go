import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { motionValue } from 'motion/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearForecastCache } from '../../data/openMeteo';
import type { SkyState } from '../../domain/sky';
import { glassTint, mixUniforms, skyUniforms } from '../../domain/skyUniforms';
import { makeForecastJson } from '../../test/forecastJson';
import SkyCanvas from '../sky/SkyCanvas';
import { createRenderer, type SkyRenderer } from '../sky/renderer';
import UvGoApp from '../UvGoApp';

// The real renderer unless a test swaps in a fake.
vi.mock('../sky/renderer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../sky/renderer')>();
  return { ...actual, createRenderer: vi.fn(actual.createRenderer) };
});

/** SkyCanvas waits this long for the idle callback jsdom does not have. */
const IDLE_FALLBACK_MS = 200;

const TODAY: SkyState = {
  phase: 'day',
  weather: 'clear',
  uvGlow: 0.6,
  heat: false,
  wind: false,
  sunPosition: 0.4,
};
const TOMORROW: SkyState = { ...TODAY, phase: 'golden', weather: 'rain', sunPosition: 0.9 };

interface Fake extends SkyRenderer {
  onLost(): void;
  reducedMotion: boolean;
}

/** Hands out a fake renderer per createRenderer call and keeps its options. */
function fakeRenderers(): Fake[] {
  const made: Fake[] = [];
  vi.mocked(createRenderer).mockImplementation((_canvas, opts) => {
    const fake: Fake = {
      setTarget: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      destroy: vi.fn(),
      onLost: opts.onLost,
      reducedMotion: opts.reducedMotion,
    };
    made.push(fake);
    return fake;
  });
  return made;
}

const html = () => document.documentElement;
const canvas = () => document.querySelector('canvas.sky-canvas');
const inlineGlass = () => ({
  rgb: html().style.getPropertyValue('--glass-rgb'),
  alpha: html().style.getPropertyValue('--glass-alpha'),
});
const lastTarget = (fake: Fake) => vi.mocked(fake.setTarget).mock.lastCall?.[0];

/** Waits out the idle fallback (real timers) and the first frame. */
async function startSky() {
  await waitFor(() => expect(canvas()).toHaveAttribute('data-ready'));
}

afterEach(() => {
  // Unmount while the stubbed globals (the idle callback) are still in place.
  cleanup();
  vi.useRealTimers();
  vi.mocked(createRenderer).mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  html().removeAttribute('style');
});

describe('SkyCanvas', () => {
  it('without WebGL drops the canvas and leaves the CSS sky and the phase glass', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <SkyCanvas
        today={TODAY}
        tomorrow={TOMORROW}
        progress={motionValue(0)}
        reducedMotion={false}
      />,
    );
    expect(canvas()).toHaveAttribute('aria-hidden', 'true');

    await waitFor(() => expect(canvas()).toBeNull());
    expect(html()).not.toHaveAttribute('data-sky-live');
    expect(inlineGlass()).toEqual({ rgb: '', alpha: '' });
    expect(warn.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('starts only once the page is idle, then marks the sky live and tints the glass', async () => {
    const made = fakeRenderers();
    const started = performance.now();
    render(
      <SkyCanvas
        today={TODAY}
        tomorrow={TOMORROW}
        progress={motionValue(0)}
        reducedMotion={false}
      />,
    );
    expect(createRenderer).not.toHaveBeenCalled();

    await startSky();
    expect(performance.now() - started).toBeGreaterThanOrEqual(IDLE_FALLBACK_MS - 1);
    const renderer = made[0];
    expect(renderer.reducedMotion).toBe(false);
    expect(renderer.start).toHaveBeenCalled();
    expect(lastTarget(renderer)).toEqual(skyUniforms(TODAY));
    expect(html()).toHaveAttribute('data-sky-live');
    const glass = glassTint(skyUniforms(TODAY));
    expect(inlineGlass()).toEqual({ rgb: glass.rgb.join(' '), alpha: String(glass.alpha) });
  });

  it('uses the idle callback where the browser has one', async () => {
    const made = fakeRenderers();
    let idle: (() => void) | null = null;
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => {
      idle = cb;
      return 1;
    });
    vi.stubGlobal('cancelIdleCallback', vi.fn());
    render(<SkyCanvas today={TODAY} tomorrow={TOMORROW} progress={motionValue(0)} reducedMotion />);
    await new Promise((resolve) => setTimeout(resolve, IDLE_FALLBACK_MS * 2));
    expect(made).toHaveLength(0);
    act(() => idle!());
    expect(made).toHaveLength(1);
    expect(made[0].reducedMotion).toBe(true);
  });

  it('on a lost context removes the canvas, the live mark and the inline glass', async () => {
    const made = fakeRenderers();
    render(
      <SkyCanvas
        today={TODAY}
        tomorrow={TOMORROW}
        progress={motionValue(0)}
        reducedMotion={false}
      />,
    );
    await startSky();
    expect(inlineGlass().rgb).not.toBe('');
    expect(html()).toHaveAttribute('data-sky-live');

    act(() => made[0].onLost());
    expect(canvas()).toBeNull();
    expect(inlineGlass()).toEqual({ rgb: '', alpha: '' });
    expect(html()).not.toHaveAttribute('data-sky-live');
    expect(made[0].destroy).toHaveBeenCalled();
  });

  it('follows the pager: a blend mid-swipe, Tomorrow at 1, clamped past the edges', async () => {
    const made = fakeRenderers();
    const progress = motionValue(0);
    const { rerender } = render(
      <SkyCanvas today={TODAY} tomorrow={TOMORROW} progress={progress} reducedMotion={false} />,
    );
    await startSky();
    const renderer = made[0];
    const todayGlass = inlineGlass();

    act(() => progress.set(0.5));
    expect(lastTarget(renderer)).toEqual(
      mixUniforms(skyUniforms(TODAY), skyUniforms(TOMORROW), 0.5),
    );
    // Not on every frame of the swipe: the glass waits for the day to settle.
    expect(inlineGlass()).toEqual(todayGlass);

    act(() => progress.set(1));
    rerender(
      <SkyCanvas today={TODAY} tomorrow={TOMORROW} progress={progress} reducedMotion={false} />,
    );
    expect(lastTarget(renderer)).toEqual(skyUniforms(TOMORROW));
    const glass = glassTint(skyUniforms(TOMORROW));
    expect(inlineGlass()).toEqual({ rgb: glass.rgb.join(' '), alpha: String(glass.alpha) });

    // The spring that settles the pager can overshoot.
    act(() => progress.set(1.08));
    expect(lastTarget(renderer)).toEqual(skyUniforms(TOMORROW));
    act(() => progress.set(-0.05));
    expect(lastTarget(renderer)).toEqual(skyUniforms(TODAY));
  });

  it('retargets when a day sky changes', async () => {
    const made = fakeRenderers();
    const progress = motionValue(0);
    const { rerender } = render(
      <SkyCanvas today={TODAY} tomorrow={TOMORROW} progress={progress} reducedMotion={false} />,
    );
    await startSky();
    const night: SkyState = { ...TODAY, phase: 'night', uvGlow: 0 };
    rerender(
      <SkyCanvas today={night} tomorrow={TOMORROW} progress={progress} reducedMotion={false} />,
    );
    expect(lastTarget(made[0])).toEqual(skyUniforms(night));
    const glass = glassTint(skyUniforms(night));
    expect(inlineGlass().rgb).toBe(glass.rgb.join(' '));
  });

  it('cleans up when unmounted', async () => {
    const made = fakeRenderers();
    const { unmount } = render(
      <SkyCanvas
        today={TODAY}
        tomorrow={TOMORROW}
        progress={motionValue(0)}
        reducedMotion={false}
      />,
    );
    await startSky();
    unmount();
    expect(made[0].destroy).toHaveBeenCalled();
    expect(html()).not.toHaveAttribute('data-sky-live');
    expect(inlineGlass()).toEqual({ rgb: '', alpha: '' });
  });
});

const STORED_PLACE = { id: 1, name: 'Lisbon', country: 'Portugal', lat: 38.72, lon: -9.14 };
const series = (fn: (hour: number) => number) => Array.from({ length: 48 }, (_, i) => fn(i % 24));

describe('live sky in the app', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    window.localStorage.clear();
    clearForecastCache();
  });

  it('draws the device-time sky before any place is chosen, from a separate chunk', async () => {
    vi.setSystemTime(new Date(2026, 9, 27, 13, 0));
    const made = fakeRenderers();
    render(<UvGoApp />);
    await waitFor(() => expect(canvas()).not.toBeNull());
    await startSky();
    // No forecast: a clear day sky for both days.
    expect(lastTarget(made[0])).toMatchObject({
      cloudCover: skyUniforms(TODAY).cloudCover,
      moon: 0,
    });
    expect(canvas()).toHaveAttribute('aria-hidden', 'true');
  });

  it('follows the best window of the loaded forecast, with its weather', async () => {
    vi.setSystemTime(Date.UTC(2026, 9, 27, 10, 0));
    window.localStorage.setItem('uvgo:location', JSON.stringify(STORED_PLACE));
    const json = makeForecastJson({
      offsetSeconds: 0,
      hourly: {
        // UV 5 from 13:00 to 17:00: the best window starts at 18:00 (golden hour, 06:30-19:30 sun).
        uv_index: series((h) => (h >= 13 && h <= 17 ? 5 : 0)),
        weather_code: series(() => 61),
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => json }) as Response),
    );
    const made = fakeRenderers();
    render(<UvGoApp />);
    expect(await screen.findByText('18:00–19:00')).toBeInTheDocument();
    await startSky();
    await waitFor(() =>
      expect(lastTarget(made[0])).toMatchObject({
        skyTop: skyUniforms({ ...TODAY, phase: 'golden' }).skyTop,
        rain: skyUniforms({ ...TODAY, weather: 'rain' }).rain,
      }),
    );
  });
});
