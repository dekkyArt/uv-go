import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach } from 'vitest';

// jsdom drives requestAnimationFrame with setInterval, which tests fake to move the clock. Tie
// the frame loop to the real setTimeout instead, so animations (and AnimatePresence exits) still
// finish while those tests run.
const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;
const FRAME_MS = 16;
// Server-side tests (`@vitest-environment node`, e.g. Astro components) have no window.
if (typeof window !== 'undefined') {
  const pendingFrames = new Set<number>();
  window.requestAnimationFrame = (callback) => {
    const handle = Number(
      realSetTimeout(() => {
        pendingFrames.delete(handle);
        callback(performance.now());
      }, FRAME_MS),
    );
    pendingFrames.add(handle);
    return handle;
  };
  window.cancelAnimationFrame = (handle) => {
    pendingFrames.delete(handle);
    realClearTimeout(handle);
  };
  // jsdom has no canvas: answer like a browser without WebGL instead of logging "Not
  // implemented". The live sky then keeps the CSS sky; tests that need a context stub their own.
  HTMLCanvasElement.prototype.getContext = () => null;
  // A frame still queued when the file ends (layout projection after the last unmount) would run
  // after jsdom is torn down and throw "document is not defined" outside any test.
  afterAll(() => {
    for (const handle of pendingFrames) realClearTimeout(handle);
    pendingFrames.clear();
  });
}

// Vitest globals are off, so Testing Library cannot register its own cleanup.
afterEach(cleanup);
