import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearForecastCache } from '../../data/openMeteo';
import { makeForecastJson } from '../../test/forecastJson';
import UvGoApp from '../UvGoApp';
import { reservePlaceLayout } from '../reservePlaceLayout';
import { CARD_SLOT_CLASS, HOUR_STRIP_MIN_H_CLASS } from '../ui';

const STORED_PLACE = {
  id: 2267057,
  name: 'Lisbon',
  admin1: 'Lisbon',
  country: 'Portugal',
  lat: 38.72,
  lon: -9.14,
};

/** UV 5 from 13:00 to 17:00 on both days, 0 elsewhere: 18:00 is the best hour. */
const UV = Array.from({ length: 48 }, (_, i) => (i % 24 >= 13 && i % 24 <= 17 ? 5 : 0));

const fetchMock = vi.fn();
let release: () => void;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(Date.UTC(2026, 9, 27, 10, 0));
  window.localStorage.clear();
  window.localStorage.setItem('uvgo:location', JSON.stringify(STORED_PLACE));
  window.localStorage.setItem(
    'uvgo:inputs',
    JSON.stringify({ freeTime: { start: 13, end: 14 }, duration: 60 }),
  );
  clearForecastCache();
  fetchMock.mockReset();
  // The forecast stays pending until the test lets it go.
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  fetchMock.mockImplementation(async () => {
    await gate;
    return {
      ok: true,
      status: 200,
      json: async () => makeForecastJson({ offsetSeconds: 0, hourly: { uv_index: UV } }),
    } as unknown as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const slot = () => document.querySelector('[data-card-slot]') as HTMLElement;

describe('loading state', () => {
  it('shows the loading status and a skeleton card, and drops them once the forecast arrives', async () => {
    render(<UvGoApp />);
    const status = await screen.findByText('Loading forecast…');
    expect(status).toHaveAttribute('role', 'status');
    expect(slot().querySelector('[data-skeleton]')).not.toBeNull();
    expect(slot().querySelector('svg[data-loading-sun]')).not.toBeNull();

    await act(async () => release());
    expect(await screen.findByText('13:00–14:00')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Loading forecast…')).not.toBeInTheDocument());
    expect(slot().querySelector('[data-skeleton]')).toBeNull();
  });
});

describe('layout stability', () => {
  it('keeps one card container with a fixed min-height through loading, result and empty', async () => {
    const user = userEvent.setup();
    render(<UvGoApp />);
    await screen.findByText('Loading forecast…');
    const container = slot();
    const minHeight = CARD_SLOT_CLASS.split(' ').find((c) => c.startsWith('min-h-'));
    expect(minHeight).toMatch(/^min-h-\[\d+(\.\d+)?rem\]$/);
    const hasMinHeight = () => container.classList.contains(minHeight as string);
    expect(hasMinHeight()).toBe(true);

    await act(async () => release());
    await screen.findByText('13:00–14:00');
    expect(slot()).toBe(container);
    expect(hasMinHeight()).toBe(true);

    // A 2 h outing does not fit into 13:00-14:00: the empty state takes the same container.
    await user.click(screen.getByRole('radio', { name: '2 h' }));
    await screen.findByText(/Your free time is shorter than 2 h/);
    expect(slot()).toBe(container);
    expect(hasMinHeight()).toBe(true);
  });

  it('puts the auto-switch notice inside the card container instead of pushing it down', async () => {
    vi.setSystemTime(Date.UTC(2026, 9, 27, 20, 0));
    render(<UvGoApp />);
    await act(async () => release());
    const notice = await screen.findByText('Your free time today has passed — showing tomorrow');
    expect(slot().contains(notice)).toBe(true);
    expect(slot().className).toContain(CARD_SLOT_CLASS);
  });
});

describe('server render', () => {
  it('reserves the card, timeline and plan blocks that the hydrated layout uses', () => {
    const html = renderToString(<UvGoApp />);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(doc.querySelector('[data-location-skeleton]')).not.toBeNull();
    expect(doc.querySelector('[data-card-slot]')?.className).toBe(
      `${CARD_SLOT_CLASS} lg:col-start-1 lg:row-start-2`,
    );
    expect(doc.querySelector('[data-timeline-skeleton]')).not.toBeNull();
    const strip = doc.querySelector('[data-strip-skeleton]');
    for (const token of HOUR_STRIP_MIN_H_CLASS.split(' '))
      expect(strip?.classList).toContain(token);
    expect(doc.querySelector('[data-adjust-skeleton]')).not.toBeNull();
  });
});

describe('stored-place layout before hydration', () => {
  function run(stored: string | null, throws = false) {
    const dataset: Record<string, string | undefined> = {};
    reservePlaceLayout({
      localStorage: {
        getItem: () => {
          if (throws) throw new Error('blocked');
          return stored;
        },
      },
      document: { documentElement: { dataset } },
    });
    return 'hasPlace' in dataset;
  }

  it('marks the page for a valid stored place only', () => {
    expect(run(JSON.stringify(STORED_PLACE))).toBe(true);
    expect(run(JSON.stringify({ name: 'X', lat: 1, lon: 2 }))).toBe(true);
    expect(run(null)).toBe(false);
    expect(run('not json')).toBe(false);
    expect(run('[]')).toBe(false);
    expect(run(JSON.stringify({ name: '', lat: 1, lon: 2 }))).toBe(false);
    expect(run(JSON.stringify({ name: 'X', lat: 'a', lon: 2 }))).toBe(false);
    expect(run(JSON.stringify({ name: 'X', lat: 1, lon: 2, id: 'x' }))).toBe(false);
    expect(run(JSON.stringify(STORED_PLACE), true)).toBe(false);
  });

  it('keys the placeholder location height on the mark: 44 px row for a stored place', () => {
    const html = renderToString(<UvGoApp />);
    const block = new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelector('[data-location-skeleton]');
    // The content heights (168 / 112 / 44 px) plus the 32 px padding of the sky panel.
    expect(block?.className).toContain('min-h-[12.5rem]');
    expect(block?.className).toContain('sm:min-h-36');
    expect(block?.className).toContain('[[data-has-place]_&]:min-h-[4.75rem]');
  });
});
