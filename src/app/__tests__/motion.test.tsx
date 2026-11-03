import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearForecastCache } from '../../data/openMeteo';
import { makeDay, makeWindow } from '../../domain/__tests__/factories';
import { evaluate } from '../../domain/evaluate';
import { rules } from '../../domain/rules.config';
import type { TimeWindow } from '../../domain/types';
import { totalDuration } from '../../motion/choreography';
import { MotionProvider } from '../../motion/MotionProvider';
import { durations, ease, springs } from '../../motion/tokens';
import { makeForecastJson } from '../../test/forecastJson';
import { FreeTimeCard } from '../cards/FreeTimeCard';
import { HourlyCard } from '../cards/HourlyCard';
import { TakeChips } from '../cards/TakeChips';
import { Hero, type HeroState } from '../hero/Hero';
import UvGoApp from '../UvGoApp';

// The components read the preference through `useReducedMotion`; the media query itself stays
// "no preference", so the reduced cases test the components' own fallbacks, not MotionConfig's.
const prefs = vi.hoisted(() => ({ reduced: false }));
vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('motion/react')>()),
  useReducedMotion: () => prefs.reduced,
}));

const fetchMock = vi.fn();

beforeEach(() => {
  prefs.reduced = false;
  window.localStorage.clear();
  clearForecastCache();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => ({
    ok: true,
    status: 200,
    json: async () => makeForecastJson({ offsetSeconds: 0 }),
  }));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('data-sheet-open');
});

const BEST: TimeWindow = {
  startHour: 15,
  hours: [],
  score: 100,
  verdict: 'green',
  label: '15:00–16:00',
};
const RESULT: HeroState = {
  kind: 'result',
  place: { id: 1, name: 'Lisbon', lat: 38.72, lon: -9.14 },
  best: BEST,
  reason: null,
  duration: 60,
  nowLine: '',
};
const FREE = { start: 9, end: 17 };

function Result({ intro }: { intro: boolean }) {
  const day = makeDay({ 14: { uv: 5.4 }, 10: { uv: 2 } });
  const { scoredHours, best } = evaluate(
    day,
    { day: 'today', freeTime: FREE, duration: 60, activity: 'relaxed' },
    null,
  );
  const noop = () => {};
  return (
    <>
      <Hero
        state={RESULT}
        locating={false}
        geoError={false}
        notice={false}
        intro={intro}
        onUseLocation={noop}
        onFindCity={noop}
        onRetry={noop}
        onShowTomorrow={noop}
      />
      <HourlyCard
        index={0}
        day={day}
        dayName="Today"
        hours={scoredHours}
        freeTime={FREE}
        best={best}
        selectedHour={null}
        nowHour={11}
        onSelect={noop}
        intro={intro}
      />
      <FreeTimeCard
        index={1}
        hours={scoredHours}
        freeTime={FREE}
        best={best}
        nowHour={11}
        duration={60}
        activity="relaxed"
        intro={intro}
      />
      <TakeChips
        items={(['sunscreen', 'water'] as const).map((id) => ({
          id,
          label: rules.checklistLabels[id],
        }))}
        window={best ?? makeWindow({ 15: { uv: 4 } })}
        activity="relaxed"
        intro={intro}
      />
    </>
  );
}

const renderMotion = (ui: ReactNode) => render(<MotionProvider>{ui}</MotionProvider>);
const heroTime = () => document.querySelector<HTMLElement>('[data-hero-time]')!;
const outline = () => document.querySelector<SVGRectElement>('[data-best-outline] rect')!;
const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));

