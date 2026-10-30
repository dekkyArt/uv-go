import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearForecastCache } from '../../data/openMeteo';
import { evaluate } from '../../domain/evaluate';
import { makeDay } from '../../domain/__tests__/factories';
import { useFeaturesFailed } from '../../motion/featuresFailed';
import { MotionProvider } from '../../motion/MotionProvider';
import { makeForecastJson } from '../../test/forecastJson';
import { HourlyCard } from '../cards/HourlyCard';
import { CELL_W } from '../ui';
import UvGoApp from '../UvGoApp';

// The lazily loaded motion features never arrive.
vi.mock('../../motion/features', () => {
  throw new Error('chunk failed to load');
});

const STORED_PLACE = {
  id: 2267057,
  name: 'Lisbon',
  admin1: 'Lisbon',
  country: 'Portugal',
  lat: 38.72,
  lon: -9.14,
};

/** UV 5 from 13:00 to 17:00, 0 elsewhere: 18:00–19:00 is the best hour. */
const uv = Array.from({ length: 48 }, (_, i) => (i % 24 >= 13 && i % 24 <= 17 ? 5 : 0));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(Date.UTC(2026, 9, 27, 10, 0));
  window.localStorage.clear();
  clearForecastCache();
  const json = makeForecastJson({ offsetSeconds: 0, hourly: { uv_index: uv } });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, json: async () => json }) as unknown as Response),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('data-sheet-open');
});

/** Hidden by an `initial` that never animated: no opacity 0, no blur, no slide left behind. */
function expectAtRest(el: Element | null) {
  expect(el).not.toBeNull();
  const style = (el as HTMLElement).style;
  expect(style.opacity === '' || style.opacity === '1').toBe(true);
  expect(style.filter).not.toMatch(/blur/);
  expect(style.transform).not.toMatch(/translate|100%/);
}

describe('when the motion features chunk fails to load', () => {
  it('marks the failure for the app', async () => {
    function Probe() {
      return <p>{useFeaturesFailed() ? 'failed' : 'loading'}</p>;
    }
    render(
      <MotionProvider>
        <Probe />
      </MotionProvider>,
    );
    expect(await screen.findByText('failed')).toBeInTheDocument();
  });

  it('the hour strip still lands on "Now"', async () => {
    const day = makeDay({ 14: { uv: 5.4 } });
    const freeTime = { start: 9, end: 17 };
    const { scoredHours, best } = evaluate(
      day,
      { day: 'today', freeTime, duration: 60, activity: 'relaxed' },
      null,
    );
    const scrollLeft = vi.spyOn(HTMLElement.prototype, 'scrollLeft', 'set');
    const { container } = render(
      <MotionProvider>
        <HourlyCard
          day={day}
          hours={scoredHours}
          freeTime={freeTime}
          best={best}
          selectedHour={null}
          nowHour={11}
          onSelect={() => {}}
          intro
          index={0}
        />
      </MotionProvider>,
    );
    // 11 hours before it plus the sunrise cell, and snapping handed back.
    await waitFor(() => expect(scrollLeft).toHaveBeenLastCalledWith(12 * CELL_W));
    const strip = container.querySelector<HTMLElement>('[data-hourly-strip]')!;
    expect(strip.style.scrollSnapType).toBe('');
    scrollLeft.mockRestore();
  });

  it('the app shows the best time, the hour details and the Plan sheet at rest', async () => {
    window.localStorage.setItem('uvgo:location', JSON.stringify(STORED_PLACE));
    const user = userEvent.setup();
    const page = document.createElement('div');
    page.setAttribute('data-page', '');
    document.body.appendChild(page);
    render(<UvGoApp />, { container: page });

    const time = () => document.querySelector('[data-hero-time]');
    await waitFor(() => expect(time()).toHaveTextContent('18:00–19:00'));
    // Past the whole intro, nothing is still waiting to come in.
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expectAtRest(time());
    for (const char of document.querySelectorAll('[data-hero-time] [data-char]'))
      expectAtRest(char);

    await user.click(screen.getByRole('button', { name: /^14:00,/ }));
    expectAtRest(screen.getByRole('region', { name: 'Details for 14:00' }).parentElement);

    await user.click(screen.getByRole('button', { name: 'Plan' }));
    expectAtRest(await screen.findByRole('dialog', { name: 'Plan' }));
    expectAtRest(document.querySelector('[data-sheet-backdrop]'));
  });
});
