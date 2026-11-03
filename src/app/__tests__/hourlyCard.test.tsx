import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { evaluate } from '../../domain/evaluate';
import { makeDay } from '../../domain/__tests__/factories';
import type { DayForecast } from '../../domain/types';
import { MotionProvider } from '../../motion/MotionProvider';
import { HourlyCard } from '../cards/HourlyCard';
import { CELL_W, SELECTED_CELL_CLASS } from '../ui';

const FREE = { start: 9, end: 17 };

function setup(
  props: Partial<Parameters<typeof HourlyCard>[0]> = {},
  day: DayForecast = makeDay({ 14: { uv: 5.4, rainProb: 30 }, 10: { uv: 2 } }),
) {
  const { scoredHours, best } = evaluate(
    day,
    { day: 'today', freeTime: FREE, duration: 60, activity: 'relaxed' },
    null,
  );
  const onSelect = vi.fn();
  const view = render(
    <MotionProvider>
      <HourlyCard
        day={day}
        dayName="Today"
        hours={scoredHours}
        freeTime={FREE}
        best={best}
        selectedHour={null}
        nowHour={null}
        onSelect={onSelect}
        intro={false}
        index={0}
        {...props}
      />
    </MotionProvider>,
  );
  return { ...view, onSelect, best, group: screen.getByRole('group', { name: 'Hourly forecast' }) };
}

const hourButton = (hour: number) =>
  screen.getByRole('button', { name: new RegExp(`^${String(hour).padStart(2, '0')}:00,`) });

