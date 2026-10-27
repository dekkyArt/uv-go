import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeWindow } from '../../domain/__tests__/factories';
import { clearForecastCache } from '../../data/openMeteo';
import type { EvaluationResult, TimeWindow } from '../../domain/types';
import { makeForecastJson } from '../../test/forecastJson';
import { MiniResult } from '../components/MiniResult';
import { ResultCard } from '../components/ResultCard';
import UvGoApp from '../UvGoApp';

const BEST_LABEL = '18:00–19:00';

function makeResult(): EvaluationResult & { best: TimeWindow } {
  const best: TimeWindow = {
    ...makeWindow({ 18: { uv: 2.4 } }),
    score: 2.5,
    verdict: 'green',
    label: BEST_LABEL,
  };
  return {
    scoredHours: [],
    best,
    emptyReason: null,
    reason: 'Low UV, low chance of rain.',
    checklist: [{ id: 'water', label: 'Water' }],
  };
}

describe('ResultCard', () => {
  it('has the time and the verdict text in the DOM right after render', () => {
    render(<ResultCard result={makeResult()} activity="relaxed" />);
    expect(screen.getByText(BEST_LABEL)).toBeInTheDocument();
    expect(screen.getByText('Good')).toBeInTheDocument();
    expect(screen.getByText('Low UV, low chance of rain.')).toBeInTheDocument();
    expect(screen.getByText('Water')).toBeInTheDocument();
  });

  it('keeps the answer for screen readers while the label sits in the search frame', () => {
    render(<ResultCard result={makeResult()} activity="relaxed" intro labelInFrame />);
    expect(screen.queryByText(BEST_LABEL)).not.toBeInTheDocument();
    expect(screen.getByText(`Best time ${BEST_LABEL}`)).toBeInTheDocument();
    expect(screen.getByText('Good')).toBeInTheDocument();
  });

  it('shows the peak UV of the window', () => {
    render(<ResultCard result={makeResult()} activity="relaxed" />);
    expect(screen.getByText('UV')).toHaveTextContent('UV 2');
  });

  it('expands "Why this time?" and shows the score with one decimal', async () => {
    const user = userEvent.setup();
    render(<ResultCard result={makeResult()} activity="relaxed" />);
    await user.click(screen.getByText('Why this time?'));
    expect(screen.getByText(/Average score 2\.5/)).toBeVisible();
  });
});

