import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearForecastCache } from '../../data/openMeteo';
import { makeForecastJson } from '../../test/forecastJson';
import { HERO_H1 } from '../hero/Hero';
import UvGoApp from '../UvGoApp';

const LISBON = {
  id: 2267057,
  name: 'Lisbon',
  admin1: 'Lisbon',
  country: 'Portugal',
  latitude: 38.72,
  longitude: -9.14,
};

const STORED_PLACE = {
  id: 2267057,
  name: 'Lisbon',
  admin1: 'Lisbon',
  country: 'Portugal',
  lat: 38.72,
  lon: -9.14,
};

/**
 * UV 5 (2 points) from 13:00 to 17:00 on both days, 0 elsewhere: 18:00 is the best hour, and
 * 16:00–19:00 the best 3 h. `overrides` index the 48 hours (24 and up is tomorrow).
 */
function uvSeries(overrides: Record<number, number | null> = {}): (number | null)[] {
  return Array.from({ length: 48 }, (_, i) => {
    const hour = i % 24;
    if (i in overrides) return overrides[i];
    return hour >= 13 && hour <= 17 ? 5 : 0;
  });
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as unknown as Response;
}

let forecastResponse: () => Response;
const fetchMock = vi.fn();

function forecastCalls() {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes('api.open-meteo.com'));
}

function setForecast(json: Record<string, unknown>) {
  forecastResponse = () => jsonResponse(json);
}

const DESKTOP_QUERY = '(min-width: 1024px)';

/** A matchMedia whose desktop query can flip at runtime, like a resize or tablet rotation. */
function mockMatchMedia(desktop: boolean) {
  const listeners = new Set<() => void>();
  let isDesktop = desktop;
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      get matches() {
        return query === DESKTOP_QUERY && isDesktop;
      },
      media: query,
      onchange: null,
      addEventListener: (_: string, l: () => void) => listeners.add(l),
      removeEventListener: (_: string, l: () => void) => listeners.delete(l),
      addListener: (l: () => void) => listeners.add(l),
      removeListener: (l: () => void) => listeners.delete(l),
      dispatchEvent: () => true,
    })),
  );
  return {
    setDesktop(value: boolean) {
      isDesktop = value;
      act(() => listeners.forEach((l) => l()));
    },
  };
}

beforeEach(() => {
  // Only Date and intervals are faked: debounce (setTimeout) and user-event keep real timers.
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(Date.UTC(2026, 9, 27, 10, 0));
  window.localStorage.clear();
  clearForecastCache();
  fetchMock.mockReset();
  setForecast(makeForecastJson({ offsetSeconds: 0, hourly: { uv_index: uvSeries() } }));
  fetchMock.mockImplementation(async (url: string) =>
    String(url).includes('geocoding-api')
      ? jsonResponse({ results: [LISBON] })
      : forecastResponse(),
  );
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('data-sheet-open');
});

function storePlace() {
  window.localStorage.setItem('uvgo:location', JSON.stringify(STORED_PLACE));
}

function storeInputs(inputs: Record<string, unknown>) {
  window.localStorage.setItem('uvgo:inputs', JSON.stringify(inputs));
}

/** Renders inside a `[data-page]` wrapper, like BaseLayout, so the sheets can make it inert. */
function renderApp() {
  const page = document.createElement('div');
  page.setAttribute('data-page', '');
  document.body.appendChild(page);
  const view = render(<UvGoApp />, { container: page });
  return { ...view, page };
}

const heroTime = () => document.querySelector<HTMLElement>('[data-hero-time]');

/** Resolves once the hero shows `label` as the best time. */
async function findHeroTime(label: string) {
  await waitFor(() => expect(heroTime()).toHaveTextContent(label));
}

function windowHours(label: string): number {
  const [start, end] = label.split('–').map((t) => Number(t.slice(0, 2)));
  return end - start;
}

