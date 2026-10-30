import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SkyState } from '../../domain/sky';
import { BASE_CLOUD_SPEED, skyUniforms, type SkyUniforms } from '../../domain/skyUniforms';
import {
  createRenderer,
  flashLevel,
  meanFrameMs,
  nextFlashDelay,
  nextQuality,
  smoothStep,
  type Quality,
} from '../sky/renderer';
import { FRAGMENT_SRC, VERTEX_SRC } from '../sky/shader';

const state = (patch: Partial<SkyState> = {}): SkyState => ({
  phase: 'day',
  weather: 'clear',
  uvGlow: 0.5,
  heat: false,
  wind: false,
  sunPosition: 0.5,
  ...patch,
});

const A = skyUniforms(state());
const B = skyUniforms(state({ phase: 'night', weather: 'thunder', wind: true, heat: true }));
const RAIN = skyUniforms(state({ weather: 'rain', heat: true }));

const uniformName = (key: string) => `u${key[0].toUpperCase()}${key.slice(1)}`;

describe('smoothStep', () => {
  it('stays put at dt = 0', () => {
    expect(smoothStep(A, B, 0)).toEqual(A);
  });

  it('arrives at the target after a long step', () => {
    const u = smoothStep(A, B, 10);
    for (const key of Object.keys(B) as (keyof SkyUniforms)[]) {
      const got = [u[key]].flat();
      [B[key]].flat().forEach((v, i) => expect(got[i]).toBeCloseTo(v, 3));
    }
  });

  it('covers about 63% of the gap in 0.4 s, on every field', () => {
    const u = smoothStep(A, B, 0.4);
    const share = (a: number, b: number, v: number) => (v - a) / (b - a);
    expect(share(A.cloudCover, B.cloudCover, u.cloudCover)).toBeCloseTo(1 - Math.exp(-1), 3);
    expect(share(A.skyTop[2], B.skyTop[2], u.skyTop[2])).toBeCloseTo(1 - Math.exp(-1), 3);
    expect(share(A.thunder, B.thunder, u.thunder)).toBeCloseTo(1 - Math.exp(-1), 3);
  });
});

describe('nextQuality', () => {
  const full: Quality = { scale: 0.5, octaves: 4, fps: 60 };

  it('drops the resolution first, then octaves and frame rate', () => {
    const first = nextQuality(full, 25);
    expect(first).toEqual({ scale: 0.35, octaves: 4, fps: 60 });
    expect(nextQuality(first, 25)).toEqual({ scale: 0.35, octaves: 2, fps: 30 });
  });

  it('shrugs off one stall but steps down on sustained slow frames', () => {
    const stalled = [...Array<number>(59).fill(16.7), 300];
    expect(nextQuality(full, meanFrameMs(stalled))).toBe(full);
    const slow = Array<number>(60).fill(25);
    expect(nextQuality(full, meanFrameMs(slow))).toEqual({ scale: 0.35, octaves: 4, fps: 60 });
  });

  it('keeps quality on fast frames and never goes back up', () => {
    expect(nextQuality(full, 10)).toBe(full);
    const low: Quality = { scale: 0.35, octaves: 2, fps: 30 };
    expect(nextQuality(low, 25)).toBe(low);
    expect(nextQuality(low, 5)).toBe(low);
  });
});

describe('thunder flashes', () => {
  it('waits 6 to 14 s between flashes', () => {
    expect(nextFlashDelay(() => 0)).toBe(6);
    expect(nextFlashDelay(() => 0.999)).toBeCloseTo(14, 1);
  });

  it('pulses 0 → 1 → 0 over 0.3 s', () => {
    expect(flashLevel(0)).toBe(0);
    expect(flashLevel(0.15)).toBeCloseTo(1, 5);
    expect(flashLevel(0.3)).toBe(0);
    expect(flashLevel(Infinity)).toBe(0);
  });
});

