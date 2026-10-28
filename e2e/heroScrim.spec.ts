import { expect, test } from '@playwright/test';
import { STORED_LISBON, mockApis } from './mocks';

/**
 * The hero text sits straight on the sky over `.hero-scrim`, a radial plateau: constant alpha out
 * to PLATEAU_END of the farthest-corner ellipse, a fade after it. Every corner of every text line
 * has to stay on the plateau, or the contrast proof in heroContrast.test.ts no longer covers it.
 * A wider hero column (the desktop container is 1200 px) moves the corners outwards.
 */
const PLATEAU_END = 0.72;

const VIEWPORTS = [
  { width: 320, height: 640 },
  { width: 390, height: 844 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
];

for (const viewport of VIEWPORTS) {
  test(`hero text stays on the scrim plateau at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await mockApis(page);
    await page.setViewportSize(viewport);
    await page.addInitScript((place) => {
      window.localStorage.setItem('uvgo:location', JSON.stringify(place));
    }, STORED_LISBON);
    await page.goto('/');
    await expect(page.locator('[data-hero-time]')).toHaveText(/^\d{2}:00–\d{2}:00$/);
    await page.evaluate(() => document.fonts.ready);

    const lines = await page.evaluate(() => {
      const scrim = document.querySelector('.hero-scrim')!;
      const s = scrim.getBoundingClientRect();
      const cx = s.left + s.width / 2;
      const cy = s.top + s.height / 2;
      const content = scrim.nextElementSibling!;
      return [...content.children].map((el) => {
        const r = el.getBoundingClientRect();
        // Where on the scrim's ellipse (0 at the centre, 1 at the farthest corner) the worst corner is.
        const t = Math.max(
          ...[r.left, r.right].flatMap((x) =>
            [r.top, r.bottom].map((y) => {
              const nx = (x - cx) / (s.width / 2);
              const ny = (y - cy) / (s.height / 2);
              return Math.hypot(nx, ny) / Math.SQRT2;
            }),
          ),
        );
        return { text: (el.textContent ?? '').trim().slice(0, 24), t, visible: r.height > 0 };
      });
    });

    expect(lines.length).toBeGreaterThanOrEqual(6);
    const worst = Math.max(...lines.filter((l) => l.visible).map((l) => l.t));
    test.info().annotations.push({ type: 'worst t', description: worst.toFixed(3) });
    for (const line of lines.filter((l) => l.visible)) {
      expect(line.t, `"${line.text}" is on the plateau`).toBeLessThanOrEqual(PLATEAU_END);
    }
  });
}
