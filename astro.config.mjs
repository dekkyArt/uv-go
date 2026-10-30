// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

import { siteConfig } from './src/site.config.ts';

/**
 * Drops the `//` comments from the GLSL in src/app/sky/shader.ts: they explain the shader in the
 * source but would ship in the sky chunk for nothing. GLSL has no string literals, so a comment
 * runs from `//` to the end of the line; the file's JavaScript uses only block comments.
 * @returns {import('vite').Plugin}
 */
function stripGlslComments() {
  return {
    name: 'uvgo:strip-glsl-comments',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('/src/app/sky/shader.ts')) return null;
      return {
        code: code.replace(/^[ \t]*\/\/.*\n/gm, '').replace(/[ \t]*\/\/.*$/gm, ''),
        map: null,
      };
    },
  };
}

// https://astro.build/config
export default defineConfig({
  output: 'static',
  site: siteConfig.site,
  integrations: [react(), mdx(), sitemap()],

  vite: {
    plugins: [tailwindcss(), stripGlslComments()],
  },
});
