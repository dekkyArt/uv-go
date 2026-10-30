import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../domain/evaluate';
import { makeDay } from '../../domain/__tests__/factories';
import type { DayForecast } from '../../domain/types';
import { MotionProvider } from '../../motion/MotionProvider';
import { FreeTimeCard } from '../cards/FreeTimeCard';
import { freeTimeRows } from '../cards/freeTimeRows';
import { RAIN_TEXT_CLASS, ROW_H } from '../ui';

const FREE = { start: 13, end: 19 };
const INPUTS = { day: 'today', freeTime: FREE, duration: 60, activity: 'relaxed' } as const;

function evaluated(day: DayForecast, now: { hour: number; minute: number } | null = null) {
  return evaluate(day, INPUTS, now);
}

function setup(
  day: DayForecast = makeDay(),
  props: Partial<Parameters<typeof FreeTimeCard>[0]> = {},
  now: { hour: number; minute: number } | null = null,
) {
  const { scoredHours, best } = evaluated(day, now);
  return render(
    <MotionProvider>
      <FreeTimeCard
        hours={scoredHours}
        freeTime={FREE}
        best={best}
        nowHour={null}
        duration={60}
        activity="relaxed"
        intro={false}
        index={0}
        {...props}
      />
    </MotionProvider>,
  );
}

const rowOf = (hour: number) => {
  const row = screen
    .getAllByRole('row')
    .find((r) => within(r).queryByText(`${String(hour).padStart(2, '0')}:00`));
  if (!row) throw new Error(`no row for ${hour}`);
  return row;
};

describe('freeTimeRows', () => {
  const { scoredHours, best } = evaluated(makeDay({ 15: { uv: 1 }, 16: { uv: 1 } }));

  it('has one row per free-time hour, end excluded', () => {
    const rows = freeTimeRows(scoredHours, FREE, null, null);
    expect(rows.map((r) => r.hour.hour)).toEqual([13, 14, 15, 16, 17, 18]);
  });

  it('marks only the hours of the best window', () => {
    const window = { ...best!, startHour: 15, hours: scoredHours.slice(15, 17) };
    const rows = freeTimeRows(scoredHours, FREE, window, null);
    expect(rows.filter((r) => r.best).map((r) => r.hour.hour)).toEqual([15, 16]);
  });

  it('fills min(score, 8) / 8 of the bar', () => {
    const at = (score: number) =>
      freeTimeRows(
        scoredHours.map((h) => (h.hour === 13 ? { ...h, score } : h)),
        FREE,
        null,
        null,
      )[0].fill;
    expect(at(4)).toBe(0.5);
    expect(at(12)).toBe(1);
    expect(at(0)).toBe(0);
  });

  it('flags night hours as dark', () => {
    const rows = freeTimeRows(scoredHours, { start: 18, end: 22 }, null, null);
    expect(rows.map((r) => r.dark)).toEqual([false, false, true, true]);
  });

  it('marks the current hour', () => {
    const rows = freeTimeRows(scoredHours, FREE, null, 14);
    expect(rows.filter((r) => r.now).map((r) => r.hour.hour)).toEqual([14]);
  });
});

