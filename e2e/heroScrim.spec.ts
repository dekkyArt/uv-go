import { expect, test } from '@playwright/test';
import { STORED_LISBON, mockApis } from './mocks';

/**
 * The hero text sits straight on the sky over `.hero-scrim`: a flat 0.28 black over the hero box,
 * feathered to transparent only in the bleed around it (--scrim-x, --scrim-y). The contrast proof
 * in heroContrast.test.ts holds for text on the flat part, so every line has to lie inside the
 * scrim's inner rect: its box minus the bleed on each side. That does not depend on the column
 * width or on how tall the hero gets, so a wrapping city name is covered as well.
 */
const TOLERANCE = 1;

const LONG_NAME = 'Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch';
const PLACES = [
  { label: 'Lisbon', place: STORED_LISBON },
  {
    label: 'Llanfair',
    place: { id: 2643736, name: LONG_NAME, country: 'United Kingdom', lat: 53.22, lon: -4.2 },
  },
];

const VIEWPORTS = [
  { width: 320, height: 640 },
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
];

for (const { label, place } of PLACES) {
  for (const viewport of VIEWPORTS) {
    test(`hero text is inside the unfeathered scrim: ${label} at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await mockApis(page);
      await page.setViewportSize(viewport);
      await page.addInitScript((p) => {
        window.localStorage.setItem('uvgo:location', JSON.stringify(p));
      }, place);
      await page.goto('/');
      await expect(page.locator('[data-hero-time]')).toHaveText(/^\d{2}:00–\d{2}:00$/);
      await page.evaluate(() => document.fonts.ready);

      const { inner, lines, scrollWidth } = await page.evaluate(() => {
        const scrim = document.querySelector('.hero-scrim')!;
        const s = scrim.getBoundingClientRect();
        const style = getComputedStyle(scrim);
        const bx = parseFloat(style.getPropertyValue('--scrim-x'));
        const by = parseFloat(style.getPropertyValue('--scrim-y'));
        const content = scrim.nextElementSibling!;
        return {
          inner: { left: s.left + bx, right: s.right - bx, top: s.top + by, bottom: s.bottom - by },
          scrollWidth: document.documentElement.scrollWidth,
          lines: [...content.children].map((el) => {
            const r = el.getBoundingClientRect();
            return {
              text: (el.textContent ?? '').trim().slice(0, 24),
              left: r.left,
              right: r.right,
              top: r.top,
              bottom: r.bottom,
              visible: r.height > 0,
            };
          }),
        };
      });

      expect(lines.length).toBeGreaterThanOrEqual(6);
      expect(scrollWidth).toBeLessThanOrEqual(viewport.width);
      // How far outside the unfeathered rect the worst line reaches, in px (<= 0 is inside).
      let worst = -Infinity;
      for (const line of lines.filter((l) => l.visible)) {
        const out = Math.max(
          inner.left - line.left,
          line.right - inner.right,
          inner.top - line.top,
          line.bottom - inner.bottom,
        );
        worst = Math.max(worst, out);
        expect(out, `"${line.text}" is inside the unfeathered rect`).toBeLessThanOrEqual(TOLERANCE);
      }
      test.info().annotations.push({ type: 'worst overshoot (px)', description: worst.toFixed(1) });
    });
  }
}
