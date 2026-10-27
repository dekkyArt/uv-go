import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom drives requestAnimationFrame with setInterval, which tests fake to move the clock. Tie
// the frame loop to the real setTimeout instead, so animations (and AnimatePresence exits) still
// finish while those tests run.
const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;
const FRAME_MS = 16;
// Server-side tests (`@vitest-environment node`, e.g. Astro components) have no window.
if (typeof window !== 'undefined') {
  window.requestAnimationFrame = (callback) =>
    Number(realSetTimeout(() => callback(performance.now()), FRAME_MS));
  window.cancelAnimationFrame = (handle) => realClearTimeout(handle);
}

// Vitest globals are off, so Testing Library cannot register its own cleanup.
afterEach(cleanup);