describe('HourlyCard', () => {
  it('is a group of 24 hour buttons', () => {
    const { group } = setup();
    expect(within(group).getAllByRole('button')).toHaveLength(24);
  });

  it('names a cell with time, UV, rain and verdict', () => {
    setup();
    expect(hourButton(14)).toHaveAccessibleName('14:00, UV 5, rain 30%, OK with protection');
  });

  it('shows "Now" only on the current hour', () => {
    const { unmount } = setup({ nowHour: 11 });
    expect(screen.getByText('Now')).toBeInTheDocument();
    expect(within(hourButton(11)).getByText('Now')).toBeInTheDocument();
    unmount();
    setup({ nowHour: null });
    expect(screen.queryByText('Now')).not.toBeInTheDocument();
  });

  it('marks the selected hour as pressed', () => {
    setup({ selectedHour: 14 });
    expect(hourButton(14)).toHaveAttribute('aria-pressed', 'true');
    expect(hourButton(13)).toHaveAttribute('aria-pressed', 'false');
  });

  it('dims past hours without fading their text', () => {
    const day = makeDay();
    const { scoredHours } = evaluate(
      day,
      { day: 'today', freeTime: FREE, duration: 60, activity: 'relaxed' },
      { hour: 12, minute: 0 },
    );
    setup({ hours: scoredHours, nowHour: 12 }, day);
    // Before the free time (09:00–17:00), so on bare glass.
    const past = hourButton(8);
    const current = hourButton(12);
    const texts = (cell: HTMLElement) => [
      ...cell.querySelectorAll(':scope > span:not(.opacity-45)'),
    ];

    expect(past).toHaveAttribute('data-past');
    expect(past.style.opacity).toBe('');
    expect(past).not.toHaveClass('opacity-45');
    expect(past).toHaveClass('text-text-muted');
    expect(past.querySelector('svg[data-icon]')).toHaveClass('opacity-45');
    expect(past.querySelector('span.size-1\\.5')).toHaveClass('opacity-45');
    expect(texts(past).length).toBeGreaterThan(0);
    expect(past.querySelectorAll('.opacity-45')).toHaveLength(2);

    expect(current).not.toHaveAttribute('data-past');
    expect(current.style.opacity).toBe('');
    expect(current).toHaveClass('text-text');
    expect(current).not.toHaveClass('text-text-muted');
    expect(current.querySelectorAll('.opacity-45')).toHaveLength(0);
  });

  it('keeps past hours white on a plate: the free band or the selected hour', () => {
    const day = makeDay();
    const { scoredHours } = evaluate(
      day,
      { day: 'today', freeTime: FREE, duration: 60, activity: 'relaxed' },
      { hour: 12, minute: 0 },
    );
    setup({ hours: scoredHours, nowHour: 12, selectedHour: 7 }, day);
    // 11:00 is past but on the free band; 07:00 is past, off the band, selected.
    for (const hour of [11, 7]) {
      expect(hourButton(hour)).toHaveAttribute('data-past');
      expect(hourButton(hour)).toHaveClass('text-text');
      expect(hourButton(hour)).not.toHaveClass('text-text-muted');
      expect(hourButton(hour).querySelector('svg[data-icon]')).toHaveClass('opacity-45');
    }
    expect(hourButton(7)).toHaveClass(SELECTED_CELL_CLASS);
  });

  describe('keyboard', () => {
    it('ArrowRight, End and Home move focus between hours', async () => {
      const user = userEvent.setup();
      setup({ selectedHour: 14 });
      hourButton(14).focus();
      await user.keyboard('{ArrowRight}');
      expect(hourButton(15)).toHaveFocus();
      await user.keyboard('{ArrowLeft}{ArrowLeft}');
      expect(hourButton(13)).toHaveFocus();
      await user.keyboard('{End}');
      expect(hourButton(23)).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(hourButton(23)).toHaveFocus();
      await user.keyboard('{Home}');
      expect(hourButton(0)).toHaveFocus();
    });

    it('keeps one tab stop: selected, else Now, else the first free hour', () => {
      const stops = () =>
        screen
          .getAllByRole('button')
          .filter((b) => b.getAttribute('data-hour') && b.tabIndex === 0)
          .map((b) => b.getAttribute('data-hour'));
      const a = setup({ selectedHour: 14, nowHour: 11 });
      expect(stops()).toEqual(['14']);
      a.unmount();
      const b = setup({ nowHour: 11 });
      expect(stops()).toEqual(['11']);
      b.unmount();
      setup();
      expect(stops()).toEqual(['9']);
    });

    it('moves the tab stop with focus', async () => {
      const user = userEvent.setup();
      setup();
      screen.getByRole('radio', { name: 'UV' }).focus();
      await user.tab();
      expect(hourButton(9)).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(hourButton(10).tabIndex).toBe(0);
      expect(hourButton(9).tabIndex).toBe(-1);
    });
  });

  describe('details', () => {
    it('selects an hour on click and deselects the selected one', async () => {
      const user = userEvent.setup();
      const a = setup();
      await user.click(hourButton(14));
      expect(a.onSelect).toHaveBeenCalledWith(14);
      a.unmount();
      const b = setup({ selectedHour: 14 });
      await user.click(hourButton(14));
      expect(b.onSelect).toHaveBeenCalledWith(null);
    });

    it('shows the details panel for the selected hour inside the card', () => {
      setup({ selectedHour: 14 });
      const panel = screen.getByRole('region', { name: 'Details for 14:00' });
      expect(screen.getByRole('region', { name: 'Hourly' })).toContainElement(panel);
    });

    it('has no details panel without a selection', () => {
      setup();
      expect(screen.queryByRole('region', { name: /^Details for/ })).not.toBeInTheDocument();
    });

    it('closes with the close button and hands focus back to the hour', async () => {
      const user = userEvent.setup();
      const { onSelect } = setup({ selectedHour: 14 });
      await user.click(screen.getByRole('button', { name: 'Close hour details' }));
      expect(onSelect).toHaveBeenCalledWith(null);
      expect(hourButton(14)).toHaveFocus();
    });

    it('a click on another hour is not an outside tap', async () => {
      const user = userEvent.setup();
      const { onSelect } = setup({ selectedHour: 14 });
      await user.click(hourButton(10));
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(10);
    });
  });

  describe('metric', () => {
    it('is a radiogroup of UV, Rain and Feels like, UV first', () => {
      setup();
      const group = screen.getByRole('radiogroup', { name: 'Metric' });
      const radios = within(group).getAllByRole('radio');
      expect(radios.map((r) => r.textContent)).toEqual(['UV', 'Rain', 'Feels like']);
      expect(screen.getByRole('radio', { name: 'UV' })).toBeChecked();
      expect(group.querySelectorAll('[data-metric-indicator]')).toHaveLength(1);
    });

    it('switching to Rain changes the subtitle and the cell values', async () => {
      const user = userEvent.setup();
      setup();
      expect(screen.getByText('UV index')).toBeInTheDocument();
      expect(within(hourButton(14)).getByText('5')).toBeInTheDocument();
      await user.click(screen.getByRole('radio', { name: 'Rain' }));
      expect(screen.getByText('Chance of rain (%)')).toBeInTheDocument();
      expect(within(hourButton(14)).getByText('30%')).toBeInTheDocument();
      await user.click(screen.getByRole('radio', { name: 'Feels like' }));
      expect(screen.getByText('Feels like (°C)')).toBeInTheDocument();
      expect(within(hourButton(14)).getByText('20°')).toBeInTheDocument();
    });

    it('moves with the arrow keys', async () => {
      const user = userEvent.setup();
      setup();
      screen.getByRole('radio', { name: 'UV' }).focus();
      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('radio', { name: 'Rain' })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'Rain' })).toHaveFocus();
    });

    it('shows a dash, never null, for missing data', () => {
      const day = makeDay({ 14: { uv: null, rainProb: null, feelsLike: null } });
      setup({}, day);
      expect(within(hourButton(14)).getByText('–')).toBeInTheDocument();
      expect(hourButton(14).textContent).not.toMatch(/null|NaN/);
    });
  });

  describe('sun events', () => {
    it('are plain cells, not buttons', () => {
      const { group } = setup();
      expect(within(group).getByText('Sunrise')).toBeInTheDocument();
      expect(within(group).getByText('Sunset')).toBeInTheDocument();
      expect(within(group).getByText('06:30')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /sunrise|sunset/i })).not.toBeInTheDocument();
    });

    it('are absent when the sun times are unusable', () => {
      const day = makeDay({}, { sunrise: '', sunset: '' });
      setup({}, day);
      expect(screen.queryByText('Sunrise')).not.toBeInTheDocument();
      expect(screen.queryByText('Sunset')).not.toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /^\d\d:00,/ })).toHaveLength(24);
    });
  });

  describe('highlights', () => {
    it('draws the free band and the best-window outline', () => {
      const { container, best } = setup();
      expect(best).not.toBeNull();
      const band = container.querySelector<HTMLElement>('[data-free-band]');
      const outline = container.querySelector<SVGElement>('[data-best-outline]');
      expect(band).not.toBeNull();
      expect(outline).not.toBeNull();
      // hours 9..16: the sunrise cell sits after hour 6, before the band
      expect(band).toHaveStyle({ width: `${8 * CELL_W}px` });
      expect(outline?.querySelector('rect')).toHaveAttribute('rx', '14');
      expect(outline?.querySelector('rect')).toHaveAttribute('stroke-width', '1.5');
    });

    it('has no outline without a best window', () => {
      const { container } = setup({ best: null });
      expect(container.querySelector('[data-best-outline]')).toBeNull();
      expect(container.querySelector('[data-free-band]')).not.toBeNull();
    });
  });

  it('scrolls to "Now" on mount, else to the start of the free time', () => {
    const scrollLeft = vi.spyOn(HTMLElement.prototype, 'scrollLeft', 'set');
    const a = setup({ nowHour: 11 });
    // 11 hours before it plus the sunrise cell
    expect(scrollLeft).toHaveBeenLastCalledWith(12 * CELL_W);
    a.unmount();
    setup();
    expect(scrollLeft).toHaveBeenLastCalledWith(10 * CELL_W);
    scrollLeft.mockRestore();
  });
});
