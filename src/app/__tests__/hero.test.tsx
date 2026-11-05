import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { yourLocationPlace } from '../../data/geolocation';
import type { Place } from '../../data/types';
import type { TimeWindow } from '../../domain/types';
import { HERO_H1, Hero, type HeroState } from '../hero/Hero';

const LISBON: Place = { id: 2267057, name: 'Lisbon', lat: 38.72, lon: -9.14 };

const BEST: TimeWindow = {
  startHour: 15,
  hours: [],
  score: 100,
  verdict: 'green',
  label: '15:00–16:00',
};

function setup(state: HeroState, props: Partial<Parameters<typeof Hero>[0]> = {}) {
  const handlers = {
    onUseLocation: vi.fn(),
    onFindCity: vi.fn(),
    onRetry: vi.fn(),
    onShowTomorrow: vi.fn(),
  };
  const view = render(
    <Hero
      state={state}
      locating={false}
      geoError={false}
      notice={false}
      intro={false}
      {...handlers}
      {...props}
    />,
  );
  return { ...view, ...handlers };
}

const bigTime = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-hero-time]') as HTMLElement;

describe('Hero', () => {
  it('has the H1 in every state', () => {
    const states: HeroState[] = [
      { kind: 'no-place' },
      { kind: 'loading', place: LISBON },
      { kind: 'error', place: LISBON },
      { kind: 'empty', place: LISBON, reason: 'dark', duration: 60 },
      { kind: 'result', place: LISBON, best: BEST, reason: null, duration: 60, nowLine: '' },
    ];
    for (const state of states) {
      const { unmount } = setup(state);
      expect(screen.getByRole('heading', { level: 1, name: HERO_H1 })).toBeInTheDocument();
      unmount();
    }
  });

  describe('no place', () => {
    it('asks to choose a place and offers both ways', async () => {
      const user = userEvent.setup();
      const { container, onUseLocation, onFindCity } = setup({ kind: 'no-place' });
      expect(screen.getByText('Choose a place')).toBeInTheDocument();
      expect(bigTime(container)).toHaveTextContent('--:--');
      await user.click(screen.getByRole('button', { name: 'Use my location' }));
      await user.click(screen.getByRole('button', { name: 'Find a city' }));
      expect(onUseLocation).toHaveBeenCalledTimes(1);
      expect(onFindCity).toHaveBeenCalledTimes(1);
    });

    it('announces a geolocation error', () => {
      setup({ kind: 'no-place' }, { geoError: true });
      expect(screen.getByRole('alert')).toHaveTextContent(
        "Can't get your location. Search for a city instead.",
      );
    });

    it('has no error text without geoError', () => {
      setup({ kind: 'no-place' });
      expect(screen.getByRole('alert')).toBeEmptyDOMElement();
    });

    it('disables the location button while locating', () => {
      setup({ kind: 'no-place' }, { locating: true });
      const button = screen.getByRole('button', { name: 'Locating…' });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-busy', 'true');
    });

    it('gives the "Find a city" button the ref', () => {
      const ref = { current: null as HTMLButtonElement | null };
      setup({ kind: 'no-place' }, { findCityRef: ref });
      expect(ref.current).toBe(screen.getByRole('button', { name: 'Find a city' }));
    });
  });

  it('loading: city, a placeholder time and a status line', () => {
    const { container } = setup({ kind: 'loading', place: LISBON });
    expect(screen.getByText('Lisbon')).toBeInTheDocument();
    expect(bigTime(container)).toHaveTextContent('--:--');
    expect(screen.getByRole('status')).toHaveTextContent('Loading forecast…');
  });

  it('error: announces the failure and retries', async () => {
    const user = userEvent.setup();
    const { container, onRetry } = setup({ kind: 'error', place: LISBON });
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load the forecast");
    expect(bigTime(container)).toHaveTextContent('--:--');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  describe('empty', () => {
    it('too-short names the duration', () => {
      const { container } = setup({
        kind: 'empty',
        place: LISBON,
        reason: 'too-short',
        duration: 120,
      });
      expect(
        screen.getByText('Your free time is shorter than 2 h. Extend it or pick a shorter outing.'),
      ).toBeInTheDocument();
      expect(bigTime(container)).toHaveTextContent('—');
      expect(screen.queryByRole('button', { name: 'Show tomorrow' })).toBeNull();
    });

    it('dark', () => {
      setup({ kind: 'empty', place: LISBON, reason: 'dark', duration: 60 });
      expect(
        screen.getByText('No daylight window fits this outing. Change your free time or duration.'),
      ).toBeInTheDocument();
    });

    it('past offers tomorrow', async () => {
      const user = userEvent.setup();
      const { onShowTomorrow } = setup({
        kind: 'empty',
        place: LISBON,
        reason: 'past',
        duration: 60,
      });
      expect(screen.getByText('No future start time fits your plan today.')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Show tomorrow' }));
      expect(onShowTomorrow).toHaveBeenCalledTimes(1);
    });
  });

  describe('result', () => {
    const state: HeroState = {
      kind: 'result',
      place: LISBON,
      best: BEST,
      reason: 'Low UV and no rain',
      duration: 60,
      nowLine: 'Now UV 6 · Feels 24°',
    };

    it('shows the city, the window, the verdict line, the reason and the now line', () => {
      const { container } = setup(state);
      expect(screen.getByText('Lisbon')).toBeInTheDocument();
      expect(bigTime(container)).toHaveTextContent('15:00–16:00');
      expect(screen.getByText('Good · 1 h')).toBeInTheDocument();
      expect(container.querySelector('[data-verdict="green"]')).not.toBeNull();
      expect(screen.getByText('Low UV and no rain')).toBeInTheDocument();
      expect(screen.getByText('Now UV 6 · Feels 24°')).toBeInTheDocument();
    });

    it('omits the reason and now line when they are empty', () => {
      setup({ ...state, reason: null, nowLine: '' });
      expect(screen.queryByText('Low UV and no rain')).toBeNull();
      expect(screen.queryByText(/Now UV/)).toBeNull();
    });

    it('titles a geolocated place "My location" with an arrow', () => {
      setup({ ...state, place: yourLocationPlace(38.7, -9.1) });
      expect(screen.getByText('My location')).toBeInTheDocument();
    });
  });

  describe('Cities pin (desktop)', () => {
    const RESULT: HeroState = {
      kind: 'result',
      place: LISBON,
      best: BEST,
      reason: null,
      duration: 60,
      nowLine: '',
    };

    it('sits next to the place name and opens Cities', async () => {
      const user = userEvent.setup();
      const onCities = vi.fn();
      const citiesRef = createRef<HTMLButtonElement>();
      setup(RESULT, { onCities, citiesRef });
      const pin = screen.getByRole('button', { name: 'Cities' });
      expect(pin.previousElementSibling).toHaveTextContent('Lisbon');
      expect(pin.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
      expect(citiesRef.current).toBe(pin);
      await user.click(pin);
      expect(onCities).toHaveBeenCalledTimes(1);
    });

    it('is there in every state with a place, not before one is chosen', () => {
      const withPlace: HeroState[] = [
        { kind: 'loading', place: LISBON },
        { kind: 'error', place: LISBON },
        { kind: 'empty', place: LISBON, reason: 'dark', duration: 60 },
        RESULT,
      ];
      for (const state of withPlace) {
        const { unmount } = setup(state, { onCities: vi.fn() });
        expect(screen.getByRole('button', { name: 'Cities' })).toBeInTheDocument();
        unmount();
      }
      setup({ kind: 'no-place' }, { onCities: vi.fn() });
      expect(screen.queryByRole('button', { name: 'Cities' })).not.toBeInTheDocument();
    });

    it('is absent without onCities (a phone: Cities is in the toolbar)', () => {
      setup(RESULT);
      expect(screen.queryByRole('button', { name: 'Cities' })).not.toBeInTheDocument();
    });
  });

  it('notice: plain text on the sky about the switch to tomorrow, no plate or border', () => {
    setup(
      { kind: 'result', place: LISBON, best: BEST, reason: null, duration: 60, nowLine: '' },
      { notice: true },
    );
    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('No future start time fits today — showing tomorrow');
    expect(notice).not.toHaveClass('glass');
    expect(notice.closest('.sky-text')).not.toBeNull();
  });

  it('puts the What to take slot under the answer and above the notice', () => {
    setup(
      { kind: 'result', place: LISBON, best: BEST, reason: null, duration: 60, nowLine: '' },
      { notice: true, take: <ul data-testid="take" /> },
    );
    const take = screen.getByTestId('take');
    const time = document.querySelector('[data-hero-time]')!;
    const notice = screen.getByRole('status');
    expect(time.compareDocumentPosition(take) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(take.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('uses no secondary text colour anywhere in the hero (AA on the bare sky needs full white)', () => {
    const states: HeroState[] = [
      { kind: 'no-place' },
      { kind: 'loading', place: LISBON },
      { kind: 'error', place: LISBON },
      { kind: 'empty', place: LISBON, reason: 'past', duration: 60 },
      {
        kind: 'result',
        place: LISBON,
        best: BEST,
        reason: 'Low UV',
        duration: 60,
        nowLine: 'Now UV 6 · Feels 24°',
      },
    ];
    for (const state of states) {
      const { container, unmount } = setup(state, { notice: true, geoError: true });
      expect(container.querySelectorAll('.text-text-muted')).toHaveLength(0);
      unmount();
    }
  });

  it('puts its text straight on the sky, every line inside the rim of .sky-text', () => {
    const { container } = setup({ kind: 'no-place' }, { geoError: true });
    expect(container.querySelector('.hero-scrim')).toBeNull();
    const lines = [
      screen.getByRole('heading', { level: 1 }),
      screen.getByText('Choose a place'),
      screen.getByRole('button', { name: 'Use my location' }),
      screen.getByRole('alert'),
    ];
    for (const line of lines) expect(line.closest('.sky-text')).not.toBeNull();
  });
});
