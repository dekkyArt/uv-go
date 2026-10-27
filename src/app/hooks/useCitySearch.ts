import { useEffect, useState } from 'react';
import { searchCities } from '../../data/geocoding';
import type { Place } from '../../data/types';

export const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

export interface CitySearch {
  results: Place[];
  status: 'idle' | 'loading' | 'done' | 'error';
}

interface Settled {
  query: string;
  results: Place[];
  status: 'done' | 'error';
}

const NO_RESULTS: Place[] = [];

function isAbortError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError'
  );
}

/** Debounced city search; only the latest query may ever update the result. */
export function useCitySearch(query: string): CitySearch {
  const trimmed = query.trim();
  const [settled, setSettled] = useState<Settled | null>(null);

  useEffect(() => {
    if (trimmed.length < MIN_QUERY_LENGTH) return;
    const controller = new AbortController();
    // Guards against a response that resolves after its query was superseded,
    // even if the transport ignores the abort signal.
    let superseded = false;

    const timer = setTimeout(() => {
      searchCities(trimmed, controller.signal).then(
        (results) => {
          if (!superseded) setSettled({ query: trimmed, results, status: 'done' });
        },
        (err: unknown) => {
          if (superseded || isAbortError(err)) return;
          setSettled({ query: trimmed, results: NO_RESULTS, status: 'error' });
        },
      );
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      superseded = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  if (trimmed.length < MIN_QUERY_LENGTH) return { results: NO_RESULTS, status: 'idle' };
  if (settled === null || settled.query !== trimmed) {
    return { results: settled?.results ?? NO_RESULTS, status: 'loading' };
  }
  return { results: settled.results, status: settled.status };
}
