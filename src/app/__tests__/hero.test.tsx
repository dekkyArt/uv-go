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
        "Can't get your location. Search a city instead.",
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
        screen.getByText("It's dark during your free time. Try earlier hours."),
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
      expect(screen.getByText('No time left today.')).toBeInTheDocument();
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

  it('notice: a status pill about the switch to tomorrow', () => {
    setup(
      { kind: 'result', place: LISBON, best: BEST, reason: null, duration: 60, nowLine: '' },
      { notice: true },
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Your free time today has passed — showing tomorrow',
    );
  });

  it('has the decorative scrim, hidden from assistive tech', () => {
    const { container } = setup({ kind: 'no-place' });
    const scrim = container.querySelector('.hero-scrim');
    expect(scrim).not.toBeNull();
    expect(scrim).toHaveAttribute('aria-hidden', 'true');
  });
});
