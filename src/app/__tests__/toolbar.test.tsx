import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DayDots } from '../toolbar/DayDots';
import { Toolbar } from '../toolbar/Toolbar';

function renderToolbar(props: Partial<Parameters<typeof Toolbar>[0]> = {}) {
  const onDay = vi.fn();
  const onCities = vi.fn();
  render(
    <Toolbar
      day="today"
      onDay={onDay}
      panelId="panel"
      onCities={onCities}
      planRef={createRef()}
      citiesRef={createRef()}
      {...props}
    />,
  );
  return { onDay, onCities };
}

describe('DayDots', () => {
  it('is a tablist with the selected day marked and wired to the panel', () => {
    render(<DayDots day="tomorrow" onDay={() => {}} panelId="panel" />);
    expect(screen.getByRole('tablist', { name: 'Day' })).toBeInTheDocument();
    const today = screen.getByRole('tab', { name: 'Today' });
    const tomorrow = screen.getByRole('tab', { name: 'Tomorrow' });
    expect(today).toHaveAttribute('aria-selected', 'false');
    expect(tomorrow).toHaveAttribute('aria-selected', 'true');
    expect(today).toHaveAttribute('aria-controls', 'panel');
    expect(tomorrow).toHaveAttribute('aria-controls', 'panel');
    // Roving tabindex: only the selected tab is in the tab order.
    expect(today).toHaveAttribute('tabindex', '-1');
    expect(tomorrow).toHaveAttribute('tabindex', '0');
  });

  it('switches the day on click', async () => {
    const onDay = vi.fn();
    render(<DayDots day="today" onDay={onDay} panelId="panel" />);
    await userEvent.click(screen.getByRole('tab', { name: 'Tomorrow' }));
    expect(onDay).toHaveBeenCalledWith('tomorrow');
  });

  it('moves the day and the focus with the arrow keys', async () => {
    const onDay = vi.fn();
    render(<DayDots day="today" onDay={onDay} panelId="panel" />);
    screen.getByRole('tab', { name: 'Today' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onDay).toHaveBeenCalledWith('tomorrow');
    expect(screen.getByRole('tab', { name: 'Tomorrow' })).toHaveFocus();
  });

  it('moves back with ArrowLeft', async () => {
    const onDay = vi.fn();
    render(<DayDots day="tomorrow" onDay={onDay} panelId="panel" />);
    screen.getByRole('tab', { name: 'Tomorrow' }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(onDay).toHaveBeenCalledWith('today');
    expect(screen.getByRole('tab', { name: 'Today' })).toHaveFocus();
  });
});

describe('Toolbar', () => {
  it('is a navigation landmark with Plan, the day tabs and Cities', () => {
    renderToolbar({ onPlan: () => {} });
    expect(screen.getByRole('navigation', { name: 'App' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Plan' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Cities' })).toBeInTheDocument();
  });

  it('has no Plan button without onPlan', () => {
    renderToolbar();
    expect(screen.queryByRole('button', { name: 'Plan' })).not.toBeInTheDocument();
  });

  it('calls onPlan and onCities', async () => {
    const onPlan = vi.fn();
    const { onCities } = renderToolbar({ onPlan });
    await userEvent.click(screen.getByRole('button', { name: 'Plan' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cities' }));
    expect(onPlan).toHaveBeenCalledTimes(1);
    expect(onCities).toHaveBeenCalledTimes(1);
  });

  it('forwards the refs to the buttons', () => {
    const planRef = createRef<HTMLButtonElement>();
    const citiesRef = createRef<HTMLButtonElement>();
    renderToolbar({ onPlan: () => {}, planRef, citiesRef });
    expect(planRef.current).toBe(screen.getByRole('button', { name: 'Plan' }));
    expect(citiesRef.current).toBe(screen.getByRole('button', { name: 'Cities' }));
  });
});