describe('first-result choreography', () => {
  it('brings the best time in from blur and settles on the final values', async () => {
    renderMotion(<Result intro />);
    expect(Number(heroTime().style.opacity)).toBeLessThan(1);
    expect(heroTime().style.filter).toContain('blur(8px)');
    await sleep(totalDuration());
    await waitFor(() => expect(heroTime().style.opacity).toBe('1'));
    await waitFor(() => expect(heroTime().style.filter).toBe('none'));
    expect(heroTime().style.transform).toBe('none');
  });

  it('draws the best-window outline along its path', async () => {
    renderMotion(<Result intro />);
    expect(outline()).toHaveAttribute('pathLength', '1');
    expect(outline().getAttribute('stroke-dasharray')).toBe('0 1');
    await sleep(totalDuration());
    await waitFor(() => expect(outline().getAttribute('stroke-dasharray')).toBe('1 1'));
  });

  it('lifts the cards in with a stagger and grows the bars from the left', async () => {
    renderMotion(<Result intro />);
    const cards = document.querySelectorAll<HTMLElement>('section.glass');
    expect(cards).toHaveLength(2);
    for (const card of cards) {
      expect(card.style.opacity).toBe('0');
      expect(card.style.transform).toContain('translateY(16px)');
    }
    const fills = document.querySelectorAll<HTMLElement>('[data-bar-fill]');
    expect(fills.length).toBeGreaterThan(0);
    for (const fill of fills) expect(fill.style.clipPath).toMatch(/^inset\(0(px)? 100%/);
    const chips = screen.getAllByRole('listitem');
    for (const chip of chips) expect(chip.style.transform).toContain('scale(0.94)');

    await sleep(totalDuration());
    await waitFor(() => {
      for (const card of cards) expect(card.style.opacity).toBe('1');
    });
    for (const card of cards) expect(card.style.transform).toBe('none');
    for (const chip of chips) expect(chip.style.transform).toBe('none');
    const bar = fills[0].closest<HTMLElement>('[data-score-bar]')!;
    const rest = (1 - Number(bar.dataset.fill)) * 100;
    expect(fills[0].style.clipPath).toContain(`${rest}%`);
  });

  it('scrolls the hour strip to "Now" during the intro', async () => {
    const scrollLeft = vi.spyOn(HTMLElement.prototype, 'scrollLeft', 'set');
    renderMotion(<Result intro />);
    expect(scrollLeft).toHaveBeenLastCalledWith(0);
    await sleep(totalDuration());
    // 11 hours before "Now" plus the sunrise cell
    await waitFor(() => expect(scrollLeft).toHaveBeenLastCalledWith(12 * 56));
    scrollLeft.mockRestore();
  });

  it('shows the final values at once without an intro', () => {
    renderMotion(<Result intro={false} />);
    expect(heroTime().style.opacity).toBe('1');
    expect(outline()).not.toHaveAttribute('stroke-dasharray');
    for (const card of document.querySelectorAll<HTMLElement>('section.glass')) {
      expect(card.style.opacity).toBe('1');
    }
    expect(document.body.innerHTML).not.toContain('blur');
  });

  it('with reduced motion, shows the final values at once and never blurs', () => {
    prefs.reduced = true;
    renderMotion(<Result intro />);
    expect(heroTime().style.opacity).toBe('1');
    expect(heroTime().style.transform).not.toContain('translate');
    expect(outline()).not.toHaveAttribute('stroke-dasharray');
    for (const card of document.querySelectorAll<HTMLElement>('section.glass')) {
      expect(card.style.opacity).toBe('1');
      expect(card.style.transform).not.toContain('translate');
    }
    for (const chip of screen.getAllByRole('listitem')) {
      expect(chip.style.transform).not.toContain('scale');
    }
    const fill = document.querySelector<HTMLElement>('[data-bar-fill]')!;
    const rest = (1 - Number(fill.closest<HTMLElement>('[data-score-bar]')!.dataset.fill)) * 100;
    expect(fill.style.clipPath).toContain(`${rest}%`);
    expect(document.body.innerHTML).not.toContain('blur');
  });

  it('pulses the loading placeholder no lower than 0.6 opacity', async () => {
    const noop = () => {};
    renderMotion(
      <Hero
        state={{ kind: 'loading', place: RESULT.place }}
        locating={false}
        geoError={false}
        notice={false}
        intro={false}
        onUseLocation={noop}
        onFindCity={noop}
        onRetry={noop}
        onShowTomorrow={noop}
      />,
    );
    expect(heroTime()).toHaveTextContent('--:--');
    expect(heroTime().className).not.toContain('animate-pulse');
    const seen: number[] = [];
    for (let i = 0; i < 8; i++) {
      await sleep(0.1);
      seen.push(Number(heroTime().style.opacity || 1));
    }
    expect(Math.min(...seen)).toBeLessThan(1);
    expect(Math.min(...seen)).toBeGreaterThanOrEqual(0.6);
  });
});

describe('micro-interactions', () => {
  it('opens the hour details inside the card body', async () => {
    function Harness() {
      const day = makeDay({ 14: { uv: 5.4 } });
      const { scoredHours, best } = evaluate(
        day,
        { day: 'today', freeTime: FREE, duration: 60, activity: 'relaxed' },
        null,
      );
      return (
        <HourlyCard
          index={0}
          day={day}
          dayName="Today"
          hours={scoredHours}
          freeTime={FREE}
          best={best}
          selectedHour={14}
          nowHour={null}
          onSelect={() => {}}
          intro={false}
        />
      );
    }
    renderMotion(<Harness />);
    const details = await screen.findByRole('region', { name: 'Details for 14:00' });
    expect(details.closest('[data-card-body]')).not.toBeNull();
  });

  it('presses the toolbar buttons with a scale, and not with reduced motion', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<UvGoApp />);
    const plan = await screen.findByRole('button', { name: 'Plan' });
    await user.pointer({ keys: '[MouseLeft>]', target: plan });
    await waitFor(() => expect(plan.style.transform).toContain('scale'));
    await user.pointer({ keys: '[/MouseLeft]', target: plan });
    unmount();

    prefs.reduced = true;
    render(<UvGoApp />);
    const plan2 = await screen.findByRole('button', { name: 'Plan' });
    await user.pointer({ keys: '[MouseLeft>]', target: plan2 });
    await sleep(durations.base);
    expect(plan2.style.transform).not.toContain('scale');
    await user.pointer({ keys: '[/MouseLeft]', target: plan2 });
  });
});

