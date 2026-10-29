import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SkyState } from '../../domain/sky';
import { BASE_CLOUD_SPEED, skyUniforms, type SkyUniforms } from '../../domain/skyUniforms';
import {
  createRenderer,
  flashLevel,
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
    for (const name of ['uTime', 'uResolution', 'uFlash', 'uOctaves']) {
      expect(FRAGMENT_SRC).toMatch(new RegExp(`uniform [^;]*\\b${name};`));
    }
  });

  it('is GLSL ES 1.0 at mediump and shares the cloud speed constant', () => {
    expect(FRAGMENT_SRC).toContain('precision mediump float;');
    expect(FRAGMENT_SRC).toContain(`#define BASE_CLOUD_SPEED ${BASE_CLOUD_SPEED}`);
    expect(VERTEX_SRC).toContain('gl_Position');
  });
});

/** A WebGL context stand-in: every call succeeds; draws and uniform writes are recorded. */
function fakeGl(patch: Record<string, unknown> = {}) {
  const draws: Record<string, number>[] = [];
  let frame: Record<string, number> = {};
  const gl: Record<string, unknown> = {
    getUniformLocation: (_: unknown, name: string) => name,
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    uniform1f: (name: string, v: number) => (frame[name] = v),
    uniform1i: (name: string, v: number) => (frame[name] = v),
    drawArrays: () => {
      draws.push(frame);
      frame = {};
    },
    ...patch,
  };
  const proxy = new Proxy(gl, {
    get: (target, key) => (key in target ? target[key as string] : () => ({})),
  });
  return { gl: proxy, draws };
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

  it('returns null and warns once without WebGL', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(createRenderer(fakeCanvas(null), { reducedMotion: false, onLost() {} })).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('returns null and warns once when the shader does not compile', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { gl } = fakeGl({ getShaderParameter: () => false, getShaderInfoLog: () => 'ERROR' });
    expect(createRenderer(fakeCanvas(gl), { reducedMotion: false, onLost() {} })).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('under reduced motion draws one still frame per target, without particles or a loop', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    const { gl, draws } = fakeGl();
    const canvas = fakeCanvas(gl);
    const sky = createRenderer(canvas, { reducedMotion: true, onLost() {} })!;
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

  it('stops and reports a lost context', () => {
    const onLost = vi.fn();
    const { gl, draws } = fakeGl();
    const canvas = fakeCanvas(gl);
    const sky = createRenderer(canvas, { reducedMotion: true, onLost })!;
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
    const sky = createRenderer(fakeCanvas(gl), { reducedMotion: false, onLost() {} })!;
    sky.setTarget(RAIN);
    sky.start();
    await vi.waitFor(() => expect(draws.length).toBeGreaterThanOrEqual(2));
    sky.stop();
    expect(draws.at(-1)!.uRain).toBeCloseTo(RAIN.rain);
    sky.destroy();
  });
});
