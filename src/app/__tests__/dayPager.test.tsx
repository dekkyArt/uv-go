import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { motionValue, type MotionValue } from 'motion/react';
import { describe, expect, it, vi } from 'vitest';
import type { Inputs } from '../../domain/types';
import { DayPager, lockAxis, pagerDecision, rubberBand } from '../pager/DayPager';

describe('pagerDecision', () => {
  it('switches at a quarter of the width', async () => {
    expect(pagerDecision(-100, 0, 390, 'today')).toBe('tomorrow');
    expect(pagerDecision(-50, 0, 390, 'today')).toBe('today');
    expect(pagerDecision(100, 0, 390, 'tomorrow')).toBe('today');
  });

  it('switches on a fast fling, whatever the distance', async () => {
    expect(pagerDecision(-20, -600, 390, 'today')).toBe('tomorrow');
    expect(pagerDecision(20, 600, 390, 'tomorrow')).toBe('today');
    expect(pagerDecision(-20, -500, 390, 'today')).toBe('today');
  });

  it('lets a fling back win over the distance', async () => {
    expect(pagerDecision(-200, 600, 390, 'today')).toBe('today');
  });

  it('never goes past an edge', async () => {
    expect(pagerDecision(-200, 0, 390, 'tomorrow')).toBe('tomorrow');
    expect(pagerDecision(200, 0, 390, 'today')).toBe('today');
  });
});

describe('lockAxis', () => {
  it('waits for 10 px of travel', async () => {
    expect(lockAxis(4, 3)).toBeNull();
    expect(lockAxis(0, 0)).toBeNull();
  });

  it('locks x within 30 degrees of the horizontal, y beyond', async () => {
    expect(lockAxis(12, 3)).toBe('x');
    expect(lockAxis(-12, 3)).toBe('x');
    expect(lockAxis(10, 8)).toBe('y');
    expect(lockAxis(2, -14)).toBe('y');
  });
});

describe('rubberBand', () => {
  it('resists only at an edge', async () => {
    expect(rubberBand(100, true)).toBe(30);
    expect(rubberBand(100, false)).toBe(100);
  });
});

function renderPager(
  props: {
    day?: Inputs['day'];
    enabled?: boolean;
    onDay?: (d: Inputs['day']) => void;
    onClick?: () => void;
  } = {},
) {
  const progress = motionValue(props.day === 'tomorrow' ? 1 : 0);
  const onDay = props.onDay ?? vi.fn();
  const ui = (day: Inputs['day']) => (
    <DayPager day={day} onDay={onDay} enabled={props.enabled ?? true} progress={progress}>
      <div data-testid="content" onClick={props.onClick}>
        {day}
      </div>
      <div data-hourly-strip="">
        <button>strip</button>
      </div>
    </DayPager>
  );
  const view = render(ui(props.day ?? 'today'));
  const pager = view.container.querySelector<HTMLElement>('[data-pager-enabled]')!;
  Object.defineProperty(pager, 'clientWidth', { value: 390 });
  return {
    pager,
    progress: progress as MotionValue<number>,
    onDay,
    rerender: (day: Inputs['day']) => view.rerender(ui(day)),
  };
}

const touch = { pointerType: 'touch', pointerId: 1 } as const;

/**
 * A finger that moves `steps` times by `step` px along x (and `dy` along y), starting at
 * (200, 300). Without a pause the moves are a few ms apart, which reads as a fling.
 */
async function swipe(target: Element, step: number, steps = 5, dy = 0, pauseMs = 0) {
  fireEvent.pointerDown(target, { ...touch, clientX: 200, clientY: 300 });
  for (let i = 1; i <= steps; i += 1) {
    if (pauseMs > 0) await act(() => new Promise((r) => setTimeout(r, pauseMs)));
    fireEvent.pointerMove(target, {
      ...touch,
      clientX: 200 + step * i,
      clientY: 300 + dy * i,
    });
  }
  fireEvent.pointerUp(target, { ...touch, clientX: 200 + step * steps, clientY: 300 + dy * steps });
}

