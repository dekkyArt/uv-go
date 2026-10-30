import { mixUniforms, type SkyUniforms } from '../../domain/skyUniforms';
import { FRAGMENT_SRC, VERTEX_SRC } from './shader';

export type Quality = { scale: 0.5 | 0.35; octaves: 4 | 2; fps: 60 | 30 };

export interface SkyRenderer {
  setTarget(u: SkyUniforms): void;
  /**
   * How far the pinned bar is shown, 0 to 1 (`uTopCap`). Applied at once, not eased like the
   * target: the sun zone must be capped by the time the bar is there.
   */
  setTopCap(v: number): void;
  start(): void;
  stop(): void;
  destroy(): void;
}

/** Time constant of the pull towards the target (spec 6.5): ~1.2 s to arrive. */
const EASE_S = 0.4;
/** Average frame interval over which quality steps down (spec 6.7). */
const SLOW_FRAME_MS = 20;
const FRAME_WINDOW = 60;
const FLASH_S = 0.3;
/** `uTime` wraps here so its fractions stay precise; only particles and twinkle follow it. */
const TIME_WRAP_S = 1000;
/** Cloud travel wraps here: hours of wind before one jump. */
const DRIFT_WRAP = 1000;
/** A long frame (tab switch, hitch) moves the sky as if it took this long. */
const MAX_DT_S = 0.1;

type Scalar = Exclude<
  { [K in keyof SkyUniforms]: SkyUniforms[K] extends number ? K : never }[keyof SkyUniforms],
  'thunder'
>;
const SCALARS: readonly Scalar[] = [
  'sunIntensity',
  'moon',
  'stars',
  'cloudCover',
  'cloudDark',
  'cloudSpeed',
  'fog',
  'rain',
  'snow',
  'glassDrops',
  'heat',
  'maxLuma',
  'sunZone',
];
/** Moving layers, left out of the still frame under reduced motion (with the flash). */
const PARTICLES: ReadonlySet<Scalar> = new Set(['rain', 'snow', 'glassDrops', 'heat']);
const uniformName = (k: Scalar) => `u${k[0].toUpperCase()}${k.slice(1)}`;

/** Pulls `cur` towards `target` by the share an exponential ease covers in `dt` seconds. */
export const smoothStep = (cur: SkyUniforms, target: SkyUniforms, dt: number): SkyUniforms =>
  mixUniforms(cur, target, 1 - Math.exp(-dt / EASE_S));

/** One step down on slow frames: resolution first, then octaves with 30 fps. Never back up. */
export function nextQuality(q: Quality, avgFrameMs: number): Quality {
  if (avgFrameMs <= SLOW_FRAME_MS) return q;
  if (q.scale === 0.5) return { ...q, scale: 0.35 };
  if (q.octaves === 4) return { scale: 0.35, octaves: 2, fps: 30 };
  return q;
}

/** Seconds until the next lightning flash: 6–14. */
export const nextFlashDelay = (rand: () => number): number => 6 + 8 * rand();

/**
 * Mean frame interval for the quality check. Each interval counts at most MAX_DT_S, so one stall
 * (GC, hydration) cannot drag a fast device down for good; sustained slowness still shows.
 */
export const meanFrameMs = (intervals: readonly number[]): number =>
  intervals.reduce((sum, ms) => sum + Math.min(ms, MAX_DT_S * 1000), 0) / intervals.length;

/** Flash brightness `age` seconds into a pulse: 0 → 1 → 0 over 0.3 s. */
export const flashLevel = (age: number): number =>
  age > 0 && age < FLASH_S ? Math.sin((Math.PI * age) / FLASH_S) : 0;

/**
 * Builds the program without blocking the main thread. Asking for a compile or link status waits
 * for the GPU to finish, which took close to a second on a software GPU, so the status is only
 * read once the work is done: KHR_parallel_shader_compile says when without waiting; without it,
 * the status is read a frame later, after the GPU process has had that frame to work.
 */
async function program(gl: WebGLRenderingContext): Promise<WebGLProgram | string> {
  const vs = gl.createShader(gl.VERTEX_SHADER);
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  const prog = gl.createProgram();
  const fail = (why: string) => {
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    gl.deleteProgram(prog);
    return why;
  };
  if (!vs || !fs || !prog) return fail('could not create the program');
  const shaders = [
    [vs, VERTEX_SRC],
    [fs, FRAGMENT_SRC],
  ] as const;
  for (const [s, src] of shaders) {
    gl.shaderSource(s, src);
    gl.compileShader(s);
  }
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.bindAttribLocation(prog, 0, 'aPos');
  gl.linkProgram(prog);

  const parallel = gl.getExtension('KHR_parallel_shader_compile');
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  if (parallel) {
    while (!gl.getProgramParameter(prog, parallel.COMPLETION_STATUS_KHR)) await nextFrame();
  } else {
    await nextFrame();
  }

  for (const [s] of shaders)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      return fail(`compile: ${gl.getShaderInfoLog(s)}`);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
    return fail(`link: ${gl.getProgramInfoLog(prog)}`);
  // Flagged for deletion: freed together with the program.
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return prog;
}

/**
 * Draws the sky into `canvas` at a fraction of its CSS size. Resolves once the shader is built,
 * to null (after one `console.warn`) when there is no WebGL or the shader fails to build.
 */
