import { expect, test } from '@playwright/test';
import { mockApis, STORED_LISBON } from './mocks';

for (const sheet of ['Plan', 'Cities']) {
  test(`${sheet}: locks background scrolling and restores it on close`, async ({ page }) => {
    // A short phone viewport also exercises scrolling inside the Plan sheet.
    await page.setViewportSize({ width: 390, height: 560 });
    await mockApis(page);
    await page.addInitScript((place) => {
      localStorage.setItem('uvgo:location', JSON.stringify(place));
    }, STORED_LISBON);
    await page.goto('/');
    await expect(page.locator('[data-hero-time]')).toHaveText(/^\d{2}:00–\d{2}:00$/);
    await page.evaluate(() => window.scrollTo(0, 350));
    const before = await page.evaluate(() => window.scrollY);
    expect(before).toBeGreaterThan(0);

    await page.getByRole('button', { name: sheet, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: sheet });
    await expect(dialog).toBeVisible();
    await page.mouse.move(10, 10);
    await page.mouse.wheel(0, 250);
    // Wheel events are handled asynchronously by the browser's compositor.
    await page.waitForTimeout(350);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);

    // A swipe beginning on the backdrop must not pan the underlying page either.
    const touch = await page.context().newCDPSession(page);
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: 10, y: 10 }],
    });
    for (const y of [60, 120, 180, 240]) {
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: 10, y }],
      });
    }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(350);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
    await touch.detach();

    if (sheet === 'Plan') {
      const content = dialog.locator('.overflow-y-auto');
      await content.hover();
      await page.mouse.wheel(0, 250);
      await expect.poll(() => content.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      expect(await page.evaluate(() => window.scrollY)).toBe(before);
    }

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
    await page.mouse.move(10, 10);
    await page.mouse.wheel(0, 250);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
  });
}
