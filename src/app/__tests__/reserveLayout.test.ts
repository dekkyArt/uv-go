import { describe, expect, it } from 'vitest';
import { reserveLayout } from '../reserveLayout';

function fakeWindow(getItem: (key: string) => string | null) {
  const root = document.createElement('html');
  return {
    root,
    win: { localStorage: { getItem }, document: { documentElement: root } },
  };
}

const fromStorage = (items: Record<string, unknown>) => (key: string) =>
  key in items ? JSON.stringify(items[key]) : null;

const freeRows = (root: HTMLElement) => root.style.getPropertyValue('--free-rows');

describe('reserveLayout', () => {
  it('sets --free-rows to the stored free time length', () => {
    const { root, win } = fakeWindow(
      fromStorage({ 'uvgo:inputs': { freeTime: { start: 9, end: 17 } } }),
    );
    reserveLayout(win);
    expect(freeRows(root)).toBe('8');
  });

  it('falls back to 6 rows without stored inputs', () => {
    const { root, win } = fakeWindow(() => null);
    reserveLayout(win);
    expect(freeRows(root)).toBe('6');
    expect(root.dataset.hasPlace).toBeUndefined();
  });

  it('falls back to 6 rows on broken JSON', () => {
    const { root, win } = fakeWindow(() => '{not json');
    expect(() => reserveLayout(win)).not.toThrow();
    expect(freeRows(root)).toBe('6');
  });

  it('falls back to 6 rows on an invalid free time', () => {
    for (const freeTime of [
      { start: 17, end: 9 },
      { start: 9.5, end: 17 },
      { start: 9, end: 25 },
      { start: '9', end: 17 },
      null,
    ]) {
      const { root, win } = fakeWindow(fromStorage({ 'uvgo:inputs': { freeTime } }));
      reserveLayout(win);
      expect(freeRows(root)).toBe('6');
    }
  });

  it('falls back to 6 rows and does not throw when storage throws', () => {
    const { root, win } = fakeWindow(() => {
      throw new Error('denied');
    });
    expect(() => reserveLayout(win)).not.toThrow();
    expect(freeRows(root)).toBe('6');
    expect(root.dataset.hasPlace).toBeUndefined();
  });

  it('marks a valid stored place with data-has-place', () => {
    const { root, win } = fakeWindow(
      fromStorage({ 'uvgo:location': { id: 1, name: 'Lisbon', lat: 38.72, lon: -9.14 } }),
    );
    reserveLayout(win);
    expect(root.dataset.hasPlace).toBe('');
  });

  it('does not mark an invalid stored place', () => {
    const { root, win } = fakeWindow(fromStorage({ 'uvgo:location': { name: '', lat: 1 } }));
    reserveLayout(win);
    expect(root.dataset.hasPlace).toBeUndefined();
  });

  it('stays self-contained, so it can be inlined with toString', () => {
    const { root, win } = fakeWindow(
      fromStorage({ 'uvgo:inputs': { freeTime: { start: 10, end: 12 } } }),
    );
    // Rebuilt from source, without the module scope: any outer name would throw here.
    const inlined = new Function(`return (${reserveLayout.toString()})`)() as typeof reserveLayout;
    inlined(win);
    expect(freeRows(root)).toBe('2');
  });
});
