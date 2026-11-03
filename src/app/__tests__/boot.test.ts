import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BOOT_MAX_MS, BOOT_OUT_MS, endBoot, startBoot } from '../boot';

function fakeWindow(place: unknown, { hasPlace = true } = {}) {
  const root = document.createElement('html');
  if (hasPlace) root.dataset.hasPlace = '';
  const label = document.createElement('p');
  const win = {
    localStorage: {
      getItem: (key: string) => (key === 'uvgo:location' ? JSON.stringify(place) : null),
    },
    document: {
      documentElement: root,
      querySelector: (selector: string) => (selector === '[data-boot-place]' ? label : null),
    },
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
  };
  return { root, label, win };
}

const LISBON = { name: 'Lisbon', lat: 38.72, lon: -9.14 };

describe('startBoot', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('hides the page and names the stored place when a place is stored', () => {
    const { root, label, win } = fakeWindow(LISBON);
    startBoot(BOOT_MAX_MS, BOOT_OUT_MS, win);
    expect(root.dataset.boot).toBe('on');
    expect(label.textContent).toBe('Lisbon');
  });

  it('does nothing on a first visit, which has nothing to load', () => {
    const { root, label, win } = fakeWindow(null, { hasPlace: false });
    startBoot(BOOT_MAX_MS, BOOT_OUT_MS, win);
    expect(root.dataset.boot).toBeUndefined();
    expect(label.textContent).toBe('');
  });

  it('shows the page after the cap even if the app never says it is ready', () => {
    const { root, win } = fakeWindow(LISBON);
    startBoot(BOOT_MAX_MS, BOOT_OUT_MS, win);
    vi.advanceTimersByTime(BOOT_MAX_MS - 1);
    expect(root.dataset.boot).toBe('on');
    vi.advanceTimersByTime(1);
    expect(root.dataset.boot).toBe('out');
    vi.advanceTimersByTime(BOOT_OUT_MS);
    expect(root.dataset.boot).toBeUndefined();
  });

  it('leaves an earlier hand-over alone when the cap fires', () => {
    const { root, win } = fakeWindow(LISBON);
    startBoot(BOOT_MAX_MS, BOOT_OUT_MS, win);
    delete root.dataset.boot;
    vi.advanceTimersByTime(BOOT_MAX_MS + BOOT_OUT_MS);
    expect(root.dataset.boot).toBeUndefined();
  });

  it('survives unreadable storage', () => {
    const { root, label, win } = fakeWindow(LISBON);
    win.localStorage.getItem = () => '{not json';
    expect(() => startBoot(BOOT_MAX_MS, BOOT_OUT_MS, win)).not.toThrow();
    expect(root.dataset.boot).toBe('on');
    expect(label.textContent).toBe('');
  });

  it('is self-contained, so it can be inlined into the page', () => {
    const { root, win } = fakeWindow(LISBON);
    // The same as the inline script on the home page: no closure over module scope.
    const inlined = new Function('win', `(${startBoot.toString()})(1, 1, win)`);
    inlined(win);
    expect(root.dataset.boot).toBe('on');
  });
});

describe('endBoot', () => {
  const root = document.documentElement;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'requestAnimationFrame'] });
  });
  afterEach(() => {
    vi.useRealTimers();
    delete root.dataset.boot;
  });

  it('hands over two frames later, then clears the flag once the page is in', () => {
    root.dataset.boot = 'on';
    endBoot();
    expect(root.dataset.boot).toBe('on');
    vi.advanceTimersToNextFrame();
    expect(root.dataset.boot).toBe('on');
    vi.advanceTimersToNextFrame();
    expect(root.dataset.boot).toBe('out');
    vi.advanceTimersByTime(BOOT_OUT_MS);
    expect(root.dataset.boot).toBeUndefined();
  });

  it('does nothing without a splash or while it is already leaving', () => {
    endBoot();
    vi.advanceTimersByTime(1000);
    expect(root.dataset.boot).toBeUndefined();

    root.dataset.boot = 'out';
    endBoot();
    vi.advanceTimersToNextFrame();
    vi.advanceTimersToNextFrame();
    expect(root.dataset.boot).toBe('out');
  });
});
