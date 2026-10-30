import { useSyncExternalStore } from 'react';

/**
 * Whether the lazy motion features failed to load (offline, a failed deploy). Without them no
 * `m.*` element ever leaves its `initial` values, so whatever would start hidden starts at rest.
 */
let failed = false;
const listeners = new Set<() => void>();

export function markFeaturesFailed(): void {
  if (failed) return;
  failed = true;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useFeaturesFailed(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => failed,
    () => false,
  );
}
