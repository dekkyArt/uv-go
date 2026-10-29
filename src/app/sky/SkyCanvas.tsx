import type { MotionValue } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SkyState } from '../../domain/sky';
import { glassTint, mixUniforms, skyUniforms } from '../../domain/skyUniforms';
import { createRenderer, type SkyRenderer } from './renderer';

interface Props {
  today: SkyState;
  tomorrow: SkyState;
  /** The pager's position: 0 is Today, 1 is Tomorrow. */
  progress: MotionValue<number>;
  reducedMotion: boolean;
}

/** Where the browser has no idle callback, the sky starts this long after mounting (spec 6.7). */
const IDLE_FALLBACK_MS = 200;

/** Runs `fn` once the page is idle, so the shader stays out of LCP and TBT. Returns a cancel. */
function whenIdle(fn: () => void): () => void {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(fn);
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(fn, IDLE_FALLBACK_MS);
  return () => clearTimeout(id);
}

const root = () => document.documentElement;

/** Back to the CSS sky: the phase backdrop shows again and the glass takes the phase values. */
function releasePage() {
  delete root().dataset.skyLive;
  root().style.removeProperty('--glass-rgb');
  root().style.removeProperty('--glass-alpha');
}

/**
 * The live sky (spec 6): a fixed WebGL canvas behind the page. It draws the blend of Today's and
 * Tomorrow's sky at the pager's position, so the sky follows a swipe, and tints the glass from the
 * day it settles on. It starts when the page is idle and fades in over the CSS backdrop after its
 * first frame. Without WebGL, or when the context is lost, the canvas goes and the CSS sky stays.
 */
export default function SkyCanvas({ today, tomorrow, progress, reducedMotion }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<SkyRenderer | null>(null);
  /** Sends the current target to the renderer; replaced whenever the inputs change. */
  const pushRef = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const from = useMemo(() => skyUniforms(today), [today]);
  const to = useMemo(() => skyUniforms(tomorrow), [tomorrow]);

  useEffect(() => {
    const push = () => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      // The spring that settles the pager can overshoot; mixUniforms would extrapolate.
      const t = Math.min(1, Math.max(0, progress.get()));
      const target = t === 0 ? from : t === 1 ? to : mixUniforms(from, to, t);
      renderer.setTarget(target);
      // The glass follows the day it lands on, not every frame of a swipe (its CSS fades it).
      if (t !== 0 && t !== 1) return;
      const { rgb, alpha } = glassTint(target);
      root().style.setProperty('--glass-rgb', rgb.join(' '));
      root().style.setProperty('--glass-alpha', String(alpha));
    };
    pushRef.current = push;
    push();
    return progress.on('change', push);
  }, [from, to, progress]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: SkyRenderer | null = null;
    let frame = 0;
    const drop = () => {
      renderer?.destroy();
      renderer = null;
      rendererRef.current = null;
      cancelAnimationFrame(frame);
      releasePage();
      setFailed(true);
    };
    const cancelIdle = whenIdle(() => {
      renderer = createRenderer(canvas, { reducedMotion, onLost: drop });
      if (!renderer) {
        drop();
        return;
      }
      rendererRef.current = renderer;
      pushRef.current();
      renderer.start();
      // The renderer's first frame is queued ahead of this one (or, reduced, already drawn).
      frame = requestAnimationFrame(() => {
        root().dataset.skyLive = '';
        setReady(true);
      });
    });
    return () => {
      cancelIdle();
      cancelAnimationFrame(frame);
      renderer?.destroy();
      rendererRef.current = null;
      releasePage();
    };
  }, [reducedMotion]);

  if (failed) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="sky-canvas"
      data-ready={ready ? '' : undefined}
    />
  );
}
