import { expect, test } from '@playwright/test';
import { mockApis } from './mocks';

// System font metrics differ between macOS and Linux. Include the bundled fallback and a
// wider font so the narrow layout is also exercised on a Mac development machine.
for (const font of [null, '"Inter Variable", sans-serif', 'Verdana, system-ui']) {
  for (const width of [320, 360, 375, 390, 430, 768, 1280]) {
    test(`main navigation stays beside the logo at ${width}px with ${font ?? 'the system font'}`, async ({
      page,
    }) => {
      await mockApis(page);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height: 844 });

      for (const path of ['/', '/uv-index/']) {
        await page.goto(path);
        if (font) await page.addStyleTag({ content: `header { font-family: ${font}; }` });
        await page.evaluate(() => document.fonts.ready);
        const logo = page.locator('[data-logo-link]');
        const navigation = page.getByRole('navigation', { name: 'Main', exact: true });
        await expect(logo).toBeVisible();
        await expect(navigation).toBeVisible();
        const brand = (await logo.boundingBox())!;
        const menu = (await navigation.boundingBox())!;

        expect(menu.x).toBeGreaterThanOrEqual(brand.x + brand.width);
        expect(Math.abs(menu.y + menu.height / 2 - brand.y - brand.height / 2)).toBeLessThan(1);
        expect(menu.x + menu.width).toBeLessThanOrEqual(width - (width < 375 ? 8 : 16));
        for (const link of await navigation.getByRole('link').all()) {
          const bounds = (await link.boundingBox())!;
          expect(bounds.height).toBeGreaterThanOrEqual(44);
          expect(bounds.width).toBeGreaterThanOrEqual(44);
          expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
        }
      }
    });
  }
}
