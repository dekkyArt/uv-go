/**
 * One-off generator for the static Open Graph images (spec 11.5). NOT part of the build:
 * run `node scripts/make-og.mjs` after changing a page title, then commit `public/og/*.png`.
 * Renders an HTML template (logo, page title, light-theme sky gradient and verdict colours from
 * `src/styles/global.css`) with Playwright's Chromium into 1200x630 PNGs.
 */
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const WIDTH = 1200;
const HEIGHT = 630;
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'og');

const pages = [
  { file: 'home', title: 'Best Time to Go Outside Today', kicker: 'UV & Weather Planner' },
  {
    file: 'uv-index',
    title: 'UV Index Explained: Scale, Colours and What Affects It',
    kicker: 'Guide',
  },
  { file: 'uv-risks', title: 'UV Exposure Risks: Sunburn, Skin Ageing and Eyes', kicker: 'Guide' },
  { file: 'sun-protection', title: 'How to Protect Yourself from UV', kicker: 'Guide' },
];

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const template = ({ title, kicker }) => `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body {
    width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; position: relative;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #101a2e;
    background: linear-gradient(180deg, #3d9bff 0%, #8ec8ff 55%, #dff0ff 100%);
  }
  .glow {
    position: absolute; right: -120px; top: -160px; width: 560px; height: 560px; border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 226, 140, 0.95) 0%, rgba(255, 226, 140, 0) 70%);
  }
  .panel {
    position: absolute; left: 64px; right: 64px; top: 64px; bottom: 64px; padding: 52px 56px;
    border-radius: 36px; background: rgba(255, 255, 255, 0.92);
    display: flex; flex-direction: column; justify-content: space-between;
  }
  .logo { display: flex; align-items: center; gap: 16px; font-size: 44px; font-weight: 800; letter-spacing: 0.02em; }
  .dot { width: 30px; height: 30px; border-radius: 50%; background: #b07400; }
  .kicker { font-size: 30px; font-weight: 700; color: #475569; margin-bottom: 14px; }
  h1 { font-size: 68px; line-height: 1.1; font-weight: 800; letter-spacing: -0.01em; max-width: 960px; }
  .bar { display: flex; gap: 12px; }
  .bar span { height: 14px; width: 120px; border-radius: 7px; }
</style></head><body>
  <div class="glow"></div>
  <div class="panel">
    <div class="logo"><span class="dot"></span>UV GO</div>
    <div><div class="kicker">${escapeHtml(kicker)}</div><h1>${escapeHtml(title)}</h1></div>
    <div class="bar"><span style="background:#15803d"></span><span style="background:#b07400"></span><span style="background:#dc2626"></span></div>
  </div>
</body></html>`;

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });
  for (const entry of pages) {
    await page.setContent(template(entry));
    const path = join(outDir, `${entry.file}.png`);
    await page.screenshot({
      path,
      type: 'png',
      clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
    });
    console.log(`wrote ${path}`);
  }
} finally {
  await browser.close();
}
