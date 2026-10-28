import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearForecastCache } from '../../data/openMeteo';
import { durations, ease, springs } from '../../motion/tokens';
import { makeForecastJson } from '../../test/forecastJson';
import UvGoApp from '../UvGoApp';

const fetchMock = vi.fn();

beforeEach(() => {
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
      matches: query === '(prefers-reduced-motion: reduce)',
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

describe('motion foundation', () => {
  it('renders with reduced motion', async () => {
    const user = userEvent.setup();
    render(<UvGoApp />);
    const day = await screen.findByRole('tablist', { name: 'Day' });
    expect(day).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Today' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('tab', { name: 'Tomorrow' }));
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Tomorrow' })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    );
    expect(screen.getByRole('tab', { name: 'Today' })).toHaveAttribute('aria-selected', 'false');
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

  it('exposes the starting motion tokens', () => {
    expect(springs.snappy).toEqual({ type: 'spring', stiffness: 500, damping: 35 });
    expect(springs.gentle).toEqual({ type: 'spring', stiffness: 220, damping: 28 });
    expect(springs.bouncy).toEqual({ type: 'spring', stiffness: 400, damping: 18 });
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
