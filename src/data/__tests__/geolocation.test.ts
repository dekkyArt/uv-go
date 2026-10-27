import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GEOLOCATION_GUARD_MARGIN_MS,
  GEOLOCATION_TIMEOUT_MS,
  GeoError,
  requestPosition,
  YOUR_LOCATION_ID,
  yourLocationPlace,
} from '../geolocation';

function stubGeolocation(
  impl: (ok: PositionCallback, err: PositionErrorCallback, opts?: PositionOptions) => void,
) {
  const getCurrentPosition = vi.fn(impl);
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition },
    configurable: true,
  });
  return getCurrentPosition;
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'geolocation');
});

describe('requestPosition', () => {
  it('rejects with unavailable when navigator.geolocation is missing', async () => {
    Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true });
    const err = await requestPosition().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GeoError);
    expect((err as GeoError).code).toBe('unavailable');
  });

  it.each([
    [1, 'denied'],
    [2, 'unavailable'],
    [3, 'timeout'],
  ])('maps PositionError code %i to %s', async (code, expected) => {
    stubGeolocation((_ok, fail) => fail({ code, message: 'x' } as GeolocationPositionError));
    const err = await requestPosition().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GeoError);
    expect((err as GeoError).code).toBe(expected);
  });

  it('resolves with lat/lon and asks with a 10 s timeout', async () => {
    const spy = stubGeolocation((ok) =>
      ok({ coords: { latitude: 38.7, longitude: -9.1 } } as GeolocationPosition),
    );
    await expect(requestPosition()).resolves.toEqual({ lat: 38.7, lon: -9.1 });
    expect(GEOLOCATION_TIMEOUT_MS).toBe(10000);
    expect(spy.mock.calls[0][2]).toMatchObject({ timeout: 10000 });
  });

  it('rejects with unavailable when getCurrentPosition throws', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: () => {
          throw new Error('boom');
        },
      },
      configurable: true,
    });
    const err = await requestPosition().catch((e: unknown) => e);
    expect((err as GeoError).code).toBe('unavailable');
  });
});

describe('requestPosition guard', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects with timeout when an ignored permission prompt never calls back', async () => {
    vi.useFakeTimers();
    stubGeolocation(() => {
      // The prompt stays open: neither callback fires and the browser timeout never starts.
    });
    const pending = requestPosition().catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(GEOLOCATION_TIMEOUT_MS + GEOLOCATION_GUARD_MARGIN_MS);
    const err = await pending;
    expect(err).toBeInstanceOf(GeoError);
    expect((err as GeoError).code).toBe('timeout');
  });

  it('does not reject early and ignores the guard once a position arrived', async () => {
    vi.useFakeTimers();
    let succeed: PositionCallback = () => undefined;
    stubGeolocation((ok) => {
      succeed = ok;
    });
    const settled = vi.fn();
    const pending = requestPosition().then(settled, settled);
    await vi.advanceTimersByTimeAsync(GEOLOCATION_TIMEOUT_MS);
    expect(settled).not.toHaveBeenCalled();
    succeed({ coords: { latitude: 1, longitude: 2 } } as GeolocationPosition);
    await expect(pending).resolves.toBeUndefined();
    expect(settled).toHaveBeenCalledWith({ lat: 1, lon: 2 });
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('yourLocationPlace', () => {
  it('builds the "Your location" place', () => {
    expect(YOUR_LOCATION_ID).toBe(-1);
    expect(yourLocationPlace(1.5, 2.5)).toEqual({
      id: -1,
      name: 'Your location',
      lat: 1.5,
      lon: 2.5,
    });
  });
});