describe('shader sources', () => {
  it('declares a uniform for every SkyUniforms field except thunder', () => {
    for (const key of Object.keys(A).filter((k) => k !== 'thunder')) {
      expect(FRAGMENT_SRC).toMatch(new RegExp(`uniform [^;]*\\b${uniformName(key)};`));
    }
    expect(FRAGMENT_SRC).not.toMatch(/\buThunder\b/);
    for (const name of ['uTime', 'uResolution', 'uFlash', 'uOctaves', 'uTopCap']) {
      expect(FRAGMENT_SRC).toMatch(new RegExp(`uniform [^;]*\\b${name};`));
    }
  });

  it('ships without its comments (stripped at build time, astro.config.mjs)', () => {
    expect(FRAGMENT_SRC).not.toContain('//');
    expect(FRAGMENT_SRC).toContain('void main()');
  });

  it('is GLSL ES 1.0 at mediump and shares the cloud speed constant', () => {
    expect(FRAGMENT_SRC).toContain('precision mediump float;');
    expect(FRAGMENT_SRC).toContain(`#define BASE_CLOUD_SPEED ${BASE_CLOUD_SPEED}`);
    expect(VERTEX_SRC).toContain('gl_Position');
  });
});

/** COMPLETION_STATUS_KHR of KHR_parallel_shader_compile. */
const COMPLETION = 0x91b1;

/**
 * A WebGL context stand-in: every call succeeds and the shader build is done at once; draws and
 * uniform writes are recorded.
 */
function fakeGl(patch: Record<string, unknown> = {}) {
  const draws: Record<string, number>[] = [];
  const deleted: string[] = [];
  let frame: Record<string, number> = {};
  const set = (name: string, v: number) => (frame[name] = v);
  const gl: Record<string, unknown> = {
    getUniformLocation: (_: unknown, name: string) => name,
    getExtension: (name: string) =>
      name === 'KHR_parallel_shader_compile' ? { COMPLETION_STATUS_KHR: COMPLETION } : null,
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    deleteShader: () => deleted.push('shader'),
    deleteProgram: () => deleted.push('program'),
    uniform1f: set,
    uniform1i: set,
    uniform2f: set,
    uniform3f: set,
    drawArrays: () => {
      draws.push(frame);
      frame = {};
    },
    ...patch,
  };
  const proxy = new Proxy(gl, {
    get: (target, key) => (key in target ? target[key as string] : () => ({})),
  });
  return { gl: proxy, draws, deleted };
}

function fakeCanvas(gl: unknown) {
  const canvas = document.createElement('canvas');
  vi.spyOn(canvas, 'getContext').mockReturnValue(gl as WebGLRenderingContext);
  Object.defineProperty(canvas, 'clientWidth', { value: 390 });
  Object.defineProperty(canvas, 'clientHeight', { value: 844 });
  return canvas;
}

