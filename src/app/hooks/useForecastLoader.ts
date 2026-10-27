import { useEffect, type Dispatch } from 'react';
import { getForecast } from '../../data/openMeteo';
import { nowLocal } from '../../data/time';
import type { Place } from '../../data/types';
import type { Action } from '../state';

function isAbortError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError'
  );
}

/** Loads the forecast for `place`; aborts the request on place change, retry or unmount. */
export function useForecastLoader(
  place: Place | null,
  retryToken: number,
  dispatch: Dispatch<Action>,
): void {
  const lat = place?.lat;
  const lon = place?.lon;

  useEffect(() => {
    if (lat === undefined || lon === undefined) return;
    const controller = new AbortController();
    dispatch({ type: 'forecastLoading' });

    getForecast(lat, lon, { signal: controller.signal, force: retryToken > 0 }).then(
      (forecast) => {
        if (controller.signal.aborted) return;
        dispatch({
          type: 'forecastLoaded',
          forecast,
          now: nowLocal(forecast.utcOffsetSeconds),
        });
      },
      (err: unknown) => {
        if (controller.signal.aborted || isAbortError(err)) return;
        dispatch({ type: 'forecastFailed' });
      },
    );

    return () => controller.abort();
  }, [lat, lon, retryToken, dispatch]);
}
