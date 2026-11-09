import { expect, test } from '@playwright/test';

const PAGES = ['/uv-index/', '/uv-risks/', '/sun-protection/', '/404.html'] as const;

for (const path of PAGES) {
  test(`${path}: no horizontal scroll at 320 px`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(path);
    await expect(page.locator('main#main')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(overflow).toBeLessThanOrEqual(320);
  });

  test(`${path}: the white pill button shows a focus ring on the sky`, async ({ page }) => {
    await page.goto(path);
    const pill = page.locator('main a.rounded-full.bg-white');
    await expect(pill).toHaveCount(1);
    await pill.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(pill).toBeFocused();
    // Ring: a white 2px outline, set off from the pill, on a dark halo so it reads on the sky.
    await expect(pill).toHaveCSS('outline-style', 'solid');
    await expect(pill).toHaveCSS('outline-width', '2px');
    await expect(pill).toHaveCSS('outline-offset', '2px');
    await expect(pill).toHaveCSS('outline-color', 'rgb(255, 255, 255)');
    await expect(pill).toHaveCSS('box-shadow', 'rgba(0, 0, 0, 0.35) 0px 0px 0px 4px');
  });
}

test('the UV scale rows are 44 px with a category label next to each colour dot', async ({
  page,
}) => {
  await page.goto('/uv-index/');
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(5);
  for (const row of await rows.all()) {
    expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(row.locator('td')).toHaveText(/\S/);
  }
});
