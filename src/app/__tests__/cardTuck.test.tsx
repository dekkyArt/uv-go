import { act, render, waitFor } from '@testing-library/react';
import { LazyMotion } from 'motion/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import features from '../../motion/features';
import { GlassCard } from '../cards/GlassCard';
import { tuckInset } from '../cards/useCardTuck';

const flags = vi.hoisted(() => ({ clip: true }));
// jsdom has no layout, so `useScroll` never reports a position: the tests drive `scrollY` instead.
const scroll = vi.hoisted(() => ({ y: undefined as undefined | { set(v: number): void } }));
vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>();
  const scrollY = actual.motionValue(0);
  scroll.y = scrollY;
  return {
    ...actual,
    useScroll: () => ({ scrollY }) as unknown as ReturnType<typeof actual.useScroll>,
  };
});
vi.mock('../ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ui')>();
  return Object.defineProperty({ ...actual }, 'CARD_TUCK_CLIP', { get: () => flags.clip });
});

const body = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-card-body]') as HTMLElement;
const clip = (container: HTMLElement) => body(container).style.clipPath;
const section = (container: HTMLElement) => container.querySelector<HTMLElement>('section')!;

/** Fakes the layout jsdom lacks: the card top is `top.value`, the header is 44 px, the body 300. */
function fakeLayout(top: { value: number }) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ top: top.value }) as DOMRect,
  );
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.hasAttribute('data-card-header') ? 44 : 300;
  });
}

/**
 * The features are passed in synchronously: with the app's lazy loader the import raced the
 * scroll under a busy test run, and the clip sometimes missed a step.
 */
function card(tuck: boolean, pinned = 56) {
  return (
    <LazyMotion features={features} strict>
      <GlassCard title="Hourly" tuck={tuck ? pinned : 0}>
        <p>x</p>
      </GlassCard>
    </LazyMotion>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  flags.clip = true;
});

describe('tuckInset', () => {
  it('is zero while the card is below the pinned bar', () => {
    expect(tuckInset(200, 44, 56, 300)).toBe(0);
  });

  it('cuts what has passed under the bar', () => {
    expect(tuckInset(20, 44, 56, 300)).toBe(36);
  });

  it('never cuts more than the whole body', () => {
    expect(tuckInset(-400, 44, 56, 300)).toBe(300);
  });
});

describe('GlassCard tuck', () => {
  it('has no clip-path when tucking is off (desktop, no bar)', () => {
    const { container } = render(card(false));
    expect(body(container).getAttribute('style') ?? '').not.toContain('clip-path');
  });

  it('has no clip-path when CARD_TUCK_CLIP is false', () => {
    flags.clip = false;
    const { container } = render(card(true));
    expect(body(container).getAttribute('style') ?? '').not.toContain('clip-path');
  });

  it('follows the scroll through the MotionValue', async () => {
    const top = { value: 500 };
    fakeLayout(top);
    const { container } = render(card(true));
    await waitFor(() => expect(clip(container)).toBe('inset(0px 0 0 0 round 22px)'));

    top.value = 20;
    act(() => scroll.y?.set(480));
    await waitFor(() => expect(clip(container)).toBe('inset(36px 0 0 0 round 22px)'));

    top.value = -400;
    act(() => scroll.y?.set(900));
    await waitFor(() => expect(clip(container)).toBe('inset(300px 0 0 0 round 22px)'));
  });

  it('cuts at the pinned height it is given: the bar and the What to take strip', async () => {
    fakeLayout({ value: 20 });
    const { container } = render(card(true, 100));
    await waitFor(() => expect(clip(container)).toBe('inset(80px 0 0 0 round 22px)'));
  });

  it('cuts the card itself at the same line, so no glass shows behind the strip', async () => {
    const top = { value: 500 };
    fakeLayout(top);
    const { container } = render(card(true, 100));
    await waitFor(() => expect(clip(container)).toBe('inset(0px 0 0 0 round 22px)'));
    expect(section(container).style.clipPath).toBe('none');

    top.value = 20;
    act(() => scroll.y?.set(480));
    await waitFor(() =>
      expect(section(container).style.clipPath).toBe('inset(80px 0 0 0 round 22px)'),
    );

    // Past the clamp of the body: the title row pushed up by the card's bottom goes under too.
    top.value = -400;
    act(() => scroll.y?.set(900));
    await waitFor(() =>
      expect(section(container).style.clipPath).toBe('inset(500px 0 0 0 round 22px)'),
    );
  });

  it('clips right away when the page is restored mid-scroll', async () => {
    fakeLayout({ value: 0 });
    const { container } = render(card(true));
    await waitFor(() => expect(clip(container)).toBe('inset(56px 0 0 0 round 22px)'));
  });

  it('leaves no clip on the body when tucking turns off while mounted', async () => {
    fakeLayout({ value: -400 });
    const { container, rerender } = render(card(true));
    await waitFor(() => expect(clip(container)).toBe('inset(300px 0 0 0 round 22px)'));

    rerender(card(false));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(body(container).getAttribute('style') ?? '').not.toContain('clip-path');
    expect(section(container).getAttribute('style') ?? '').not.toContain('clip-path');
  });

  it('disconnects the size observer on cleanup', () => {
    const disconnect = vi.fn();
    class FakeObserver {
      observe = vi.fn();
      disconnect = disconnect;
    }
    vi.stubGlobal('ResizeObserver', FakeObserver);
    try {
      fakeLayout({ value: 500 });
      const { unmount } = render(card(true));
      expect(disconnect).not.toHaveBeenCalled();
      unmount();
      expect(disconnect).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('stops listening when it unmounts', () => {
    const top = { value: 500 };
    fakeLayout(top);
    const { unmount } = render(card(true));
    unmount();
    const reads = vi.mocked(HTMLElement.prototype.getBoundingClientRect).mock.calls.length;
    act(() => scroll.y?.set(123));
    expect(vi.mocked(HTMLElement.prototype.getBoundingClientRect).mock.calls).toHaveLength(reads);
  });
});
