import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeDay, makeWindow, scored } from '../../domain/__tests__/factories';
import { DayArcTimeline, arcPoint } from '../components/DayArcTimeline';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('arcPoint', () => {
  it('runs from the left end to the right end of the baseline', () => {
    const a = arcPoint(0);
    const b = arcPoint(1);
    expect(a.x).toBeCloseTo(20);
    expect(a.y).toBeCloseTo(120);
    expect(b.x).toBeCloseTo(300);
    expect(b.y).toBeCloseTo(120);
  });

  it('peaks at the middle and stays inside the 320x140 viewBox', () => {
    expect(arcPoint(0.5).y).toBeLessThan(arcPoint(0.25).y);
    expect(arcPoint(0.5).x).toBeCloseTo(160);
    for (let t = 0; t <= 1; t += 0.05) {
      const { x, y } = arcPoint(t);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(320);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(140);
    }
  });
});

describe('DayArcTimeline', () => {
  const day = makeDay({ 15: { uv: 6 }, 3: { isDay: false } });

  function setup(selectedHour: number | null, d = day, onSelect = vi.fn()) {
    render(
      <DayArcTimeline
        day={d}
        hours={scored(d, 'relaxed')}
        freeTime={{ start: 13, end: 19 }}
        best={null}
        selectedHour={selectedHour}
        onSelect={onSelect}
        playIntro={false}
      />,
    );
    return { onSelect, slider: screen.getByRole('slider', { name: 'Hour of the day' }) };
  }

  it('shows the sun in daylight and no moon', () => {
    setup(15);
    expect(document.querySelector('[data-sun]')).toBeInTheDocument();
    expect(document.querySelector('[data-moon]')).not.toBeInTheDocument();
  });

  it('shows the moon and no sun for a night hour', () => {
    setup(3);
    expect(document.querySelector('[data-moon]')).toBeInTheDocument();
    expect(document.querySelector('[data-sun]')).not.toBeInTheDocument();
  });

  it('shows the moon at night when sunrise and sunset are missing (polar night)', () => {
    const polarNight = makeDay(
      Object.fromEntries(Array.from({ length: 24 }, (_, h) => [h, { isDay: false }])),
      { sunrise: '', sunset: '' },
    );
    setup(12, polarNight);
    expect(document.querySelector('[data-moon]')).toBeInTheDocument();
    expect(document.querySelector('[data-sun]')).not.toBeInTheDocument();
  });

  it('puts the sun at the centre of the arc on polar day', () => {
    const polarDay = makeDay(
      Object.fromEntries(Array.from({ length: 24 }, (_, h) => [h, { isDay: true }])),
      { sunrise: '', sunset: '' },
    );
    setup(3, polarDay);
    const sun = document.querySelector('[data-sun]')!;
    expect(sun).toHaveAttribute('data-position', '0.5');
  });

  it('places the sun by the formula of the sky: noon is mid-arc', () => {
    setup(13);
    // sunrise 06:30, sunset 19:30 -> solar noon 13:00.
    expect(document.querySelector('[data-sun]')).toHaveAttribute('data-position', '0.5');
  });

  it('moves the sun with a transform, not layout properties', () => {
    setup(13);
    const style = (document.querySelector('[data-sun]') as SVGElement).getAttribute('style') ?? '';
    expect(style).toMatch(/transform/);
    expect(style).not.toMatch(/\b(left|top|width|height)\b/);
  });

  it('keeps the best-window frame off the hour labels and the dotted arc dotted', () => {
    const d = makeDay({});
    const best = makeWindow({ 14: {}, 15: {} });
    render(
      <DayArcTimeline
        day={d}
        hours={scored(d, 'relaxed')}
        freeTime={{ start: 13, end: 19 }}
        best={best}
        selectedHour={null}
        onSelect={vi.fn()}
        playIntro
      />,
    );
    const frame = document.querySelector('.border-text')!;
    const container = frame.parentElement!;
    expect(container.contains(document.querySelector('[data-hour="14"]'))).toBe(true);
    expect(container.textContent).not.toContain('18');
    expect(container.querySelector('.text-xs')).toBeNull();
    // the dotted path is static; only the mask path is drawn by pathLength
    expect(document.querySelector('path[stroke-dasharray="1 6"]')).toBeInTheDocument();
  });

  it('keeps arrow-key selection working through the strip', async () => {
    const user = userEvent.setup();
    const { slider, onSelect } = setup(15);
    slider.focus();
    await user.keyboard('{ArrowRight}');
    expect(onSelect).toHaveBeenLastCalledWith(16);
    await user.keyboard('{ArrowLeft}');
    expect(onSelect).toHaveBeenLastCalledWith(14);
  });

  it('selects an hour on click', async () => {
    const user = userEvent.setup();
    const { onSelect } = setup(null);
    await user.click(document.querySelector('[data-hour="10"]')!);
    expect(onSelect).toHaveBeenCalledWith(10);
  });

  it('renders the strip without throwing when matchMedia reports a touch device', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(hover: none)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const { slider } = setup(null);
    expect(slider).toBeInTheDocument();
    expect(document.querySelectorAll('[data-hour]')).toHaveLength(24);
  });
});