describe('DayPager', () => {
  it('has no gesture handlers when disabled', async () => {
    const { pager, onDay } = renderPager({ enabled: false });
    expect(pager).toHaveAttribute('data-pager-enabled', 'false');
    expect(pager.style.touchAction).toBe('');
    await swipe(screen.getByTestId('content'), -40);
    expect(onDay).not.toHaveBeenCalled();
  });

  it('asks for vertical scrolling only when enabled', async () => {
    const { pager } = renderPager();
    expect(pager).toHaveAttribute('data-pager-enabled', 'true');
    // Vertical scrolling stays native and pinch-zoom stays available (WCAG 1.4.4).
    expect(pager.style.touchAction).toBe('pan-y pinch-zoom');
  });

  it('follows the content to the new day after a swipe', async () => {
    const onDay = vi.fn();
    const { progress } = renderPager({ onDay });
    await swipe(screen.getByTestId('content'), -40);
    await waitFor(() => expect(onDay).toHaveBeenCalledWith('tomorrow'));
    expect(progress.get()).toBe(1);
  });

  it('springs back from a short swipe', async () => {
    const onDay = vi.fn();
    const { progress } = renderPager({ onDay });
    await swipe(screen.getByTestId('content'), -4, 5, 0, 30);
    await act(() => new Promise((r) => setTimeout(r, 700)));
    expect(onDay).not.toHaveBeenCalled();
    expect(progress.get()).toBe(0);
  });

  it('gives a mostly vertical gesture back to scrolling', async () => {
    const onDay = vi.fn();
    renderPager({ onDay });
    await swipe(screen.getByTestId('content'), -40, 5, 40);
    await act(() => new Promise((r) => setTimeout(r, 100)));
    expect(onDay).not.toHaveBeenCalled();
  });

  it('does not take a gesture that starts in the hourly strip', async () => {
    const onDay = vi.fn();
    renderPager({ onDay });
    await swipe(screen.getByRole('button', { name: 'strip' }), -40);
    await act(() => new Promise((r) => setTimeout(r, 100)));
    expect(onDay).not.toHaveBeenCalled();
  });

  it('does not swipe past the edge', async () => {
    const onDay = vi.fn();
    renderPager({ onDay });
    await swipe(screen.getByTestId('content'), 80);
    await act(() => new Promise((r) => setTimeout(r, 700)));
    expect(onDay).not.toHaveBeenCalled();
  });

  it('swallows the click that ends a swipe', async () => {
    const onClick = vi.fn();
    renderPager({ onClick });
    const target = screen.getByTestId('content');
    await swipe(target, -40);
    fireEvent.click(target);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('comes back to rest when the day changes on its own during the exit', async () => {
    const onDay = vi.fn();
    const { pager, progress, rerender } = renderPager({ onDay });
    await swipe(screen.getByTestId('content'), -40);
    // The dots (or the auto-switch) get there first, while the page is still sliding off.
    rerender('tomorrow');
    // The exit (0.3 s) and the entry (0.45 s) both play out.
    await act(() => new Promise((r) => setTimeout(r, 1500)));
    expect(pager.style.transform).toMatch(/^(none)?$/);
    expect(progress.get()).toBe(1);
    expect(screen.getByTestId('content')).toHaveTextContent('tomorrow');

    // Not wedged: the next swipe works.
    await swipe(screen.getByTestId('content'), 40);
    await waitFor(() => expect(onDay).toHaveBeenCalledWith('today'));
  });

  it('moves the content and the progress when the day changes from outside', async () => {
    const { progress, rerender } = renderPager();
    expect(screen.getByTestId('content')).toHaveTextContent('today');
    rerender('tomorrow');
    expect(screen.getByTestId('content')).toHaveTextContent('tomorrow');
    await waitFor(() => expect(progress.get()).toBe(1));
    rerender('today');
    await waitFor(() => expect(progress.get()).toBe(0));
  });
});
