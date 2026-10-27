import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearForecastCache } from '../../data/openMeteo';
import { makeForecastJson } from '../../test/forecastJson';
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

/** UV 5 (2 points) from 13:00 to 17:00 on both days, 0 elsewhere: 18:00 is the best hour. */
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
});

function storePlace() {
  window.localStorage.setItem('uvgo:location', JSON.stringify(STORED_PLACE));
}

function storeInputs(inputs: Record<string, unknown>) {
  window.localStorage.setItem('uvgo:inputs', JSON.stringify(inputs));
}

describe('UvGoApp', () => {
  it('shows result after choosing a city', async () => {
    const user = userEvent.setup();
    render(<UvGoApp />);
    expect(screen.getByText('Where are you heading out?')).toBeInTheDocument();
    await user.type(screen.getByRole('combobox'), 'Lis');
    await user.click(await screen.findByRole('option', { name: 'Lisbon, Portugal' }));
    expect(await screen.findByText('18:00–19:00')).toBeInTheDocument();
    expect(screen.getByText('Good')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('uvgo:location') ?? 'null')).toMatchObject({
      name: 'Lisbon',
    });
  });

  it('announces the best time in a polite live region', async () => {
    storePlace();
    render(<UvGoApp />);
    const live = await screen.findByText(
      'Best time 18:00–19:00, Good. Low UV, low chance of rain.',
    );
    expect(live).toHaveAttribute('aria-live', 'polite');
  });

  it('restores the place from storage and loads the forecast without interaction', async () => {
    storePlace();
    render(<UvGoApp />);
    expect(await screen.findByText('18:00–19:00')).toBeInTheDocument();
    expect(screen.getByText('Lisbon, Portugal')).toBeInTheDocument();
    expect(screen.queryByText('Where are you heading out?')).not.toBeInTheDocument();
  });

  it('recalculates on Duration change without a new forecast request', async () => {
    storePlace();
    const user = userEvent.setup();
    render(<UvGoApp />);
    await screen.findByText('18:00–19:00');
    expect(forecastCalls()).toHaveLength(1);
    await user.click(screen.getByRole('radio', { name: '3 h' }));
    expect(await screen.findByText('16:00–19:00')).toBeInTheDocument();
    expect(forecastCalls()).toHaveLength(1);
    expect(JSON.parse(window.localStorage.getItem('uvgo:inputs') ?? 'null')).toMatchObject({
      duration: 180,
    });
  });

  it('does not store the day', async () => {
    storePlace();
    const user = userEvent.setup();
    render(<UvGoApp />);
    await screen.findByText('18:00–19:00');
    await user.click(screen.getByRole('radio', { name: 'Tomorrow' }));
    await user.click(screen.getByRole('radio', { name: 'Relaxed' }));
    expect(window.localStorage.getItem('uvgo:inputs')).not.toContain('tomorrow');
  });

  it('shows the too-short state', async () => {
    storePlace();
    storeInputs({ freeTime: { start: 13, end: 14 }, duration: 120 });
    render(<UvGoApp />);
    expect(
      await screen.findByText(
        'Your free time is shorter than 2 h. Extend it or pick a shorter outing.',
      ),
    ).toBeInTheDocument();
  });

  it('shows the dark state', async () => {
    storePlace();
    storeInputs({ freeTime: { start: 21, end: 23 } });
    render(<UvGoApp />);
    expect(
      await screen.findByText("It's dark during your free time. Try earlier hours."),
    ).toBeInTheDocument();
  });

  it('auto-switches to Tomorrow when today has passed, and does not repeat after returning', async () => {
    vi.setSystemTime(Date.UTC(2026, 9, 27, 20, 0));
    storePlace();
    const user = userEvent.setup();
    render(<UvGoApp />);
    expect(
      await screen.findByText('Your free time today has passed — showing tomorrow'),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Tomorrow' })).toHaveAttribute('aria-checked', 'true');
    expect(await screen.findByText('18:00–19:00')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Today' }));
    expect(await screen.findByText('No time left today.')).toBeInTheDocument();
    expect(screen.queryByText(/showing tomorrow/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show tomorrow' }));
    expect(await screen.findByText('18:00–19:00')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Tomorrow' })).toHaveAttribute('aria-checked', 'true');
  });

  it('shows a message and focuses the search when geolocation is denied', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: (_ok: PositionCallback, fail: PositionErrorCallback) =>
          fail({ code: 1 } as GeolocationPositionError),
      },
      configurable: true,
    });
    const user = userEvent.setup();
    render(<UvGoApp />);
    await user.click(screen.getByRole('button', { name: 'Use my location' }));
    expect(
      await screen.findByText("Can't get your location. Search a city instead."),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveFocus());
  });

  it('shows an error and retries the forecast', async () => {
    storePlace();
    forecastResponse = () => jsonResponse({}, 500);
    const user = userEvent.setup();
    render(<UvGoApp />);
    expect(await screen.findByText("Couldn't load the forecast.")).toBeInTheDocument();
    expect(forecastCalls()).toHaveLength(1);

    setForecast(makeForecastJson({ offsetSeconds: 0, hourly: { uv_index: uvSeries() } }));
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('18:00–19:00')).toBeInTheDocument();
    expect(forecastCalls()).toHaveLength(2);
  });

  it('shows "no data" in the hour details for missing values', async () => {
    // UV is null at 15:00, so 15:00 ties with 18:00 at 0 points and wins on the earlier start.
    setForecast(
      makeForecastJson({ offsetSeconds: 0, hourly: { uv_index: uvSeries({ 15: null }) } }),
    );
    storePlace();
    const user = userEvent.setup();
    render(<UvGoApp />);
    await screen.findByText('15:00–16:00');
    const slider = screen.getByRole('slider', { name: 'Hour of the day' });
    act(() => slider.focus());
    await user.keyboard('{ArrowRight}{ArrowLeft}');
    expect(slider).toHaveAttribute('aria-valuenow', '15');
    const details = screen.getByRole('region', { name: 'Details for 15:00' });
    expect(within(details).getByText('no data')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Details for 15:00' })).not.toBeInTheDocument();
  });

  it('refetches the forecast once the location passes midnight', async () => {
    vi.setSystemTime(Date.UTC(2026, 9, 27, 23, 30));
    storePlace();
    render(<UvGoApp />);
    await waitFor(() => expect(forecastCalls()).toHaveLength(1));
    await screen.findByRole('slider', { name: 'Hour of the day' });

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
});