describe('createRenderer', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns null and warns once without WebGL', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(
      await createRenderer(fakeCanvas(null), { reducedMotion: false, onLost() {} }),
    ).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('returns null and warns once when the shader does not compile', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { gl, deleted } = fakeGl({
      getShaderParameter: () => false,
      getShaderInfoLog: () => 'ERROR',
    });
    expect(await createRenderer(fakeCanvas(gl), { reducedMotion: false, onLost() {} })).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(deleted.sort()).toEqual(['program', 'shader', 'shader']);
  });

  it('returns null, warns once and frees the program when it does not link', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { gl, deleted } = fakeGl({
      getProgramParameter: (_: unknown, pname: unknown) => pname === COMPLETION,
    });
    expect(await createRenderer(fakeCanvas(gl), { reducedMotion: false, onLost() {} })).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(deleted).toContain('program');
  });

  it('reads the build result only once the GPU says it is done, polling a frame at a time', async () => {
    const asked: string[] = [];
    let polls = 0;
    const { gl } = fakeGl({
      getProgramParameter: (_: unknown, pname: unknown) => {
        if (pname === COMPLETION) {
          asked.push('done?');
          return ++polls > 2;
        }
        asked.push('status');
        return true;
      },
      getShaderParameter: () => {
        asked.push('status');
        return true;
      },
    });
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    const sky = await createRenderer(fakeCanvas(gl), { reducedMotion: true, onLost() {} });
    expect(sky).not.toBeNull();
    // Asking for a status blocks until the GPU is done, so it only comes after "done".
    expect(asked).toEqual(['done?', 'done?', 'done?', 'status', 'status', 'status']);
    expect(raf).toHaveBeenCalledTimes(2);
    sky!.destroy();
  });

  it('without the parallel compile extension, reads the build result a frame later', async () => {
    const asked: string[] = [];
    const { gl } = fakeGl({
      getExtension: () => null,
      getProgramParameter: () => {
        asked.push('status');
        return true;
      },
      getShaderParameter: () => {
        asked.push('status');
        return true;
      },
    });
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      asked.push('frame');
      return window.setTimeout(() => cb(0), 0);
    });
    const sky = await createRenderer(fakeCanvas(gl), { reducedMotion: true, onLost() {} });
    expect(asked).toEqual(['frame', 'status', 'status', 'status']);
    sky!.destroy();
  });

  it('uploads every SkyUniforms field except thunder on each draw', async () => {
    const { gl, draws } = fakeGl();
    const sky = (await createRenderer(fakeCanvas(gl), { reducedMotion: true, onLost() {} }))!;
    sky.setTarget(A);
    sky.start();
    sky.setTarget(B);
    const expected = Object.keys(A)
      .filter((k) => k !== 'thunder')
      .map(uniformName);
    expect(draws).toHaveLength(2);
    for (const draw of draws) {
      for (const name of [...expected, 'uTime', 'uResolution', 'uFlash', 'uOctaves', 'uTopCap']) {
        expect(draw, name).toHaveProperty(name);
      }
    }
    sky.destroy();
  });

  it('under reduced motion draws one still frame per target, without particles or a loop', async () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    const { gl, draws } = fakeGl();
    const canvas = fakeCanvas(gl);
    const sky = (await createRenderer(canvas, { reducedMotion: true, onLost() {} }))!;
    sky.setTarget(RAIN);
    expect(draws).toHaveLength(0);
    sky.start();
    sky.start();
    expect(draws).toHaveLength(1);
    expect(draws[0]).toMatchObject({ uRain: 0, uSnow: 0, uGlassDrops: 0, uHeat: 0, uFlash: 0 });
    expect(draws[0].uCloudCover).toBeCloseTo(RAIN.cloudCover);
    sky.setTarget(B);
    expect(draws).toHaveLength(2);
    expect(draws[1].uCloudCover).toBeCloseTo(B.cloudCover);
    expect(raf).not.toHaveBeenCalled();
    expect(canvas.width).toBe(195);
    sky.destroy();
  });

  it('sets the top cap at once, clamped, and redraws a still frame for it', async () => {
    const { gl, draws } = fakeGl();
    const sky = (await createRenderer(fakeCanvas(gl), { reducedMotion: true, onLost() {} }))!;
    sky.setTarget(A);
    sky.start();
    expect(draws.at(-1)!.uTopCap).toBe(0);
    sky.setTopCap(0.4);
    expect(draws).toHaveLength(2);
    expect(draws.at(-1)!.uTopCap).toBe(0.4);
    sky.setTopCap(1.3);
    expect(draws.at(-1)!.uTopCap).toBe(1);
    // The same value again draws nothing new.
    sky.setTopCap(1);
    expect(draws).toHaveLength(3);
    sky.destroy();
  });

  it('stops and reports a lost context', async () => {
    const onLost = vi.fn();
    const { gl, draws } = fakeGl();
    const canvas = fakeCanvas(gl);
    const sky = (await createRenderer(canvas, { reducedMotion: true, onLost }))!;
    sky.setTarget(A);
    sky.start();
    canvas.dispatchEvent(new Event('webglcontextlost'));
    expect(onLost).toHaveBeenCalledTimes(1);
    sky.setTarget(B);
    expect(draws).toHaveLength(1);
    sky.destroy();
  });

  it('animates with particles on when motion is allowed', async () => {
    const { gl, draws } = fakeGl();
    const sky = (await createRenderer(fakeCanvas(gl), { reducedMotion: false, onLost() {} }))!;
    sky.setTarget(RAIN);
    sky.start();
    await vi.waitFor(() => expect(draws.length).toBeGreaterThanOrEqual(2));
    sky.stop();
    expect(draws.at(-1)!.uRain).toBeCloseTo(RAIN.rain);
    sky.destroy();
  });
});
