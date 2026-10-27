import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearForecastCache } from '../../data/openMeteo';
import { makeForecastJson } from '../../test/forecastJson';
import UvGoApp from '../UvGoApp';

const STORED_PLACE = { id: 1, name: 'Lisbon', country: 'Portugal', lat: 38.72, lon: -9.14 };

const series = (fn: (hour: number) => number) => Array.from({ length: 48 }, (_, i) => fn(i % 24));

function activeLayers(): string[] {
  return [...document.querySelectorAll('.sky-layer .sky-phase[data-active]')].map(
    (el) => (el.className.match(/sky-phase-(\w+)/) ?? [])[1],
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  window.localStorage.clear();
  clearForecastCache();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('live sky in the app', () => {
  it('draws the device-time sky before any place is chosen, from a separate chunk', async () => {
    vi.setSystemTime(new Date(2026, 9, 27, 13, 0));
    render(<UvGoApp />);
    const layer = await waitFor(() => {
      const el = document.querySelector('.sky-layer');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    expect(layer).toHaveAttribute('aria-hidden', 'true');
    expect(activeLayers()).toEqual(['day']);
    expect(document.documentElement).toHaveAttribute('data-sky-live');
    // Decorative: no text, never announced.
    expect(layer).toHaveTextContent('');
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
    render(<UvGoApp />);
    expect(await screen.findByText('18:00–19:00')).toBeInTheDocument();
    await waitFor(() => expect(activeLayers()).toEqual(['golden']));
    expect(document.querySelectorAll('.sky-layer [data-particle]').length).toBeGreaterThan(0);
  });
});
