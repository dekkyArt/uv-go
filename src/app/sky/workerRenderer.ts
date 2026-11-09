import type { SkyRenderer } from './rendererCore';
import type { SkyCommand, SkyReply } from './workerProtocol';

/** All GL calls, including context creation and every frame, run away from the UI thread. */
export function createWorkerRenderer(
  canvas: HTMLCanvasElement,
  opts: { reducedMotion: boolean; onLost(): void },
): Promise<SkyRenderer | null> {
  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./renderer.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      resolve(null);
      return;
    }
    let disposed = false;
    let ready = false;
    let observer: ResizeObserver | null = null;
    let started: Promise<void> | null = null;
    let resolveStarted = () => {};
    const send = (message: SkyCommand) => {
      if (!disposed) worker.postMessage(message);
    };
    const resize = () =>
      send({ type: 'resize', width: canvas.clientWidth, height: canvas.clientHeight });
    const visibility = () => send({ type: 'visibility', hidden: document.hidden });
    const destroy = () => {
      if (disposed) return;
      disposed = true;
      clearTimeout(timeout);
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibility);
      worker.terminate();
      resolveStarted();
    };
    const fail = () => {
      if (disposed) return;
      destroy();
      if (ready) opts.onLost();
      else resolve(null);
    };
    const timeout = setTimeout(fail, 8000);
    const renderer: SkyRenderer = {
      setTarget: (uniforms) => send({ type: 'target', uniforms }),
      setTopCap: (value) => send({ type: 'cap', value }),
      start() {
        if (disposed) return Promise.resolve();
        if (!started)
          started = new Promise<void>((done) => {
            resolveStarted = done;
          });
        send({ type: 'start' });
        return started;
      },
      stop: () => send({ type: 'stop' }),
      destroy,
    };
    worker.addEventListener('error', (event) => {
      event.preventDefault();
      fail();
    });
    worker.addEventListener('message', (event: MessageEvent<SkyReply>) => {
      if (disposed) return;
      if (event.data.type === 'ready') {
        clearTimeout(timeout);
        ready = true;
        resolve(renderer);
      } else if (event.data.type === 'started') resolveStarted();
      else fail();
    });
    try {
      const offscreen = canvas.transferControlToOffscreen();
      const message: SkyCommand = {
        type: 'init',
        canvas: offscreen,
        width: canvas.clientWidth,
        height: canvas.clientHeight,
        hidden: document.hidden,
        reducedMotion: opts.reducedMotion,
      };
      worker.postMessage(message, [offscreen]);
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(resize);
        observer.observe(canvas);
      } else window.addEventListener('resize', resize);
      document.addEventListener('visibilitychange', visibility);
    } catch {
      fail();
    }
  });
}
