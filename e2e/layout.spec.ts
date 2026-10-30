import { expect, test, type Page } from '@playwright/test';
import { STORED_LISBON, mockApis } from './mocks';

const TIME_RANGE = /^\d{2}:00–\d{2}:00$/;

/** Opens the app with Lisbon stored and waits for its result. */
async function openLisbon(page: Page, viewport: { width: number; height: number }) {
  await mockApis(page);
  await page.setViewportSize(viewport);
  await page.addInitScript((p) => {
    window.localStorage.setItem('uvgo:location', JSON.stringify(p));
  }, STORED_LISBON);
  await page.goto('/');
  await expect(page.locator('[data-hero-time]')).toHaveText(TIME_RANGE);
}

type Rect = { x: number; y: number; width: number; height: number };

const rectOf = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el): Rect => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

test('a sheet opened mid-page leaves the sky, the pinned bar and the toolbar where they are', async ({
  page,
}) => {
  await openLisbon(page, { width: 390, height: 844 });
  await expect(page.locator('canvas.sky-canvas[data-ready]')).toHaveCount(1);
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect(page.locator('[data-collapsed-bar]')).toBeVisible();

  const layers = ['canvas.sky-canvas', '[data-collapsed-bar]', 'nav[aria-label="App"]'];
  const before = await Promise.all(layers.map((s) => rectOf(page, s)));
  expect(before[0]).toEqual({ x: 0, y: 0, width: 390, height: 844 });

  await page.getByRole('button', { name: 'Plan' }).click();
  await expect(page.getByRole('dialog', { name: 'Plan' })).toBeVisible();
  // Wait until the page has finished shrinking behind the sheet.
  await expect
    .poll(() => page.locator('[data-page]').evaluate((el) => el.getBoundingClientRect().width))
    .toBeCloseTo(390 * 0.94, 0);

  const after = await Promise.all(layers.map((s) => rectOf(page, s)));
  for (const [i, selector] of layers.entries()) expect(after[i], selector).toEqual(before[i]);
  // The page shrinks around what is on screen: the point at the middle of the viewport stays put.
  const middle = await page.locator('[data-page]').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.top + ((window.scrollY + window.innerHeight / 2) / el.offsetHeight) * r.height;
  });
  expect(middle).toBeCloseTo(844 / 2, 0);
  // Everything behind the sheet is out of reach, the toolbar included.
  await expect(page.locator('[data-fixed-layers]')).toHaveAttribute('inert', '');
});
