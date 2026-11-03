import { expect, test } from '@playwright/test';
import { STORED_LISBON, mockApis } from './mocks';

/**
 * The hero text sits straight on the sky, with no plate: the small lines read against the black rim
 * of `.sky-text`, which heroContrast.test.ts proves over every worst-case sky. Here, in a real
 * browser, every line must carry that rim (nothing inside the hero sets its own text-shadow), and
 * a long city name must wrap rather than run past the screen.
 */
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
  { width: 390, height: 844 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];

/** Computed form of the rim: one unblurred copy per side in black at 0.3. */
const RIM = ['1px 0px 0px', '-1px 0px 0px', '0px 1px 0px', '0px -1px 0px'].map(
  (offset) => `rgba(0, 0, 0, 0.3) ${offset}`,
);

for (const { label, place } of PLACES) {
  for (const viewport of VIEWPORTS) {
    test(`hero text carries the rim and stays on screen: ${label} at ${viewport.width}x${viewport.height}`, async ({
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

      const { lines, scrollWidth } = await page.evaluate(() => {
        const content = document.querySelector('[data-hero-time]')!.closest('.\\@container')!;
        return {
          scrollWidth: document.documentElement.scrollWidth,
          lines: [...content.querySelectorAll('h1, p')].map((el) => {
            const r = el.getBoundingClientRect();
            return {
              text: (el.textContent ?? '').trim().slice(0, 24),
              left: r.left,
              right: r.right,
              shadow: getComputedStyle(el).textShadow,
            };
          }),
        };
      });

      expect(lines.length).toBeGreaterThanOrEqual(6);
      expect(scrollWidth).toBeLessThanOrEqual(viewport.width);
      for (const line of lines) {
        for (const layer of RIM) expect(line.shadow, `"${line.text}" rim`).toContain(layer);
        expect(line.left, `"${line.text}" left`).toBeGreaterThanOrEqual(0);
        expect(line.right, `"${line.text}" right`).toBeLessThanOrEqual(viewport.width);
      }
    });
  }
}
