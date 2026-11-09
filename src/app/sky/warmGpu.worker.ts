// Retain the warmup context until the main thread has opened its context and terminates us.
let context: OffscreenRenderingContext | null = null;
try {
  context = new OffscreenCanvas(1, 1).getContext('webgl', { powerPreference: 'low-power' });
} catch {
  // OffscreenCanvas or WebGL may be unavailable; the normal CSS fallback still applies.
}
// Vite wraps this module in an IIFE; an event-handler closure keeps its context reachable.
self.addEventListener('message', () => context);
self.postMessage(context ? 'ready' : 'unavailable');
