import { expect, test, type Page } from '@playwright/test';
import { mockApis, searchLisbon } from './mocks';

const VERDICT = /Good|OK with protection|Not recommended/;
const TIME_RANGE = /^\d{2}:00–\d{2}:00$/;

const heroTime = (page: Page) => page.locator('[data-hero-time]');

/** The best time is one line that fits its box (it wraps after the dash when it is too big). */
async function expectOneLine(page: Page) {
  const box = await heroTime(page).evaluate((el) => ({
    height: el.getBoundingClientRect().height,
    fontSize: parseFloat(getComputedStyle(el).fontSize),
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(box.height).toBeLessThan(1.5 * box.fontSize);
  expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth);
}

/** Hours between the start and the end of a 'HH:00–HH:00' label. */
function windowHours(label: string): number {
  const [start, end] = label.split('–').map((t) => Number(t.slice(0, 2)));
  return end - start;
}

test.describe('UV GO smoke', () => {
  test.beforeEach(async ({ page }) => {
    await mockApis(page);
  });

  test('happy path: search, result, duration change gives a new result', async ({ page }) => {
    await page.goto('/');
    await searchLisbon(page);

    await expect(page.getByText('Lisbon', { exact: true })).toBeVisible();
    await expect(heroTime(page)).toHaveText(TIME_RANGE);
    await expect(page.getByText(VERDICT).first()).toBeVisible();
    const before = await heroTime(page).innerText();

    await page.getByRole('button', { name: 'Plan' }).click();
    const sheet = page.getByRole('dialog', { name: 'Plan' });
    await sheet.getByRole('radio', { name: '3 h' }).click();
    await expect(sheet.getByRole('radio', { name: '3 h' })).toBeChecked();
    await expect(heroTime(page)).not.toHaveText(before);
    // 3 h window: end minus start is 3 hours
    const after = await heroTime(page).innerText();
    expect(after).toMatch(TIME_RANGE);
    expect(windowHours(after)).toBe(3);
  });

  test('Escape closes the Plan sheet and returns focus to the Plan button', async ({ page }) => {
    await page.goto('/');
    await searchLisbon(page);
    await expect(heroTime(page)).toHaveText(TIME_RANGE);

    const plan = page.getByRole('button', { name: 'Plan' });
    await plan.click();
    await expect(page.getByRole('dialog', { name: 'Plan' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(plan).toBeFocused();
  });

  test('desktop: the Plan card is on the page, without a sheet', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await searchLisbon(page);
    await expect(heroTime(page)).toHaveText(TIME_RANGE);

    const plan = page.getByRole('region', { name: 'Plan' });
    await expect(plan).toBeVisible();
    await expect(page.getByRole('button', { name: 'Plan' })).toHaveCount(0);
    await expectOneLine(page);
    await plan.getByRole('radio', { name: '3 h' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(windowHours(await heroTime(page).innerText())).toBe(3);
  });

  test('320 px with a very long city name: no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'uvgo:location',
        JSON.stringify({
          id: 2643736,
          name: 'Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch',
          country: 'United Kingdom',
          lat: 53.22,
          lon: -4.2,
        }),
      );
    });
    await page.goto('/');
    await expect(heroTime(page)).toHaveText(TIME_RANGE);
    await expect(page.getByRole('region', { name: 'What to take' })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(overflow).toBeLessThanOrEqual(320);

    await expectOneLine(page);
    const time = await heroTime(page).boundingBox();
    expect(time).not.toBeNull();
    expect(time!.x).toBeGreaterThanOrEqual(0);
    expect(time!.y).toBeGreaterThanOrEqual(0);
    expect(time!.x + time!.width).toBeLessThanOrEqual(320);
    expect(time!.y + time!.height).toBeLessThanOrEqual(640);

    // The What to take tiles stay inside the page width.
    const tiles = page.getByRole('region', { name: 'What to take' }).getByRole('listitem');
    for (const box of await tiles.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, scrollWidth: el.scrollWidth, width: el.clientWidth };
      }),
    )) {
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(320);
      expect(box.scrollWidth).toBeLessThanOrEqual(box.width);
    }
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

    // The hero's button, on a first visit.
    await page.getByRole('button', { name: 'Use my location' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /./ })).toHaveText(
      "Can't get your location. Search a city instead.",
    );
    await context.close();
  });
});
