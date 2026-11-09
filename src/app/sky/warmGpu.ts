/**
 * A cold software GPU can block getContext() for seconds, even inside an idle callback.
 * Start it in a worker first, keeping that context alive until the visible one is open.
 * Unsupported workers (including CSP failures) fall back to the normal renderer path.
 */
export function warmGpu(): Promise<() => void> {
  const noop = () => {};
  if (typeof Worker === 'undefined') return Promise.resolve(noop);
  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./warmGpu.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      resolve(noop);
      return;
    }
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      worker.terminate();
    };
    const ready = () => {
      clearTimeout(timeout);
      worker.removeEventListener('message', ready);
      worker.removeEventListener('error', failed);
      resolve(release);
    };
    const failed = (event?: Event) => {
      event?.preventDefault();
      release();
      ready();
    };
    const timeout = setTimeout(failed, 8000);
    worker.addEventListener('message', ready);
    worker.addEventListener('error', failed);
  });
}
