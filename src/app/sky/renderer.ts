import { createDirectRenderer, type RendererHost, type SkyRenderer } from './rendererCore';
import { createWorkerRenderer } from './workerRenderer';

export { flashLevel, meanFrameMs, nextFlashDelay, nextQuality, smoothStep } from './rendererCore';
export type { Quality, SkyRenderer } from './rendererCore';

/** The DOM path is retained for browsers without transferable canvases or workers. */
export async function createRenderer(
  canvas: HTMLCanvasElement,
  opts: { reducedMotion: boolean; onLost(): void },
): Promise<SkyRenderer | null> {
  if (typeof Worker !== 'undefined' && typeof canvas.transferControlToOffscreen === 'function') {
    return createWorkerRenderer(canvas, opts);
  }
  const host: RendererHost = {
    size: () => ({ width: canvas.clientWidth, height: canvas.clientHeight }),
    hidden: () => document.hidden,
    onResize(callback) {
      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(callback);
        observer.observe(canvas);
        return () => observer.disconnect();
      }
      window.addEventListener('resize', callback);
      return () => window.removeEventListener('resize', callback);
    },
    onVisibility(callback) {
      document.addEventListener('visibilitychange', callback);
      return () => document.removeEventListener('visibilitychange', callback);
    },
  };
  return createDirectRenderer(canvas, opts, host);
}
