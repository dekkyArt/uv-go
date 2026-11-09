import { afterEach, expect, it, vi } from 'vitest';
import { skyUniforms } from '../../domain/skyUniforms';
import { createRenderer } from '../sky/renderer';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('renders through the worker without opening a WebGL context on the main thread', async () => {
  const worker = Object.assign(new EventTarget(), { postMessage: vi.fn(), terminate: vi.fn() });
  vi.stubGlobal(
    'Worker',
    class {
      constructor() {
        return worker;
      }
    },
  );
  const canvas = document.createElement('canvas');
  const offscreen = {};
  Object.defineProperty(canvas, 'transferControlToOffscreen', { value: () => offscreen });
  const getContext = vi.spyOn(canvas, 'getContext');
  const pending = createRenderer(canvas, { reducedMotion: true, onLost() {} });
  expect(worker.postMessage).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'init', canvas: offscreen }),
    [offscreen],
  );
  worker.dispatchEvent(new MessageEvent('message', { data: { type: 'ready' } }));
  const renderer = (await pending)!;
  const uniforms = skyUniforms({
    phase: 'day',
    weather: 'clear',
    uvGlow: 0.5,
    heat: false,
    wind: false,
    sunPosition: 0.5,
  });
  renderer.setTarget(uniforms);
  let drawn = false;
  const started = renderer.start();
  void Promise.resolve(started).then(() => {
    drawn = true;
  });
  await Promise.resolve();
  expect(drawn).toBe(false);
  worker.dispatchEvent(new MessageEvent('message', { data: { type: 'started' } }));
  await started;
  expect(drawn).toBe(true);
  expect(worker.postMessage).toHaveBeenCalledWith({ type: 'target', uniforms });
  expect(worker.postMessage).toHaveBeenCalledWith({ type: 'start' });
  expect(getContext).not.toHaveBeenCalled();
  renderer.destroy();
  expect(worker.terminate).toHaveBeenCalledOnce();
});

it.each(['error', 'timeout'])(
  'keeps the CSS fallback when worker startup ends in %s',
  async (failure) => {
    vi.useFakeTimers();
    const worker = Object.assign(new EventTarget(), { postMessage: vi.fn(), terminate: vi.fn() });
    vi.stubGlobal(
      'Worker',
      class {
        constructor() {
          return worker;
        }
      },
    );
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'transferControlToOffscreen', { value: () => ({}) });
    const getContext = vi.spyOn(canvas, 'getContext');
    const pending = createRenderer(canvas, { reducedMotion: false, onLost() {} });
    if (failure === 'timeout') await vi.advanceTimersByTimeAsync(8000);
    else worker.dispatchEvent(new Event('error'));
    expect(await pending).toBeNull();
    expect(getContext).not.toHaveBeenCalled();
    expect(worker.terminate).toHaveBeenCalledOnce();
  },
);

it('forwards size and visibility changes and releases all listeners after context loss', async () => {
  const worker = Object.assign(new EventTarget(), { postMessage: vi.fn(), terminate: vi.fn() });
  vi.stubGlobal(
    'Worker',
    class {
      constructor() {
        return worker;
      }
    },
  );
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'transferControlToOffscreen', { value: () => ({}) });
  Object.defineProperty(canvas, 'clientWidth', { value: 320 });
  Object.defineProperty(canvas, 'clientHeight', { value: 640 });
  const onLost = vi.fn();
  const pending = createRenderer(canvas, { reducedMotion: false, onLost });
  worker.dispatchEvent(new MessageEvent('message', { data: { type: 'ready' } }));
  const renderer = (await pending)!;
  window.dispatchEvent(new Event('resize'));
  expect(worker.postMessage).toHaveBeenCalledWith({ type: 'resize', width: 320, height: 640 });
  document.dispatchEvent(new Event('visibilitychange'));
  expect(worker.postMessage).toHaveBeenCalledWith({ type: 'visibility', hidden: document.hidden });
  renderer.setTopCap(0.75);
  expect(worker.postMessage).toHaveBeenCalledWith({ type: 'cap', value: 0.75 });
  worker.dispatchEvent(new MessageEvent('message', { data: { type: 'lost' } }));
  expect(onLost).toHaveBeenCalledOnce();
  expect(worker.terminate).toHaveBeenCalledOnce();
  worker.postMessage.mockClear();
  window.dispatchEvent(new Event('resize'));
  document.dispatchEvent(new Event('visibilitychange'));
  renderer.start();
  renderer.setTopCap(1);
  renderer.destroy();
  expect(worker.postMessage).not.toHaveBeenCalled();
  expect(worker.terminate).toHaveBeenCalledOnce();
});