export async function createRenderer(
  canvas: HTMLCanvasElement,
  opts: { reducedMotion: boolean; onLost(): void },
): Promise<SkyRenderer | null> {
  const context = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
  });
  if (!context) {
    console.warn('Sky: WebGL is unavailable, keeping the CSS sky.');
    return null;
  }
  const gl = context;
  const prog = await program(gl);
  if (typeof prog === 'string') {
    console.warn(`Sky: shader failed, keeping the CSS sky. ${prog}`);
    return null;
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.useProgram(prog);
  const at = (name: string) => gl.getUniformLocation(prog, name);
  const loc = {
    time: at('uTime'),
    drift: at('uDrift'),
    resolution: at('uResolution'),
    skyTop: at('uSkyTop'),
    skyBottom: at('uSkyBottom'),
    sunPos: at('uSunPos'),
    flash: at('uFlash'),
    octaves: at('uOctaves'),
    topCap: at('uTopCap'),
  };
  const scalarLocs = SCALARS.map((k) => [k, at(uniformName(k))] as const);

  let target: SkyUniforms | null = null;
  let cur: SkyUniforms | null = null;
  let topCap = 0;
  let quality: Quality = { scale: 0.5, octaves: 4, fps: 60 };
  let running = false;
  let lost = false;
  let destroyed = false;
  let raf = 0;
  let lastFrame = 0;
  let frameMs: number[] = [];
  let time = 0;
  let drift = 0;
  let flashIn = nextFlashDelay(Math.random);
  let flashAge = Infinity;
  let cssW = 0;
  let cssH = 0;

  const measure = () => {
    cssW = canvas.clientWidth;
    cssH = canvas.clientHeight;
  };

  function draw(u: SkyUniforms, motion: boolean) {
    if (!cssW || !cssH) return;
    const w = Math.max(1, Math.round(cssW * quality.scale));
    const h = Math.max(1, Math.round(cssH * quality.scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.uniform1f(loc.time, time);
    gl.uniform1f(loc.drift, drift);
    gl.uniform2f(loc.resolution, w, h);
    // Rgb is 0–255; GL wants 0–1.
    gl.uniform3f(loc.skyTop, u.skyTop[0] / 255, u.skyTop[1] / 255, u.skyTop[2] / 255);
    gl.uniform3f(loc.skyBottom, u.skyBottom[0] / 255, u.skyBottom[1] / 255, u.skyBottom[2] / 255);
    gl.uniform2f(loc.sunPos, u.sunPos[0], u.sunPos[1]);
    for (const [k, l] of scalarLocs) gl.uniform1f(l, motion || !PARTICLES.has(k) ? u[k] : 0);
    gl.uniform1f(loc.flash, motion ? flashLevel(flashAge) : 0);
    gl.uniform1i(loc.octaves, quality.octaves);
    gl.uniform1f(loc.topCap, topCap);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Reduced motion: the finished transition, frozen, without particles. */
  function still() {
    if (!target) return;
    cur = target;
    draw(cur, false);
  }

  function tick(now: number) {
    raf = requestAnimationFrame(tick);
    const ms = lastFrame ? now - lastFrame : 0;
    if (quality.fps === 30 && ms && ms < 1000 / 30 - 4) return;
    lastFrame = now;
    if (!target) return;
    const dt = Math.min(ms / 1000, MAX_DT_S);
    cur = cur ? smoothStep(cur, target, dt) : target;
    time = (time + dt) % TIME_WRAP_S;
    drift = (drift + cur.cloudSpeed * dt) % DRIFT_WRAP;
    flashAge += dt;
    if (cur.thunder > 0.5 && (flashIn -= dt) <= 0) {
      flashAge = 0;
      flashIn = nextFlashDelay(Math.random);
    }
    draw(cur, true);
    if (ms) sample(ms);
  }

  function sample(ms: number) {
    frameMs.push(ms);
    if (frameMs.length > FRAME_WINDOW) frameMs.shift();
    if (frameMs.length < FRAME_WINDOW) return;
    const next = nextQuality(quality, meanFrameMs(frameMs));
    if (next !== quality) {
      quality = next;
      frameMs = [];
    }
  }

  const loop = () => {
    lastFrame = 0;
    raf = requestAnimationFrame(tick);
  };
  const halt = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };
  const stop = () => {
    running = false;
    halt();
  };

  const onVisibility = () => {
    if (!running || opts.reducedMotion) return;
    if (document.hidden) halt();
    else if (!raf) loop();
  };
  const onResize = () => {
    measure();
    if (running && opts.reducedMotion) still();
  };
  const onLost = () => {
    stop();
    lost = true;
    opts.onLost();
  };
  const resizeObserver =
    typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onResize);
  if (resizeObserver) resizeObserver.observe(canvas);
  else window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('webglcontextlost', onLost);

  return {
    setTarget(u) {
      if (lost || destroyed) return;
      target = u;
      if (running && opts.reducedMotion) still();
    },
    setTopCap(v) {
      const next = Math.min(1, Math.max(0, v));
      if (next === topCap) return;
      topCap = next;
      if (running && opts.reducedMotion && !lost && !destroyed) still();
    },
    start() {
      if (running || lost || destroyed) return;
      running = true;
      measure();
      if (opts.reducedMotion) still();
      else if (!document.hidden) loop();
    },
    stop,
    destroy() {
      if (destroyed) return;
      stop();
      destroyed = true;
      resizeObserver?.disconnect();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onLost);
      if (!lost) {
        gl.deleteBuffer(buffer);
        gl.deleteProgram(prog);
      }
    },
  };
}
