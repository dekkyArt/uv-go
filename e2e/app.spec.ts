import { expect, test, type Browser, type Page } from '@playwright/test';
import { STORED_LISBON, mockApis, searchLisbon } from './mocks';

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

const DESKTOP = { width: 1280, height: 800 };

/**
 * Warnings and errors that concern the sky. Headless Chromium composites in software and reads
 * the WebGL canvas back every frame, which its GL driver reports as a performance message; that
 * comes from the test browser, not from the page, and is left out.
 */
function skyConsole(page: Page): string[] {
  const seen: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'warning' && msg.type() !== 'error') return;
    const text = msg.text();
    if (/GL Driver Message .*GPU stall due to ReadPixels/.test(text)) return;
    if (/sky|webgl|shader/i.test(text)) seen.push(text);
  });
  return seen;
}

/** Page top of How it works and the H1's left edge, once the fonts have settled. */
async function layoutMarks(page: Page): Promise<{ how: number; h1Left: number }> {
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(() => ({
    how: document.querySelector('#how-it-works')!.getBoundingClientRect().top + window.scrollY,
    h1Left: document.querySelector('h1')!.getBoundingClientRect().left,
  }));
}

/**
 * The server placeholder as the browser paints it before hydration: the app's scripts are
 * blocked, the inline reserveLayout script still runs.
 */
async function placeholderMarks(browser: Browser, storage: Record<string, unknown>) {
  const context = await browser.newContext({ viewport: DESKTOP });
  await context.addInitScript((items) => {
    for (const [key, value] of Object.entries(items))
      window.localStorage.setItem(key, JSON.stringify(value));
  }, storage);
  const page = await context.newPage();
  await page.route(/\.js$/, (route) => route.abort());
  await page.goto('/');
  const marks = await layoutMarks(page);
  await context.close();
  return marks;
}

test.describe('UV GO smoke', () => {
  test.beforeEach(async ({ page }) => {
    await mockApis(page);
  });

  test('happy path: search, result, duration change gives a new result', async ({ page }) => {
    await page.goto('/');
    await searchLisbon(page);

    // The hero's title; the pinned bar (aria-hidden) repeats the name in a span.
    await expect(page.locator('p', { hasText: /^Lisbon$/ })).toBeVisible();
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

  test('desktop first visit: nothing below the app moves when it mounts', async ({
    page,
    browser,
  }) => {
    const before = await placeholderMarks(browser, {});
    await page.setViewportSize(DESKTOP);
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Plan' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Find a city' })).toBeVisible();
    const after = await layoutMarks(page);
    expect(Math.abs(after.how - before.how)).toBeLessThanOrEqual(2);
    // The hero is left-aligned on desktop, in the placeholder too: the H1 does not slide sideways.
    expect(Math.abs(after.h1Left - before.h1Left)).toBeLessThanOrEqual(1);
  });

  test('desktop with a stored place: nothing below the app moves from placeholder to result', async ({
    page,
    browser,
  }) => {
    const storage = { 'uvgo:location': STORED_LISBON };
    const before = await placeholderMarks(browser, storage);
    await page.setViewportSize(DESKTOP);
    await page.addInitScript((place) => {
      window.localStorage.setItem('uvgo:location', JSON.stringify(place));
    }, STORED_LISBON);
    await page.goto('/');
    await expect(heroTime(page)).toHaveText(TIME_RANGE);
    await expect(page.getByRole('region', { name: 'What to take' })).toBeVisible();
    const after = await layoutMarks(page);
    expect(Math.abs(after.how - before.how)).toBeLessThanOrEqual(2);
    // Left-aligned: the big time starts where the H1 does.
    const timeLeft = await heroTime(page).evaluate((el) => el.getBoundingClientRect().left);
    expect(Math.abs(timeLeft - after.h1Left)).toBeLessThanOrEqual(1);
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

  test('the live sky draws with WebGL and stays quiet in the console', async ({ page }) => {
    const noise = skyConsole(page);
    await page.goto('/');
    await searchLisbon(page);
    await expect(heroTime(page)).toHaveText(TIME_RANGE);

    const sky = page.locator('canvas.sky-canvas');
    await expect(sky).toHaveAttribute('data-ready', '');
    await expect(page.locator('html')).toHaveAttribute('data-sky-live', '');
    expect(await sky.evaluate((el) => getComputedStyle(el).position)).toBe('fixed');
    // The glass is tinted from the live sky.
    expect(
      await page.evaluate(() => document.documentElement.style.getPropertyValue('--glass-rgb')),
    ).not.toBe('');
    expect(noise).toEqual([]);
  });

  test('reduced motion: the sky draws one still frame', async ({ page }) => {
    const noise = skyConsole(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await searchLisbon(page);
    await expect(heroTime(page)).toHaveText(TIME_RANGE);
    await expect(page.locator('canvas.sky-canvas')).toHaveAttribute('data-ready', '');
    expect(noise).toEqual([]);
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
