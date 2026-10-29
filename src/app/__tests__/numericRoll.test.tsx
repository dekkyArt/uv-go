import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MotionProvider } from '../../motion/MotionProvider';
import { NumericRoll, rollDirection, rollParts } from '../components/NumericRoll';

// Read through `useReducedMotion`, like the other motion tests.
const prefs = vi.hoisted(() => ({ reduced: false }));
vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('motion/react')>()),
  useReducedMotion: () => prefs.reduced,
}));

beforeEach(() => {
  prefs.reduced = false;
});

describe('rollParts', () => {
  it('marks only the characters that differ by position', () => {
    const parts = rollParts('15:00–16:00', '17:00–18:00');
    expect(parts.map((p) => p.char).join('')).toBe('17:00–18:00');
    const changed = parts.flatMap((p, i) => (p.changed ? [i] : []));
    expect(changed).toEqual([1, 7]);
  });

  it('treats every character as changed when the length differs', () => {
    const parts = rollParts('9', '10');
    expect(parts.map((p) => p.changed)).toEqual([true, true]);
  });

  it('marks nothing for equal strings', () => {
    expect(rollParts('Now UV 6', 'Now UV 6').some((p) => p.changed)).toBe(false);
  });
});

describe('rollDirection', () => {
  it('goes down when the number gets smaller and up otherwise', () => {
    expect(rollDirection('15:00', '13:00')).toBe(-1);
    expect(rollDirection('13:00', '15:00')).toBe(1);
    expect(rollDirection('UV 9', 'UV 10')).toBe(1);
  });

  it('goes up when there is no number to compare', () => {
    expect(rollDirection('–', '5')).toBe(1);
    expect(rollDirection('5', '–')).toBe(1);
  });
});

const renderRoll = (value: string) =>
  render(
    <MotionProvider>
      <NumericRoll value={value} />
    </MotionProvider>,
  );

const rerenderRoll = (rerender: ReturnType<typeof renderRoll>['rerender'], value: string) =>
  rerender(
    <MotionProvider>
      <NumericRoll value={value} />
    </MotionProvider>,
  );

const rolling = (root: HTMLElement) => root.querySelectorAll<HTMLElement>('[data-rolling]');

describe('NumericRoll', () => {
  it('gives assistive tech the value once, as text, and hides every character', () => {
    const { container } = renderRoll('15:00–16:00');
    expect(screen.getByText('15:00–16:00')).toHaveClass('sr-only');
    const slots = container.querySelectorAll('[aria-hidden="true"]');
    expect(slots).toHaveLength('15:00–16:00'.length);
    expect([...container.querySelectorAll('[data-char]')].map((el) => el.textContent)).toEqual(
      Array.from('15:00–16:00', () => ''),
    );
    expect(container).toHaveTextContent(/^15:00–16:00$/);
  });

  it('does not roll on the first mount', () => {
    const { container } = renderRoll('15:00–16:00');
    expect(rolling(container)).toHaveLength(0);
  });

  it('rolls only the changed characters, and the text is never doubled', async () => {
    const { container, rerender } = renderRoll('15:00–16:00');
    rerenderRoll(rerender, '17:00–18:00');
    expect(screen.getByText('17:00–18:00')).toBeInTheDocument();
    expect(container).toHaveTextContent(/^17:00–18:00$/);
    expect([...rolling(container)].map((el) => el.dataset.char)).toEqual(['7', '8']);
    // Unchanged characters keep their place and carry no roll marker.
    const stay = container.querySelectorAll<HTMLElement>('[data-char]:not([data-rolling])');
    expect([...stay].map((el) => el.dataset.char).join('')).toBe('1:00–1:00');
    // The old digits leave once their exit has played.
    await waitFor(() => expect(container.querySelectorAll('[data-char]')).toHaveLength(11));
    expect(container).toHaveTextContent(/^17:00–18:00$/);
  });

  it('rolls every character in when the string grows, new slots included', () => {
    const { container, rerender } = renderRoll('9');
    rerenderRoll(rerender, '10');
    const slots = [...rolling(container)];
    expect(slots.map((el) => el.dataset.char)).toEqual(['1', '0']);
    for (const el of slots) expect(el.style.opacity).toBe('0');
  });

  it('enters from below when the value grows and from above when it shrinks', () => {
    const up = renderRoll('13:00');
    rerenderRoll(up.rerender, '15:00');
    expect(rolling(up.container)[0].style.transform).toContain('translateY(0.6em)');
    up.unmount();

    const down = renderRoll('15:00');
    rerenderRoll(down.rerender, '13:00');
    expect(rolling(down.container)[0].style.transform).toContain('translateY(-0.6em)');
    expect(rolling(down.container)[0].style.filter).toContain('blur(4px)');
  });

  it('only fades with reduced motion: no shift and no blur', () => {
    prefs.reduced = true;
    const { container, rerender } = renderRoll('13:00');
    rerenderRoll(rerender, '15:00');
    const el = rolling(container)[0];
    expect(el.style.opacity).toBe('0');
    expect(el.style.transform).toBe('');
    expect(el.style.filter).toBe('');
    expect(container.innerHTML).not.toContain('blur');
  });
});
