/** Where the browser has no idle callback, `fn` runs this long after the call (spec 6.7). */
export const IDLE_FALLBACK_MS = 200;

/** Runs `fn` once the page is idle, so the sky stays out of LCP and TBT. Returns a cancel. */
export function whenIdle(fn: () => void): () => void {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(fn);
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(fn, IDLE_FALLBACK_MS);
  return () => clearTimeout(id);
}