describe('motion foundation', () => {
  it('switches the day', async () => {
    prefs.reduced = true;
    const user = userEvent.setup();
    render(<UvGoApp />);
    // On a phone the day is switched in the Plan sheet.
    await user.click(await screen.findByRole('button', { name: 'Plan' }));
    const sheet = await screen.findByRole('dialog', { name: 'Plan' });
    const day = within(sheet).getByRole('radiogroup', { name: 'Day' });
    expect(within(day).getByRole('radio', { name: 'Today' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await user.click(within(day).getByRole('radio', { name: 'Tomorrow' }));
    await waitFor(() =>
      expect(within(day).getByRole('radio', { name: 'Tomorrow' })).toHaveAttribute(
        'aria-checked',
        'true',
      ),
    );
    expect(within(day).getByRole('radio', { name: 'Today' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('moves the segmented indicator to the chosen option', async () => {
    const user = userEvent.setup();
    render(<UvGoApp />);
    await user.click(await screen.findByRole('button', { name: 'Plan' }));
    const sheet = await screen.findByRole('dialog', { name: 'Plan' });
    const group = within(sheet).getByRole('radiogroup', { name: 'Duration' });
    const indicators = () => group.querySelectorAll('[data-segment-indicator]');
    expect(indicators()).toHaveLength(1);
    expect(screen.getByRole('radio', { name: '1 h' }).contains(indicators()[0])).toBe(true);
    await user.click(screen.getByRole('radio', { name: '3 h' }));
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: '3 h' }).contains(indicators()[0])).toBe(true),
    );
    expect(indicators()).toHaveLength(1);
  });

  it('exposes the iOS-style motion tokens', () => {
    expect(springs).toEqual({
      smooth: { type: 'spring', duration: 0.5, bounce: 0 },
      snappy: { type: 'spring', duration: 0.3, bounce: 0.15 },
      sheet: { type: 'spring', duration: 0.45, bounce: 0.08 },
    });
    expect(durations).toEqual({ fast: 0.15, base: 0.3, slow: 0.6 });
    expect(ease).toEqual([0.22, 1, 0.36, 1]);
  });

  it('no motion.* components', () => {
    const sources = import.meta.glob(
      ['../../app/**/*.{ts,tsx}', '../../motion/**/*.{ts,tsx}', '!**/__tests__/**'],
      { query: '?raw', import: 'default', eager: true },
    ) as Record<string, string>;
    const files = Object.keys(sources);
    expect(files.some((f) => f.includes('MotionProvider'))).toBe(true);
    expect(files.some((f) => f.includes('SegmentedControl'))).toBe(true);
    for (const [file, source] of Object.entries(sources)) {
      expect(source, file).not.toMatch(/\bmotion\.\w+/);
    }
  });
});
