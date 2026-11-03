import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Toolbar } from '../toolbar/Toolbar';

function renderToolbar(props: Partial<Parameters<typeof Toolbar>[0]> = {}) {
  const onPlan = vi.fn();
  const onCities = vi.fn();
  render(
    <Toolbar
      onPlan={onPlan}
      onCities={onCities}
      planRef={createRef()}
      citiesRef={createRef()}
      {...props}
    />,
  );
  return { onPlan, onCities };
}

describe('Toolbar', () => {
  it('is a navigation landmark with Plan and Cities, and no day switch', () => {
    renderToolbar();
    expect(screen.getByRole('navigation', { name: 'App' })).toBeInTheDocument();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Plan', 'Cities']);
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('calls onPlan and onCities', async () => {
    const { onPlan, onCities } = renderToolbar();
    await userEvent.click(screen.getByRole('button', { name: 'Plan' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cities' }));
    expect(onPlan).toHaveBeenCalledTimes(1);
    expect(onCities).toHaveBeenCalledTimes(1);
  });

  it('forwards the refs to the buttons', () => {
    const planRef = createRef<HTMLButtonElement>();
    const citiesRef = createRef<HTMLButtonElement>();
    renderToolbar({ planRef, citiesRef });
    expect(planRef.current).toBe(screen.getByRole('button', { name: 'Plan' }));
    expect(citiesRef.current).toBe(screen.getByRole('button', { name: 'Cities' }));
  });
});
