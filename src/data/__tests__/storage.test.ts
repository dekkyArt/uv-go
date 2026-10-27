import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadInputs, loadPlace, saveInputs, savePlace } from '../storage';

const LOCATION_KEY = 'uvgo:location';
const INPUTS_KEY = 'uvgo:inputs';

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('place storage', () => {
  const lisbon = {
    id: 2267057,
    name: 'Lisbon',
    admin1: 'Lisbon',
    country: 'Portugal',
    lat: 38.72,
    lon: -9.14,
  };

  it('round-trips a place under uvgo:location', () => {
    savePlace(lisbon);
    expect(JSON.parse(window.localStorage.getItem(LOCATION_KEY) ?? 'null')).toEqual(lisbon);
    expect(loadPlace()).toEqual(lisbon);
  });

  it('returns null when nothing is stored', () => {
    expect(loadPlace()).toBeNull();
  });

  it('defaults a missing id to 0 (old record shape)', () => {
    window.localStorage.setItem(LOCATION_KEY, JSON.stringify({ name: 'Porto', lat: 41, lon: -8 }));
    expect(loadPlace()).toEqual({ id: 0, name: 'Porto', lat: 41, lon: -8 });
  });

  it('drops non-string optional fields', () => {
    window.localStorage.setItem(
      LOCATION_KEY,
      JSON.stringify({ id: 1, name: 'Porto', admin1: 5, country: null, lat: 41, lon: -8 }),
    );
    expect(loadPlace()).toEqual({ id: 1, name: 'Porto', lat: 41, lon: -8 });
  });

  it.each([
    ['invalid JSON', '{nope'],
    ['null', 'null'],
    ['an array', '[]'],
    ['a string', '"Lisbon"'],
    ['missing name', JSON.stringify({ lat: 1, lon: 2 })],
    ['empty name', JSON.stringify({ name: '', lat: 1, lon: 2 })],
    ['string lat', JSON.stringify({ name: 'X', lat: '1', lon: 2 })],
    ['missing lon', JSON.stringify({ name: 'X', lat: 1 })],
    ['non-finite lat', '{"name":"X","lat":1e999,"lon":2}'],
    ['non-number id', JSON.stringify({ id: 'a', name: 'X', lat: 1, lon: 2 })],
  ])('returns null for %s', (_label, raw) => {
    window.localStorage.setItem(LOCATION_KEY, raw);
    expect(loadPlace()).toBeNull();
  });
});

describe('inputs storage', () => {
  const inputs = {
    freeTime: { start: 9, end: 17 },
    duration: 120 as const,
    activity: 'active' as const,
  };

  it('round-trips inputs under uvgo:inputs and never stores day', () => {
    saveInputs({ ...inputs, day: 'tomorrow' } as typeof inputs);
    const raw = JSON.parse(window.localStorage.getItem(INPUTS_KEY) ?? 'null');
    expect(raw).toEqual(inputs);
    expect(raw).not.toHaveProperty('day');
    expect(loadInputs()).toEqual(inputs);
  });

  it('returns {} when nothing is stored', () => {
    expect(loadInputs()).toEqual({});
  });

  it('drops invalid stored inputs field by field', () => {
    window.localStorage.setItem(
      INPUTS_KEY,
      JSON.stringify({ freeTime: { start: 19, end: 13 }, duration: 45, activity: 'relaxed' }),
    );
    expect(loadInputs()).toEqual({ activity: 'relaxed' });
  });

  it.each([
    [{ start: 0, end: 24 }, true],
    [{ start: 13, end: 19 }, true],
    [{ start: 24, end: 24 }, false],
    [{ start: -1, end: 5 }, false],
    [{ start: 1, end: 25 }, false],
    [{ start: 5, end: 5 }, false],
    [{ start: 1.5, end: 5 }, false],
    [{ start: 1, end: 5.5 }, false],
    [{ start: '1', end: 5 }, false],
    [{ start: 1 }, false],
    ['13-19', false],
    [null, false],
  ])('validates freeTime %j -> %s', (freeTime, valid) => {
    window.localStorage.setItem(INPUTS_KEY, JSON.stringify({ freeTime }));
    expect(loadInputs()).toEqual(valid ? { freeTime } : {});
  });

  it.each([30, 60, 120, 180])('accepts duration %i', (duration) => {
    window.localStorage.setItem(INPUTS_KEY, JSON.stringify({ duration }));
    expect(loadInputs()).toEqual({ duration });
  });

  it.each([45, '60', 0, null])('rejects duration %j', (duration) => {
    window.localStorage.setItem(INPUTS_KEY, JSON.stringify({ duration }));
    expect(loadInputs()).toEqual({});
  });

  it.each(['active', 'relaxed', 'long-sun'])('accepts activity %s', (activity) => {
    window.localStorage.setItem(INPUTS_KEY, JSON.stringify({ activity }));
    expect(loadInputs()).toEqual({ activity });
  });

  it.each(['Active', 'sunbathing', 1, null])('rejects activity %j', (activity) => {
    window.localStorage.setItem(INPUTS_KEY, JSON.stringify({ activity }));
    expect(loadInputs()).toEqual({});
  });

  it.each([['{nope'], ['null'], ['[]'], ['42'], ['"x"']])(
    'returns {} for non-object/invalid JSON %s',
    (raw) => {
      window.localStorage.setItem(INPUTS_KEY, raw);
      expect(loadInputs()).toEqual({});
    },
  );
});

describe('unavailable storage', () => {
  it('survives getItem and setItem throwing without console errors', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(loadPlace()).toBeNull();
    expect(loadInputs()).toEqual({});
    expect(() => savePlace({ id: 1, name: 'X', lat: 1, lon: 2 })).not.toThrow();
    expect(() =>
      saveInputs({ freeTime: { start: 1, end: 2 }, duration: 60, activity: 'relaxed' }),
    ).not.toThrow();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('survives window.localStorage itself throwing', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(loadPlace()).toBeNull();
    expect(loadInputs()).toEqual({});
    expect(() => savePlace({ id: 1, name: 'X', lat: 1, lon: 2 })).not.toThrow();
    expect(() =>
      saveInputs({ freeTime: { start: 1, end: 2 }, duration: 60, activity: 'relaxed' }),
    ).not.toThrow();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
