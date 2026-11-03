import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Inputs } from '../../domain/types';
import { MotionProvider } from '../../motion/MotionProvider';
import { PlanControls } from '../cards/PlanControls';
import { FreeTimePicker } from '../components/FreeTimePicker';
import { SegmentedControl } from '../components/SegmentedControl';

const INPUTS: Inputs = {
  day: 'today',
  freeTime: { start: 13, end: 19 },
  duration: 60,
  activity: 'relaxed',
};

function setup() {
  const onDay = vi.fn();
  const onFreeTime = vi.fn();
  const onDuration = vi.fn();
  const onActivity = vi.fn();
  render(
    <MotionProvider>
      <PlanControls
        inputs={INPUTS}
        onDay={onDay}
        onFreeTime={onFreeTime}
        onDuration={onDuration}
        onActivity={onActivity}
      />
    </MotionProvider>,
  );
  return { onDay, onFreeTime, onDuration, onActivity };
}

describe('PlanControls', () => {
  it('groups Free time, Duration and Activity under h3 headings', () => {
    setup();
    for (const name of ['Free time', 'Duration', 'Activity']) {
      expect(screen.getByRole('heading', { level: 3, name })).toHaveClass(
        'text-[15px]',
        'font-semibold',
      );
    }
    expect(screen.getByRole('radiogroup', { name: 'Duration' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Activity' })).toBeInTheDocument();
  });

  it('opens with a Today | Tomorrow switch on the current day', () => {
    setup();
    const day = screen.getByRole('radiogroup', { name: 'Day' });
    expect(day.parentElement?.firstElementChild).toBe(day);
    expect(screen.getByRole('radio', { name: 'Today' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Tomorrow' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('a click on Tomorrow reports the day', async () => {
    const user = userEvent.setup();
    const { onDay } = setup();
    await user.click(screen.getByRole('radio', { name: 'Tomorrow' }));
    expect(onDay).toHaveBeenCalledWith('tomorrow');
  });

  it('shows the free time window', () => {
    setup();
    expect(screen.getByText('13:00 – 19:00')).toBeInTheDocument();
  });

  it('marks the current duration and activity', () => {
    setup();
    expect(screen.getByRole('radio', { name: '1 h' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Relaxed' })).toHaveAttribute('aria-checked', 'true');
  });

  it('a click on 3 h reports 180 minutes', async () => {
    const user = userEvent.setup();
    const { onDuration } = setup();
    await user.click(screen.getByRole('radio', { name: '3 h' }));
    expect(onDuration).toHaveBeenCalledWith(180);
  });

  it('a click on Long in the sun reports long-sun', async () => {
    const user = userEvent.setup();
    const { onActivity } = setup();
    await user.click(screen.getByRole('radio', { name: 'Long in the sun' }));
    expect(onActivity).toHaveBeenCalledWith('long-sun');
  });

  it('ArrowRight on Free time start moves the window start by one hour', async () => {
    const user = userEvent.setup();
    const { onFreeTime } = setup();
    screen.getByRole('slider', { name: 'Free time start' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(onFreeTime).toHaveBeenCalledWith({ start: 14, end: 19 });
  });
});

describe('SegmentedControl', () => {
  function Harness() {
    const [value, setValue] = useState<'a' | 'b'>('a');
    return (
      <SegmentedControl<'a' | 'b'>
        label="Letter"
        options={[
          { value: 'a', label: 'Alpha' },
          { value: 'b', label: 'Beta' },
        ]}
        value={value}
        onChange={setValue}
      />
    );
  }

  it('is a labelled radiogroup with aria-checked on the current option', () => {
    render(<Harness />);
    expect(screen.getByRole('radiogroup', { name: 'Letter' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveAttribute('aria-checked', 'false');
  });

  it('ArrowRight selects the next option and moves focus to it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole('radio', { name: 'Alpha' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveAttribute('aria-checked', 'false');
  });

  it('clicking an option selects it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('radio', { name: 'Beta' }));
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveAttribute('aria-checked', 'true');
  });

  it('is a glass pill with a white indicator and dark text on the selected option', () => {
    render(<Harness />);
    expect(screen.getByRole('radiogroup', { name: 'Letter' })).toHaveClass('glass', 'rounded-full');
    expect(document.querySelector('[data-segment-indicator]')).toHaveClass('bg-white/90');
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveClass('text-black/85', 'min-h-11');
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveClass('text-text');
  });

  it('supports proportional segment sizing with non-wrapping labels', () => {
    render(
      <SegmentedControl<'a' | 'b'>
        label="Letter"
        options={[
          { value: 'a', label: 'Short' },
          { value: 'b', label: 'Much longer label' },
        ]}
        value="a"
        onChange={vi.fn()}
        proportional
      />,
    );
    expect(screen.getByRole('radio', { name: 'Short' })).toHaveClass('flex-auto');
    expect(screen.getByText('Much longer label')).toHaveClass('whitespace-nowrap');
  });
});

describe('FreeTimePicker', () => {
  it('exposes two sliders with aria-valuetext as HH:00', () => {
    render(<FreeTimePicker value={{ start: 13, end: 19 }} onChange={vi.fn()} />);
    expect(screen.getByRole('slider', { name: 'Free time start' })).toHaveAttribute(
      'aria-valuetext',
      '13:00',
    );
    expect(screen.getByRole('slider', { name: 'Free time end' })).toHaveAttribute(
      'aria-valuetext',
      '19:00',
    );
  });

  it('arrow keys move a handle by one hour', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FreeTimePicker value={{ start: 13, end: 19 }} onChange={onChange} />);
    screen.getByRole('slider', { name: 'Free time start' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith({ start: 14, end: 19 });
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith({ start: 12, end: 19 });
  });

  it('keeps the handles inside 0..24 and at least 1 h apart', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FreeTimePicker value={{ start: 0, end: 24 }} onChange={onChange} />);
    screen.getByRole('slider', { name: 'Free time start' }).focus();
    await user.keyboard('{ArrowLeft}');
    screen.getByRole('slider', { name: 'Free time end' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('draws a white 22 px knob inside a 44 px hit target, on a translucent track', () => {
    render(<FreeTimePicker value={{ start: 13, end: 19 }} onChange={vi.fn()} />);
    const handle = screen.getByRole('slider', { name: 'Free time start' });
    expect(handle).toHaveClass('size-11');
    expect(handle.firstElementChild).toHaveClass('size-[22px]', 'bg-white');
    const track = handle.closest('[data-track]')!;
    expect(track.querySelector('.bg-white\\/15')).not.toBeNull();
    expect(track.querySelector('.bg-white\\/70')).not.toBeNull();
  });

  describe('drag', () => {
    // Track 240 px wide => 10 px per hour, left edge at 0.
    function drag(value: { start: number; end: number }) {
      const onChange = vi.fn();
      render(<FreeTimePicker value={value} onChange={onChange} />);
      const start = screen.getByRole('slider', { name: 'Free time start' });
      const end = screen.getByRole('slider', { name: 'Free time end' });
      const track = start.closest('[data-track]') as HTMLElement;
      track.getBoundingClientRect = () => ({ left: 0, width: 240 }) as DOMRect;
      track.setPointerCapture = vi.fn();
      return { onChange, start, end, track };
    }

    it('snaps to the hour', () => {
      const { onChange, start } = drag({ start: 13, end: 19 });
      fireEvent.pointerDown(start, { clientX: 130 });
      fireEvent.pointerMove(start, { clientX: 136 });
      expect(onChange).toHaveBeenLastCalledWith({ start: 14, end: 19 });
      fireEvent.pointerUp(start, { clientX: 136 });
    });

    it('grabs the nearer handle when the two handles overlap', () => {
      const { onChange, start, end } = drag({ start: 13, end: 14 });
      fireEvent.pointerDown(end, { clientX: 132 });
      fireEvent.pointerMove(end, { clientX: 100 });
      expect(onChange).toHaveBeenLastCalledWith({ start: 10, end: 14 });
      fireEvent.pointerUp(end, { clientX: 100 });
      fireEvent.pointerDown(start, { clientX: 139 });
      fireEvent.pointerMove(start, { clientX: 180 });
      expect(onChange).toHaveBeenLastCalledWith({ start: 13, end: 18 });
    });
  });
});
