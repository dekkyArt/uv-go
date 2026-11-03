import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { motionValue } from 'motion/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Place } from '../../data/types';
import type { TimeWindow } from '../../domain/types';
import { MotionProvider } from '../../motion/MotionProvider';
import { CollapsedBar } from '../hero/CollapsedBar';
import { Hero, type HeroState } from '../hero/Hero';
import { COLLAPSE_DISTANCE, collapseStyles, useHeroCollapse } from '../hero/useHeroCollapse';

// Read through `useReducedMotion`, like the other motion tests.
const prefs = vi.hoisted(() => ({ reduced: false }));
// jsdom has no layout, so `useScroll` never reports a position: the tests drive `scrollY` instead.
const scroll = vi.hoisted(() => ({ y: undefined as undefined | { set(v: number): void } }));
vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>();
  const scrollY = actual.motionValue(0);
  scroll.y = scrollY;
  return {
    ...actual,
    useReducedMotion: () => prefs.reduced,
    useScroll: () => ({ scrollY }) as unknown as ReturnType<typeof actual.useScroll>,
  };
});

const LISBON: Place = { id: 2267057, name: 'Lisbon', lat: 38.72, lon: -9.14 };
const BEST: TimeWindow = {
  startHour: 15,
  hours: [],
  score: 100,
  verdict: 'green',
  label: '15:00–16:00',
};
const RESULT: HeroState = {
  kind: 'result',
  place: LISBON,
  best: BEST,
  reason: 'UV is low',
  duration: 60,
  nowLine: 'Now UV 3',
};

beforeEach(() => {
  prefs.reduced = false;
});

describe('collapseStyles', () => {
  it('is at rest at the top of the page', () => {
    expect(collapseStyles(0)).toEqual({
      timeScale: 1,
      timeY: 0,
      detailsOpacity: 1,
      eyebrowOpacity: 1,
      barOpacity: 0,
    });
  });

  it('shrinks the time to 0.38 and lifts it over 140 px', () => {
    expect(collapseStyles(COLLAPSE_DISTANCE).timeScale).toBeCloseTo(0.38);
    expect(collapseStyles(COLLAPSE_DISTANCE).timeY).toBeLessThan(0);
    expect(collapseStyles(70).timeScale).toBeCloseTo(0.69);
  });

  it('fades the details by 60 px, the eyebrow and verdict by 100 px', () => {
    expect(collapseStyles(30).detailsOpacity).toBeCloseTo(0.5);
    expect(collapseStyles(60).detailsOpacity).toBe(0);
    expect(collapseStyles(50).eyebrowOpacity).toBeCloseTo(0.5);
    expect(collapseStyles(100).eyebrowOpacity).toBe(0);
  });

  it('brings the bar in between 100 and 140 px', () => {
    expect(collapseStyles(100).barOpacity).toBe(0);
    expect(collapseStyles(120).barOpacity).toBeCloseTo(0.5);
    expect(collapseStyles(140).barOpacity).toBe(1);
  });

  it('clamps outside the range', () => {
    expect(collapseStyles(500)).toEqual(collapseStyles(140));
    expect(collapseStyles(-80)).toEqual(collapseStyles(0));
  });
});

describe('CollapsedBar', () => {
  const bar = (opacity = motionValue(1)) => (
    <CollapsedBar place="Lisbon" label="15:00–16:00" verdict="green" opacity={opacity} />
  );

  it('is hidden from assistive tech and has nothing to focus', async () => {
    const { container } = render(bar());
    const el = container.querySelector('[data-collapsed-bar]') as HTMLElement;
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el).toHaveTextContent('Lisbon · 15:00–16:00 | Good');
    expect(el.hasAttribute('tabindex')).toBe(false);
    expect(el.querySelector('button, a, input, [tabindex]')).toBeNull();
    await userEvent.tab();
    expect(el).not.toHaveFocus();
    expect(el.contains(document.activeElement)).toBe(false);
  });

  describe('tap', () => {
    const scrollTo = vi.fn();
    beforeEach(() => {
      scrollTo.mockClear();
      window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    });

    it('scrolls smoothly to the top', async () => {
      const { container } = render(bar());
      await userEvent.click(container.querySelector('[data-collapsed-bar]') as HTMLElement);
      expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    });

    it('jumps with reduced motion', async () => {
      prefs.reduced = true;
      const { container } = render(bar());
      await userEvent.click(container.querySelector('[data-collapsed-bar]') as HTMLElement);
      expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
    });
  });

  it('does not take taps while it is invisible', () => {
    const { container } = render(bar(motionValue(0)));
    expect(
      (container.querySelector('[data-collapsed-bar]') as HTMLElement).style.pointerEvents,
    ).toBe('none');
  });
});

function Harness({ enabled, state = RESULT }: { enabled: boolean; state?: HeroState }) {
  const collapse = useHeroCollapse(enabled);
  return (
    <MotionProvider>
      <Hero
        state={state}
        locating={false}
        geoError={false}
        notice={false}
        intro={false}
        collapse={collapse}
        onUseLocation={() => {}}
        onFindCity={() => {}}
        onRetry={() => {}}
        onShowTomorrow={() => {}}
      />
    </MotionProvider>
  );
}

function scrollTo(y: number) {
  act(() => scroll.y?.set(y));
}

const identity = (el: HTMLElement) => ['', 'none'].includes(el.style.transform);

const wrapper = (c: HTMLElement) => c.querySelector('[data-hero-collapse]') as HTMLElement;
const time = (c: HTMLElement) => c.querySelector('[data-hero-time]') as HTMLElement;

describe('Hero collapse', () => {
  afterEach(() => scrollTo(0));

  it('carries the scroll transform on a wrapper, not on the time the intro animates', () => {
    const { container } = render(<Harness enabled />);
    expect(wrapper(container).contains(time(container))).toBe(true);
    scrollTo(COLLAPSE_DISTANCE);
    expect(identity(time(container))).toBe(true);
  });

  it('does not transform anything on desktop (enabled=false)', () => {
    const { container } = render(<Harness enabled={false} />);
    scrollTo(COLLAPSE_DISTANCE);
    expect(identity(wrapper(container))).toBe(true);
    expect(screen.getByText('UV is low')).toHaveStyle({ opacity: '1' });
  });

  it('shrinks the time and fades the lines with the scroll position', async () => {
    const { container } = render(<Harness enabled />);
    scrollTo(COLLAPSE_DISTANCE);
    await vi.waitFor(() => expect(wrapper(container).style.transform).toContain('scale(0.38'));
    expect(screen.getByText('UV is low')).toHaveStyle({ opacity: '0' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveStyle({ opacity: '0' });
  });

  it('keeps folding with reduced motion', async () => {
    prefs.reduced = true;
    const { container } = render(<Harness enabled />);
    scrollTo(COLLAPSE_DISTANCE);
    await vi.waitFor(() => expect(wrapper(container).style.transform).toContain('scale(0.38'));
  });

  it('leaves the other states alone', () => {
    const { container } = render(<Harness enabled state={{ kind: 'loading', place: LISBON }} />);
    scrollTo(COLLAPSE_DISTANCE);
    expect(identity(wrapper(container))).toBe(true);
  });
});