describe('MiniResult', () => {
  it('shows the label and verdict as one button of at least 44 px', () => {
    render(<MiniResult label={BEST_LABEL} verdict="green" visible onClick={() => {}} />);
    const button = screen.getByRole('button', { name: `${BEST_LABEL} · Good` });
    expect(button.className).toMatch(/min-h-11/);
  });

  it('renders nothing while hidden and calls onClick on tap', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(
      <MiniResult label={BEST_LABEL} verdict="green" visible={false} onClick={onClick} />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    rerender(<MiniResult label={BEST_LABEL} verdict="green" visible onClick={onClick} />);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

// ---- Whole app: first-result choreography, mini result ----

const STORED_PLACE = {
  id: 2267057,
  name: 'Lisbon',
  admin1: 'Lisbon',
  country: 'Portugal',
  lat: 38.72,
  lon: -9.14,
};

/** UV 5 from 13:00 to 17:00 on both days: 18:00 is the best hour. */
const uv = Array.from({ length: 48 }, (_, i) => (i % 24 >= 13 && i % 24 <= 17 ? 5 : 0));
const fetchMock = vi.fn();

function stubMatchMedia(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: reduce && query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

type ObserverCallback = (entries: Partial<IntersectionObserverEntry>[]) => void;
let observers: { callback: ObserverCallback; target: Element | null }[] = [];

function stubIntersectionObserver() {
  observers = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      entry: { callback: ObserverCallback; target: Element | null };
      constructor(callback: ObserverCallback) {
        this.entry = { callback, target: null };
        observers.push(this.entry);
      }
      observe(target: Element) {
        this.entry.target = target;
      }
      unobserve() {}
      disconnect() {}
    },
  );
}

function scrollCardOffscreen(offscreen: boolean) {
  act(() => {
    for (const o of observers) {
      o.callback([
        {
          isIntersecting: !offscreen,
          target: o.target ?? undefined,
          boundingClientRect: { top: offscreen ? -300 : 40 } as DOMRectReadOnly,
        },
      ]);
    }
  });
}

beforeEach(() => {
  // Only Date and intervals are faked: the choreography timers and user-event keep real time.
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(Date.UTC(2026, 9, 27, 10, 0));
  window.localStorage.clear();
  window.localStorage.setItem('uvgo:location', JSON.stringify(STORED_PLACE));
  clearForecastCache();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => ({
    ok: true,
    status: 200,
    json: async () => makeForecastJson({ offsetSeconds: 0, hourly: { uv_index: uv } }),
  }));
  vi.stubGlobal('fetch', fetchMock);
  stubMatchMedia(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const article = () => screen.getByRole('article', { name: 'Best time' });

describe('first result in the app', () => {
  it('shows the search frame with the label first, then hands the label to the card', async () => {
    render(<UvGoApp />);
    const label = await screen.findByText(BEST_LABEL);
    const frame = document.querySelector('[data-search-frame]');
    expect(frame).toBeInTheDocument();
    expect(frame).toContainElement(label);
    expect(within(article()).queryByText(BEST_LABEL)).not.toBeInTheDocument();

    await waitFor(() => expect(within(article()).getByText(BEST_LABEL)).toBeInTheDocument(), {
      timeout: 1500,
    });
    expect(document.querySelector('[data-search-frame]')).not.toBeInTheDocument();
    // The best window stays outlined on the strip.
    expect(document.querySelector('[data-best-frame]')).toBeInTheDocument();
  });

  it('does not replay the intro when an input changes, but does on a day change', async () => {
    const user = userEvent.setup();
    render(<UvGoApp />);
    await waitFor(() => expect(within(article()).getByText(BEST_LABEL)).toBeInTheDocument(), {
      timeout: 1500,
    });

    await user.click(screen.getByRole('radio', { name: '3 h' }));
    expect(await screen.findByText('16:00–19:00')).toBeInTheDocument();
    expect(document.querySelector('[data-search-frame]')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Tomorrow' }));
    await waitFor(() => expect(document.querySelector('[data-search-frame]')).toBeInTheDocument());
  });

  it('with reduced motion renders no search frame and puts the label straight in the card', async () => {
    stubMatchMedia(true);
    render(<UvGoApp />);
    expect(await within(await screen.findByRole('article')).findByText(BEST_LABEL)).toBeVisible();
    expect(document.querySelector('[data-search-frame]')).not.toBeInTheDocument();
    expect(document.querySelector('[data-best-frame]')).toBeInTheDocument();
  });
});

describe('mini result in the app', () => {
  it('appears when the card is out of view and scrolls back to it on tap', async () => {
    stubIntersectionObserver();
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const user = userEvent.setup();
    render(<UvGoApp />);
    await screen.findByText(BEST_LABEL);
    // The card follows the loading card's short exit; the observer attaches to it.
    await screen.findByRole('article', { name: 'Best time' });
    expect(screen.queryByRole('button', { name: `${BEST_LABEL} · Good` })).not.toBeInTheDocument();

    scrollCardOffscreen(true);
    const mini = await screen.findByRole('button', { name: `${BEST_LABEL} · Good` });
    await user.click(mini);
    expect(scrollIntoView).toHaveBeenCalled();
    expect(scrollIntoView.mock.contexts[0]).toBe(article());

    scrollCardOffscreen(false);
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: `${BEST_LABEL} · Good` }),
      ).not.toBeInTheDocument(),
    );
  });

  it('stays hidden when IntersectionObserver is unavailable', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<UvGoApp />);
    await screen.findByText(BEST_LABEL);
    expect(screen.queryByRole('button', { name: `${BEST_LABEL} · Good` })).not.toBeInTheDocument();
  });
});
