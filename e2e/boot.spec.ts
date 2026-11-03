import { expect, test, type Page } from '@playwright/test';
import { FIXED_NOW, STORED_LISBON, mockApis } from './mocks';

const TIME_RANGE = /^\d{2}:00–\d{2}:00$/;

/** Records every layout shift from the first paint on. */
async function recordShifts(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __shifts: number[] };
    w.__shifts = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__shifts.push((e as unknown as { value: number }).value);
    }).observe({ type: 'layout-shift', buffered: true });
  });
}

/** Lisbon stored, and the forecast held back until `release()` is called. */
async function storedPlaceWithHeldForecast(page: Page) {
  await mockApis(page);
  let release!: () => void;
  const released = new Promise<void>((r) => (release = r));
  await page.route('**/api.open-meteo.com/**', async (route) => {
    await released;
    await route.fallback();
  });
  await page.addInitScript((p) => {
    window.localStorage.setItem('uvgo:location', JSON.stringify(p));
  }, STORED_LISBON);
  return release;
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
]) {
  test(`${viewport.width}px: the splash holds the screen until the result, and nothing on the page moves`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await recordShifts(page);
    const release = await storedPlaceWithHeldForecast(page);
    await page.goto('/');

    // The app is up and loading, but only the sky and the splash are on screen, and the splash
    // is what assistive technology finds.
    await expect(page.locator('[data-hero-time]')).toBeAttached();
    await expect(page.locator('html')).toHaveAttribute('data-boot', 'on');
    await expect(page.getByRole('status')).toHaveText(/^Lisbon\s*Loading forecast$/);
    await expect(page.locator('.boot-splash')).toBeVisible();
    await expect(page.locator('main h1')).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'App' })).toBeHidden();

    release();
    await expect(page.locator('[data-hero-time]')).toHaveText(TIME_RANGE);
    await expect(page.locator('html')).not.toHaveAttribute('data-boot');
    await expect(page.locator('.boot-splash')).toBeHidden();
    await expect(page.locator('main h1')).toBeVisible();

    const shifts = await page.evaluate(
      () => (window as unknown as { __shifts: number[] }).__shifts,
    );
    expect(shifts.reduce((a, b) => a + b, 0)).toBe(0);
  });
}

test('a failed forecast ends the splash with the error and its retry', async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  await page.route('**/api.open-meteo.com/**', (route) => route.fulfill({ status: 500 }));
  await page.addInitScript((p) => {
    window.localStorage.setItem('uvgo:location', JSON.stringify(p));
  }, STORED_LISBON);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.locator('html')).not.toHaveAttribute('data-boot');
});

test('a first visit has nothing to load and gets no splash', async ({ page }) => {
  await mockApis(page);
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.locator('html')).not.toHaveAttribute('data-boot');
  await expect(page.locator('.boot-splash')).toBeHidden();
});