describe('FreeTimeCard', () => {
  it('shows the free time, plan and duration in the header', () => {
    setup();
    expect(screen.getByText('13:00–19:00 · Relaxed · 1 h')).toBeInTheDocument();
  });

  it('is a table with visually hidden column headers', () => {
    setup();
    const table = screen.getByRole('table', { name: 'Your free time, hour by hour' });
    const headers = within(table).getAllByRole('columnheader');
    expect(headers.map((h) => h.textContent)).toEqual([
      'Time',
      'Weather',
      'UV',
      'Score',
      'Verdict',
    ]);
    for (const h of headers) expect(h).toHaveClass('sr-only');
  });

  it('has one 44 px row per free-time hour', () => {
    setup();
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows).toHaveLength(1 + 6);
    expect(rowOf(14).style.height).toBe(`${ROW_H}px`);
  });

  it('shows a short verdict with the full text for screen readers', () => {
    const day = makeDay({ 13: { uv: 1 }, 14: { uv: 7 }, 15: { uv: 10 } });
    setup(day);
    const good = rowOf(13);
    expect(within(good).getByText('Good', { selector: '[aria-hidden="true"]' })).toBeVisible();
    expect(within(good).getByText('Good', { selector: '.sr-only' })).toBeInTheDocument();
    const ok = rowOf(14);
    expect(within(ok).getByText('OK', { selector: '[aria-hidden="true"]' })).toBeVisible();
    expect(
      within(ok).getByText('OK with protection', { selector: '.sr-only' }),
    ).toBeInTheDocument();
    const avoid = rowOf(15);
    expect(within(avoid).getByText('Avoid', { selector: '[aria-hidden="true"]' })).toBeVisible();
    expect(
      within(avoid).getByText('Not recommended', { selector: '.sr-only' }),
    ).toBeInTheDocument();
  });

  it('shows "Dark" and no score bar for a night hour', () => {
    setup(makeDay(), { freeTime: { start: 18, end: 22 } });
    const dark = rowOf(21);
    expect(within(dark).getByText('Dark')).toBeInTheDocument();
    expect(dark.querySelector('[data-score-bar]')).toBeNull();
    expect(dark.querySelector('svg[data-icon="moon"]')).not.toBeNull();
    expect(rowOf(18).querySelector('[data-score-bar]')).not.toBeNull();
  });

  it('keeps the night variant of the weather icon on dark rows', () => {
    setup(makeDay({ 20: { weatherCode: 61 } }), { freeTime: { start: 20, end: 22 } });
    expect(rowOf(20).querySelector('svg[data-icon="rain"]')).not.toBeNull();
    expect(rowOf(21).querySelector('svg[data-icon="moon"]')).not.toBeNull();
  });

  it('shows rain only from 30 %, in the rain colour', () => {
    setup(makeDay({ 14: { rainProb: 60 }, 15: { rainProb: 20 } }));
    const wet = within(rowOf(14)).getByText('60%');
    expect(wet).toHaveClass(RAIN_TEXT_CLASS);
    expect(within(rowOf(15)).queryByText(/%/)).toBeNull();
  });

  it('shows UV rounded, and a dash when the value is missing', () => {
    setup(makeDay({ 14: { uv: 5.4 }, 15: { uv: null } }));
    expect(within(rowOf(14)).getByText('UV 5')).toBeInTheDocument();
    expect(within(rowOf(15)).getByText('UV –')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/null|NaN/);
  });

  it('never wraps the UV cell, even for "UV 10"', () => {
    setup(makeDay({ 14: { uv: 10 } }));
    const cell = within(rowOf(14)).getByText('UV 10');
    expect(cell).toHaveClass('whitespace-nowrap');
    expect(cell).toHaveClass('px-0');
    expect(cell).not.toHaveClass('px-1');
    const scoreCell = rowOf(14).querySelector('[data-score-bar]')!.closest('td')!;
    expect(scoreCell).toHaveClass('px-2');
    expect(scoreCell).not.toHaveClass('px-1');
  });

  it('labels the rows of the best window and bolds their time', () => {
    const day = makeDay({ 13: { uv: 7 }, 14: { uv: 7 }, 15: { uv: 7 } });
    const { best } = evaluated(day);
    setup(day);
    const bestRows = screen.getAllByRole('row').filter((r) => within(r).queryByText('Best'));
    expect(bestRows).toHaveLength(best!.hours.length);
    const time = within(bestRows[0]).getByText(/^\d\d:00$/);
    expect(time).toHaveClass('font-semibold');
  });

  it('draws the bar fill with the gradient clipped, and a dot only on the current hour', () => {
    const day = makeDay({ 14: { uv: 3 } });
    const { scoredHours } = evaluated(day);
    setup(day, { nowHour: 14 });
    const bar = rowOf(14).querySelector('[data-score-bar]')!;
    const score = scoredHours[14].score;
    expect(bar.getAttribute('data-fill')).toBe(String(Math.min(score, 8) / 8));
    expect(bar.querySelector('[data-bar-fill]')).not.toBeNull();
    expect(bar.querySelector('[data-bar-now]')).not.toBeNull();
    expect(rowOf(15).querySelector('[data-bar-now]')).toBeNull();
  });

  it('keeps past rows readable: icon, bar and dot fade, the text does not', () => {
    const day = makeDay();
    setup(day, { nowHour: 15 }, { hour: 15, minute: 0 });
    const past = rowOf(14);
    const current = rowOf(15);

    expect(past).toHaveAttribute('data-past');
    expect(past.style.opacity).toBe('');
    expect(past).not.toHaveClass('opacity-45');
    expect(past).toHaveClass('text-text-muted');
    expect(past.querySelector('svg[data-icon]')).toHaveClass('opacity-45');
    expect(past.querySelector('[data-score-bar]')).toHaveClass('opacity-45');
    expect(past.querySelector('[data-verdict-dot]')).toHaveClass('opacity-45');
    expect(past.querySelectorAll('.opacity-45')).toHaveLength(3);

    expect(current).not.toHaveAttribute('data-past');
    expect(current).toHaveClass('text-text');
    expect(current.querySelectorAll('.opacity-45')).toHaveLength(0);
  });
});