describe('UvGoApp', () => {
  it('renders the H1 before hydration, in the server placeholder', () => {
    const html = renderToString(<UvGoApp />);
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain(HERO_H1);
  });

  it('first visit: the hero offers both ways to choose a place', async () => {
    const user = userEvent.setup();
    renderApp();
    expect(screen.getByRole('heading', { level: 1, name: HERO_H1 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use my location' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Hourly' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Find a city' }));
    expect(await screen.findByRole('dialog', { name: 'Cities' })).toBeInTheDocument();
  });

  it('picking Lisbon shows the best time, the hourly strip, the free time table and tiles', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Find a city' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cities' });
    await user.type(within(dialog).getByRole('combobox'), 'Lis');
    await user.click(await within(dialog).findByRole('option', { name: 'Lisbon, Portugal' }));

    await findHeroTime('18:00–19:00');
    expect(heroTime()?.textContent).toMatch(/^\d{2}:00–\d{2}:00$/);
    expect(await screen.findByRole('region', { name: 'Hourly' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Your free time, hour by hour' })).toBeInTheDocument();
    const take = screen.getByRole('region', { name: 'What to take' });
    expect(within(take).getAllByRole('listitem').length).toBeGreaterThan(0);
    expect(JSON.parse(window.localStorage.getItem('uvgo:location') ?? 'null')).toMatchObject({
      name: 'Lisbon',
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), {
      timeout: 3000,
    });
  });

  it('announces the best time in a polite live region', async () => {
    storePlace();
    renderApp();
    const live = await screen.findByText(
      'Best time 18:00–19:00, Good. Low UV, low chance of rain.',
    );
    expect(live).toHaveAttribute('aria-live', 'polite');
  });

  it('Plan opens a sheet whose controls recalculate the hero without a new request', async () => {
    storePlace();
    const user = userEvent.setup();
    renderApp();
    await findHeroTime('18:00–19:00');
    expect(forecastCalls()).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Plan' }));
    const sheet = await screen.findByRole('dialog', { name: 'Plan' });
    await user.click(within(sheet).getByRole('radio', { name: '3 h' }));

    await findHeroTime('16:00–19:00');
    expect(windowHours(heroTime()!.textContent!)).toBe(3);
    expect(forecastCalls()).toHaveLength(1);
    expect(JSON.parse(window.localStorage.getItem('uvgo:inputs') ?? 'null')).toMatchObject({
      duration: 180,
    });

    await user.click(within(sheet).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), {
      timeout: 3000,
    });
  });

  it('the Tomorrow tab shows the second day, and the day is not stored', async () => {
    // Tomorrow 13:00–18:00 all have UV 5, so the earliest hour wins.
    setForecast(makeForecastJson({ offsetSeconds: 0, hourly: { uv_index: uvSeries({ 42: 5 }) } }));
    storePlace();
    const user = userEvent.setup();
    renderApp();
    await findHeroTime('18:00–19:00');

    await user.click(screen.getByRole('tab', { name: 'Tomorrow' }));
    await findHeroTime('13:00–14:00');
    expect(screen.getByRole('tab', { name: 'Tomorrow' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Today' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('Peak UV 5 · Feels 20°')).toBeInTheDocument();
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'day-panel');
    expect(window.localStorage.getItem('uvgo:inputs') ?? '').not.toContain('tomorrow');
  });

  it('restores the place and inputs from storage', async () => {
    storePlace();
    storeInputs({ freeTime: { start: 9, end: 17 }, duration: 180, activity: 'active' });
    renderApp();
    expect(await screen.findByText('09:00–17:00 · Active · 3 h')).toBeInTheDocument();
    expect(heroTime()?.textContent).toMatch(/^\d{2}:00–\d{2}:00$/);
    expect(windowHours(heroTime()!.textContent!)).toBe(3);
    expect(screen.getByText('Lisbon', { selector: 'p' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Find a city' })).not.toBeInTheDocument();
  });

  it('shows skeleton cards while the forecast loads', async () => {
    storePlace();
    let release: () => void = () => {};
    const json = makeForecastJson({ offsetSeconds: 0, hourly: { uv_index: uvSeries() } });
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          release = () => resolve(jsonResponse(json));
        }),
    );
    renderApp();
    expect(await screen.findByText('Loading forecast…')).toBeInTheDocument();
    const busy = document.querySelectorAll('#day-panel [aria-busy="true"]');
    expect(busy.length).toBe(2);
    expect(screen.queryByRole('region', { name: 'What to take' })).not.toBeInTheDocument();

    await act(async () => release());
    await findHeroTime('18:00–19:00');
    expect(document.querySelectorAll('#day-panel [aria-busy="true"]')).toHaveLength(0);
  });

  it('shows the too-short state, with the cards but without What to take', async () => {
    storePlace();
    storeInputs({ freeTime: { start: 13, end: 14 }, duration: 120 });
    renderApp();
    expect(
      await screen.findByText(
        'Your free time is shorter than 2 h. Extend it or pick a shorter outing.',
      ),
    ).toBeInTheDocument();
    expect(heroTime()).toHaveTextContent('—');
    expect(screen.getByRole('region', { name: 'Hourly' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'What to take' })).not.toBeInTheDocument();
  });

  it('shows the dark state', async () => {
    storePlace();
    storeInputs({ freeTime: { start: 21, end: 23 } });
    renderApp();
    expect(
      await screen.findByText("It's dark during your free time. Try earlier hours."),
    ).toBeInTheDocument();
  });

  it('auto-switches to Tomorrow when today has passed, and does not repeat after returning', async () => {
    vi.setSystemTime(Date.UTC(2026, 9, 27, 20, 0));
    storePlace();
    const user = userEvent.setup();
    renderApp();
    expect(
      await screen.findByText('Your free time today has passed — showing tomorrow'),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tomorrow' })).toHaveAttribute('aria-selected', 'true');
    await findHeroTime('18:00–19:00');

    await user.click(screen.getByRole('tab', { name: 'Today' }));
    expect(await screen.findByText('No time left today.')).toBeInTheDocument();
    expect(screen.queryByText(/showing tomorrow/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show tomorrow' }));
    await findHeroTime('18:00–19:00');
    expect(screen.getByRole('tab', { name: 'Tomorrow' })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows the message in the hero when geolocation is denied', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: (_ok: PositionCallback, fail: PositionErrorCallback) =>
          fail({ code: 1 } as GeolocationPositionError),
      },
      configurable: true,
    });
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Use my location' }));
    expect(
      await screen.findByText("Can't get your location. Search a city instead."),
    ).toBeInTheDocument();
  });

  it('shows an error without cards and retries the forecast', async () => {
    storePlace();
    forecastResponse = () => jsonResponse({}, 500);
    const user = userEvent.setup();
    renderApp();
    expect(await screen.findByText("Couldn't load the forecast.")).toBeInTheDocument();
    expect(forecastCalls()).toHaveLength(1);
    expect(screen.queryByRole('region', { name: 'Hourly' })).not.toBeInTheDocument();
    expect(document.querySelector('#day-panel [aria-busy="true"]')).toBeNull();

    setForecast(makeForecastJson({ offsetSeconds: 0, hourly: { uv_index: uvSeries() } }));
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await findHeroTime('18:00–19:00');
    expect(forecastCalls()).toHaveLength(2);
  });

  it('refetches the forecast once the location passes midnight', async () => {
    vi.setSystemTime(Date.UTC(2026, 9, 27, 23, 30));
    storePlace();
    renderApp();
    await waitFor(() => expect(forecastCalls()).toHaveLength(1));
    await screen.findByRole('region', { name: 'Hourly' });

    setForecast(
      makeForecastJson({ date: '2026-10-28', offsetSeconds: 0, hourly: { uv_index: uvSeries() } }),
    );
    await act(async () => {
      vi.setSystemTime(Date.UTC(2026, 9, 28, 0, 5));
      vi.advanceTimersByTime(60_000);
    });
    await waitFor(() => expect(forecastCalls()).toHaveLength(2));

    // The same stale date must not trigger more requests.
    await act(async () => {
      vi.advanceTimersByTime(3 * 60_000);
    });
    expect(forecastCalls()).toHaveLength(2);
  });

  describe('hero collapse', () => {
    const bar = () => document.querySelector('[data-collapsed-bar]');
    const rootVar = () =>
      (document.querySelector('[data-page] > div') as HTMLElement).style.getPropertyValue(
        '--hero-collapsed-h',
      );

    it('phone: a pinned bar with the result, and the sticky headers sit below it', async () => {
      mockMatchMedia(false);
      storePlace();
      renderApp();
      await findHeroTime('18:00–19:00');
      expect(bar()).toHaveTextContent('Lisbon · 18:00–19:00 | Good');
      expect(bar()).toHaveAttribute('aria-hidden', 'true');
      expect(rootVar()).toBe('56px');
    });

    it('phone: focus scrolls clear of the bar, a stuck header and the toolbar', async () => {
      mockMatchMedia(false);
      storePlace();
      const { unmount } = renderApp();
      const html = document.documentElement.style;
      expect(html.getPropertyValue('scroll-padding-top')).toBe('');
      expect(html.getPropertyValue('scroll-padding-bottom')).toBe(
        'calc(72px + env(safe-area-inset-bottom))',
      );
      await findHeroTime('18:00–19:00');
      // 56 px of bar and the 64 px Hourly header.
      await waitFor(() => expect(html.getPropertyValue('scroll-padding-top')).toBe('120px'));
      unmount();
      expect(html.getPropertyValue('scroll-padding-top')).toBe('');
      expect(html.getPropertyValue('scroll-padding-bottom')).toBe('');
    });

    it('phone: the bar and the toolbar sit outside the page, and go inert under a sheet', async () => {
      mockMatchMedia(false);
      storePlace();
      const user = userEvent.setup();
      const { page } = renderApp();
      await findHeroTime('18:00–19:00');
      const toolbar = screen.getByRole('navigation', { name: 'App' });
      const layers = toolbar.closest('[data-fixed-layers]');
      expect(layers).not.toBeNull();
      expect(page.contains(toolbar)).toBe(false);
      expect(layers).toContainElement(bar() as HTMLElement);

      await user.click(screen.getByRole('button', { name: 'Plan' }));
      await screen.findByRole('dialog', { name: 'Plan' });
      expect(layers).toHaveAttribute('inert');
      expect(page).toHaveAttribute('inert');
    });

    it('phone: no bar without a result', () => {
      mockMatchMedia(false);
      renderApp();
      expect(bar()).toBeNull();
      expect(rootVar()).toBe('0px');
    });

    it('desktop: no bar and no offset', async () => {
      mockMatchMedia(true);
      storePlace();
      renderApp();
      await findHeroTime('18:00–19:00');
      expect(bar()).toBeNull();
      expect(rootVar()).toBe('0px');
      expect(document.documentElement.style.getPropertyValue('scroll-padding-top')).toBe('');
    });
  });

  describe('desktop', () => {
    it('has the Plan card on the page and no Plan button', async () => {
      mockMatchMedia(true);
      storePlace();
      renderApp();
      await findHeroTime('18:00–19:00');
      const plan = screen.getByRole('region', { name: 'Plan' });
      expect(within(plan).getByRole('radio', { name: '1 h' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Plan' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cities' })).toBeInTheDocument();
    });

    it('closes an open Plan sheet when the screen grows past the breakpoint', async () => {
      const media = mockMatchMedia(false);
      storePlace();
      const user = userEvent.setup();
      const { page } = renderApp();
      await findHeroTime('18:00–19:00');
      expect(screen.queryByRole('region', { name: 'Plan' })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Plan' }));
      await screen.findByRole('dialog', { name: 'Plan' });
      expect(page).toHaveAttribute('inert');

      media.setDesktop(true);

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), {
        timeout: 3000,
      });
      expect(page).not.toHaveAttribute('inert');
      expect(document.documentElement).not.toHaveAttribute('data-sheet-open');
      expect(screen.getByRole('region', { name: 'Plan' })).toBeVisible();

      // Back to a phone: the sheet stays closed.
      media.setDesktop(false);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
