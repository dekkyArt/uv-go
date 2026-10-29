import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { motionValue } from 'motion/react';
import { describe, expect, it, vi } from 'vitest';
import { DayPager } from '../pager/DayPager';

// The lazily loaded motion features never arrive.
vi.mock('../../motion/features', () => {
  throw new Error('chunk failed to load');
});

describe('DayPager when the motion chunk fails to load', () => {
  it('still completes a swipe instead of wedging', async () => {
    const onDay = vi.fn();
    const { container } = render(
      <DayPager day="today" onDay={onDay} enabled progress={motionValue(0)}>
        <div data-testid="content" />
      </DayPager>,
    );
    Object.defineProperty(container.querySelector('[data-pager-enabled]')!, 'clientWidth', {
      value: 390,
    });
    const target = screen.getByTestId('content');
    const touch = { pointerType: 'touch', pointerId: 1 } as const;
    fireEvent.pointerDown(target, { ...touch, clientX: 200, clientY: 300 });
    for (let i = 1; i <= 5; i += 1)
      fireEvent.pointerMove(target, { ...touch, clientX: 200 - 40 * i, clientY: 300 });
    await act(async () => {
      fireEvent.pointerUp(target, { ...touch, clientX: 0, clientY: 300 });
    });
    await waitFor(() => expect(onDay).toHaveBeenCalledWith('tomorrow'));
  });
});
