import { createDirectRenderer, type RendererHost, type SkyRenderer } from './rendererCore';
import type { SkyCommand, SkyReply } from './workerProtocol';

let renderer: SkyRenderer | null = null;
let width = 0;
let height = 0;
let hidden = false;
let reducedMotion = false;
let resized = () => {};
let visibilityChanged = () => {};
const reply = (message: SkyReply) => self.postMessage(message);
const host: RendererHost = {
  size: () => ({ width, height }),
  hidden: () => hidden,
  onResize(callback) {
    resized = callback;
    return () => {
      resized = () => {};
    };
  },
  onVisibility(callback) {
    visibilityChanged = callback;
    return () => {
      visibilityChanged = () => {};
    };
  },
};

self.addEventListener('message', async (event: MessageEvent<SkyCommand>) => {
  const message = event.data;
  try {
    switch (message.type) {
      case 'init':
        width = message.width;
        height = message.height;
        hidden = message.hidden;
        reducedMotion = message.reducedMotion;
        renderer = await createDirectRenderer(
          message.canvas,
          {
            reducedMotion,
            onLost: () => reply({ type: 'lost' }),
          },
          host,
        );
        reply({ type: renderer ? 'ready' : 'failed' });
        break;
      case 'target':
        renderer?.setTarget(message.uniforms);
        break;
      case 'cap':
        renderer?.setTopCap(message.value);
        break;
      case 'resize':
        width = message.width;
        height = message.height;
        resized();
        break;
      case 'visibility':
        hidden = message.hidden;
        visibilityChanged();
        break;
      case 'start':
        renderer?.start();
        // Acknowledgement follows the renderer's first draw, including under reduced motion.
        if (reducedMotion) reply({ type: 'started' });
        else requestAnimationFrame(() => reply({ type: 'started' }));
        break;
      case 'stop':
        renderer?.stop();
        break;
    }
  } catch {
    reply({ type: 'failed' });
  }
});
