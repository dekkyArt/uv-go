import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const enabled = /^G-[A-Z0-9]+$/.test(process.env.PUBLIC_GA_MEASUREMENT_ID?.trim() ?? '');

test('optional analytics respects consent across pages and supports withdrawal', async ({
  page,
}) => {
  const requests: string[] = [];
  await page.route(
    /https:\/\/[^/]*(googletagmanager\.com|google-analytics\.com)\//,
    async (route) => {
      requests.push(route.request().url());
      // Exercise the integration without sending test visits to Google.
      await route.fulfill({ contentType: 'application/javascript', body: '' });
    },
  );
  await page.goto('/uv-index/');
  const banner = page.locator('[data-analytics-consent]');
  if (!enabled) {
    await expect(banner).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cookie settings' })).toHaveCount(0);
    expect(requests).toEqual([]);
    return;
  }
  await expect(banner).toBeVisible();
  expect(requests).toEqual([]);
  const { violations } = await new AxeBuilder({ page })
    .include('[data-analytics-consent]')
    .analyze();
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  await page.getByRole('button', { name: 'Reject analytics' }).click();
  await expect(banner).toBeHidden();
  await page.goto('/privacy/');
  await expect(banner).toBeHidden();
  expect(requests).toEqual([]);
  await page.getByRole('button', { name: 'Cookie settings' }).click();
  await expect(banner).toBeVisible();
  await page.getByRole('button', { name: 'Accept analytics' }).click();
  await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(1);
  await expect.poll(() => requests.length).toBe(1);
  await page.reload();
  await expect(banner).toBeHidden();
  await expect.poll(() => requests.length).toBe(2);
  await page.evaluate(() => {
    document.cookie = '_ga=test; path=/';
  });
  await page.getByRole('button', { name: 'Cookie settings' }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Reject analytics' }).click(),
  ]);
  await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(0);
  await expect(banner).toBeHidden();
  expect(requests).toHaveLength(2);
  expect((await page.context().cookies()).some((c) => c.name.startsWith('_ga'))).toBe(false);
});
