import { expect, test } from '@playwright/test';
import { mockApis, searchLisbon } from './mocks';

const VERDICT = /Good|OK with protection|Not recommended/;
const TIME_RANGE = /\d{2}:00–\d{2}:00/;

test.describe('UV GO smoke', () => {
  test.beforeEach(async ({ page }) => {
    await mockApis(page);
  });

  test('happy path: search, result, duration change gives a new result', async ({ page }) => {
    await page.goto('/');
    await searchLisbon(page);

    await expect(page.getByText('Lisbon, Portugal').first()).toBeVisible();
    const result = page.getByText(TIME_RANGE).first();
    await expect(result).toBeVisible();
    await expect(page.getByText(VERDICT).first()).toBeVisible();
    const before = await result.innerText();

    await page.getByRole('radio', { name: '3 h' }).click();
    await expect(page.getByRole('radio', { name: '3 h' })).toBeChecked();
    await expect(page.getByText(TIME_RANGE).first()).not.toHaveText(before);
    // 3 h window: end minus start is 3 hours
    const after = await page.getByText(TIME_RANGE).first().innerText();
    const [start, end] = after
      .match(/\d{2}/g)!
      .filter((_, i) => i % 2 === 0)
      .map(Number);
    expect(end - start).toBe(3);
  });

  test('geolocation denied shows the fallback message', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      permissions: [],
    });
    // Headless Chromium may neither prompt nor deny: make the denial explicit.
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition: (_ok: unknown, fail: (e: { code: number }) => void) =>
            fail({ code: 1 }),
        },
      });
    });
    const page = await context.newPage();
    await mockApis(page);
    await page.goto('/');

    await page.getByRole('button', { name: 'Use my location' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /./ })).toHaveText(
      "Can't get your location. Search a city instead.",
    );
    await context.close();
  });

  test('theme persists after reload', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => localStorage.getItem('uvgo:theme'))).toBe('dark');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible();
  });
});
