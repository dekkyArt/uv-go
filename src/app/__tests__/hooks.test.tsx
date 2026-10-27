import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearForecastCache } from '../../data/openMeteo';
import type { Place } from '../../data/types';
import { makeForecastJson } from '../../test/forecastJson';
import { useCitySearch } from '../hooks/useCitySearch';
import { useForecastLoader } from '../hooks/useForecastLoader';
import { useNow } from '../hooks/useNow';
import type { Action } from '../state';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

function geoBody(name: string) {
  return { results: [{ id: 1, name, latitude: 1, longitude: 2 }] };
}

interface Deferred {
  resolve: (r: Response) => void;
  reject: (e: unknown) => void;
  promise: Promise<Response>;
}

function deferred(): Deferred {
  let resolve!: (r: Response) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<Response>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { resolve, reject, promise };
}

function abortError() {
  return new DOMException('Aborted', 'AbortError');
}

/** A fetch mock with manually resolved promises; by default they reject with AbortError on abort. */
function pendingFetch(fetchMock: ReturnType<typeof vi.fn>, { abortable = true } = {}) {
  const calls: { url: string; signal?: AbortSignal; d: Deferred }[] = [];
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const d = deferred();
    if (abortable) init?.signal?.addEventListener('abort', () => d.reject(abortError()));
    calls.push({ url, signal: init?.signal ?? undefined, d });
    return d.promise;
  });
  return calls;
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  clearForecastCache();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useCitySearch', () => {
  it('debounces typing into exactly one fetch for the final query', async () => {
    fetchMock.mockResolvedValue(jsonResponse(geoBody('Lisbon')));
    const { result, rerender } = renderHook(({ q }) => useCitySearch(q), {
      initialProps: { q: 'L' },
    });
    rerender({ q: 'Li' });
    await act(() => vi.advanceTimersByTimeAsync(100));
    rerender({ q: 'Lis' });
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(fetchMock).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('name=Lis&');
    expect(result.current.status).toBe('done');
    expect(result.current.results.map((p) => p.name)).toEqual(['Lisbon']);
  });

  it('stays idle without fetching for queries shorter than 2 characters', async () => {
    const { result } = renderHook(() => useCitySearch(' a '));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current).toEqual({ results: [], status: 'idle' });
  });

  it('reports loading while the request is in flight', async () => {
    pendingFetch(fetchMock);
    const { result } = renderHook(() => useCitySearch('Lis'));
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(result.current.status).toBe('loading');
  });

  it('ignores out-of-order responses', async () => {
    // The transport ignores abort, so only the hook's own guard can protect the result.
    const calls = pendingFetch(fetchMock, { abortable: false });
    const { result, rerender } = renderHook(({ q }) => useCitySearch(q), {
      initialProps: { q: 'Lis' },
    });
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(calls).toHaveLength(1);
    rerender({ q: 'Lisb' });
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(calls).toHaveLength(2);

    // The newer response lands first, the stale one afterwards.
    await act(async () => {
      calls[1].d.resolve(jsonResponse(geoBody('Lisbon')));
    });
    await act(async () => {
      calls[0].d.resolve(jsonResponse(geoBody('Lisburn')));
    });
    expect(result.current.status).toBe('done');
    expect(result.current.results.map((p) => p.name)).toEqual(['Lisbon']);
  });

  it('aborts the previous request when the query changes', async () => {
    const calls = pendingFetch(fetchMock);
    const { rerender } = renderHook(({ q }) => useCitySearch(q), { initialProps: { q: 'Lis' } });
    await act(() => vi.advanceTimersByTimeAsync(300));
    rerender({ q: 'Lisb' });
    expect(calls[0].signal?.aborted).toBe(true);
  });

  it('reports an error when the search fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'));
    const { result } = renderHook(() => useCitySearch('Lis'));
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(result.current).toEqual({ results: [], status: 'error' });
  });

  it('clears results when the query becomes too short', async () => {
    fetchMock.mockResolvedValue(jsonResponse(geoBody('Lisbon')));
    const { result, rerender } = renderHook(({ q }) => useCitySearch(q), {
      initialProps: { q: 'Lis' },
    });
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(result.current.results).toHaveLength(1);
    rerender({ q: 'L' });
    expect(result.current).toEqual({ results: [], status: 'idle' });
  });
});

