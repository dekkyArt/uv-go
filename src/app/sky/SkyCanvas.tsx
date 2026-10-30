import type { MotionValue } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SkyState } from '../../domain/sky';
import { glassTint, mixUniforms, skyUniforms } from '../../domain/skyUniforms';
import { createRenderer, type SkyRenderer } from './renderer';
import { whenIdle } from './whenIdle';

interface Props {
  today: SkyState;
  tomorrow: SkyState;
  /** The pager's position: 0 is Today, 1 is Tomorrow. */
  progress: MotionValue<number>;
  /** How far the pinned bar is shown, 0 to 1: the sun zone is capped under it. Absent: 0. */
  topCap?: MotionValue<number>;
  reducedMotion: boolean;
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
 * day it settles on. It starts when the page is idle, builds its shader without blocking, and
 * fades in over the CSS backdrop after its first frame. Without WebGL, or when the context is lost, the canvas goes and the CSS sky stays.
 */
export default function SkyCanvas({ today, tomorrow, progress, topCap, reducedMotion }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<SkyRenderer | null>(null);
  /** Send the current target and top cap to the renderer; replaced whenever the inputs change. */
  const pushRef = useRef<() => void>(() => {});
  const pushCapRef = useRef<() => void>(() => {});
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
    const push = () => rendererRef.current?.setTopCap(topCap?.get() ?? 0);
    pushCapRef.current = push;
    push();
    return topCap?.on('change', push);
  }, [topCap]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: SkyRenderer | null = null;
    let frame = 0;
    let disposed = false;
    const drop = () => {
      renderer?.destroy();
      renderer = null;
      rendererRef.current = null;
      cancelAnimationFrame(frame);
      releasePage();
      setFailed(true);
    };
    const cancelIdle = whenIdle(() => {
      void createRenderer(canvas, { reducedMotion, onLost: drop }).then((made) => {
        if (disposed) {
          made?.destroy();
          return;
        }
        renderer = made;
        if (!renderer) {
          drop();
          return;
        }
        rendererRef.current = renderer;
        pushRef.current();
        pushCapRef.current();
        renderer.start();
        // The renderer's first frame is queued ahead of this one (or, reduced, already drawn).
        frame = requestAnimationFrame(() => {
          root().dataset.skyLive = '';
          setReady(true);
        });
      });
    });
    return () => {
      disposed = true;
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
