import { fileURLToPath } from 'node:url';

export default {
  extends: 'lighthouse:default',
  artifacts: [
    {
      id: 'Accessibility',
      gatherer: fileURLToPath(new URL('./lighthouse-accessibility.mjs', import.meta.url)),
    },
  ],
};