describe('useNow', () => {
  it('returns null without an offset', () => {
    const { result } = renderHook(() => useNow(null));
    expect(result.current).toBeNull();
  });

  it('ticks every minute', () => {
    vi.setSystemTime(new Date('2026-10-27T10:00:30Z'));
    const { result } = renderHook(() => useNow(3600));
    expect(result.current).toEqual({ date: '2026-10-27', hour: 11, minute: 0 });
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toEqual({ date: '2026-10-27', hour: 11, minute: 1 });
  });

  it('rolls the date over at local midnight', () => {
    vi.setSystemTime(new Date('2026-10-27T23:59:30Z'));
    const { result } = renderHook(() => useNow(0));
    expect(result.current?.date).toBe('2026-10-27');
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toEqual({ date: '2026-10-28', hour: 0, minute: 0 });
  });

  it('refreshes at once when the tab becomes visible again, without waiting for the tick', () => {
    vi.setSystemTime(new Date('2026-10-27T23:50:00Z'));
    const { result } = renderHook(() => useNow(0));
    expect(result.current?.date).toBe('2026-10-27');

    // The tab slept: the clock moved on but no interval fired.
    vi.setSystemTime(new Date('2026-10-28T07:00:10Z'));
    const visibility = vi.spyOn(document, 'visibilityState', 'get');
    visibility.mockReturnValue('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current?.date).toBe('2026-10-27');

    visibility.mockReturnValue('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toEqual({ date: '2026-10-28', hour: 7, minute: 0 });
    visibility.mockRestore();
  });

  it('stops listening for visibility changes after unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = renderHook(() => useNow(0));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    removeSpy.mockRestore();
  });

  it('stops ticking after unmount', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    const { unmount } = renderHook(() => useNow(0));
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });
});

describe('useForecastLoader', () => {
  const lisbon: Place = { id: 1, name: 'Lisbon', lat: 38.72, lon: -9.14 };
  const porto: Place = { id: 2, name: 'Porto', lat: 41.15, lon: -8.61 };

  it('does nothing without a place', async () => {
    const dispatch = vi.fn();
    renderHook(() => useForecastLoader(null, 0, dispatch));
    await act(() => vi.advanceTimersByTimeAsync(10));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('dispatches loading, then loaded with the local now', async () => {
    vi.setSystemTime(new Date('2026-10-27T12:30:00Z'));
    fetchMock.mockResolvedValue(jsonResponse(makeForecastJson({ offsetSeconds: 3600 })));
    const dispatch = vi.fn<(a: Action) => void>();
    renderHook(() => useForecastLoader(lisbon, 0, dispatch));
    expect(dispatch).toHaveBeenCalledWith({ type: 'forecastLoading' });
    await act(() => vi.advanceTimersByTimeAsync(0));
    const loaded = dispatch.mock.calls.map(([a]) => a).find((a) => a.type === 'forecastLoaded');
    expect(loaded).toBeDefined();
    if (loaded?.type !== 'forecastLoaded') throw new Error('unreachable');
    expect(loaded.now).toEqual({ date: '2026-10-27', hour: 13, minute: 30 });
    expect(loaded.forecast.utcOffsetSeconds).toBe(3600);
  });

  it('aborts the previous request when the place changes', async () => {
    const calls = pendingFetch(fetchMock);
    const dispatch = vi.fn<(a: Action) => void>();
    const { rerender } = renderHook(({ p }) => useForecastLoader(p, 0, dispatch), {
      initialProps: { p: lisbon },
    });
    expect(calls).toHaveLength(1);
    rerender({ p: porto });
    expect(calls[0].signal?.aborted).toBe(true);
    expect(calls).toHaveLength(2);
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(dispatch.mock.calls.map(([a]) => a.type)).not.toContain('forecastFailed');
  });

  it('aborts on unmount', () => {
    const calls = pendingFetch(fetchMock);
    const { unmount } = renderHook(() => useForecastLoader(lisbon, 0, vi.fn()));
    unmount();
    expect(calls[0].signal?.aborted).toBe(true);
  });

  it('dispatches forecastFailed when the request fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'));
    const dispatch = vi.fn<(a: Action) => void>();
    renderHook(() => useForecastLoader(lisbon, 0, dispatch));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'forecastFailed' });
  });

  it('retries with force when the token increases, bypassing the cache', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(makeForecastJson()));
    const dispatch = vi.fn<(a: Action) => void>();
    const { rerender } = renderHook(({ t }) => useForecastLoader(lisbon, t, dispatch), {
      initialProps: { t: 0 },
    });
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    rerender({ t: 1 });
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
