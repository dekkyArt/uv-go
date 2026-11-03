import { expect, test, type Page } from '@playwright/test';
import { STORED_LISBON, mockApis } from './mocks';

const TOUCH = { pointerType: 'touch', pointerId: 7, isPrimary: true, bubbles: true } as const;

/** A horizontal swipe on the day panel: down, `steps` moves of `step` px along x, up. */
async function swipe(page: Page, step: number, steps = 5) {
  const panel = page.locator('#day-panel');
  const box = (await panel.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = Math.max(box.y, 0) + 40;
  await panel.dispatchEvent('pointerdown', { ...TOUCH, clientX: x, clientY: y });
  for (let i = 1; i <= steps; i += 1)
    await panel.dispatchEvent('pointermove', { ...TOUCH, clientX: x + step * i, clientY: y });
  await panel.dispatchEvent('pointerup', { ...TOUCH, clientX: x + step * steps, clientY: y });
}

test.describe('Today / Tomorrow pager (touch)', () => {
  test.beforeEach(async ({ page }) => {
    await mockApis(page);
    await page.addInitScript((place) => {
      window.localStorage.setItem('uvgo:location', JSON.stringify(place));
    }, STORED_LISBON);
    await page.goto('/');
    await expect(page.locator('[data-hero-time]')).toHaveText(/^\d{2}:00–\d{2}:00$/);
  });

  /** The Hourly card names the day it shows: "Today, 27 Oct". */
  const showsDay = (page: Page, name: 'Today' | 'Tomorrow') =>
    expect(page.locator('#day-panel').getByText(new RegExp(`^${name}, `))).toBeVisible();

  test('a swipe to the left shows Tomorrow, a swipe to the right goes back', async ({ page }) => {
    await showsDay(page, 'Today');
    await swipe(page, -40);
    await showsDay(page, 'Tomorrow');
    // The page has settled back at rest, without a transform that would re-anchor fixed children.
    await expect
      .poll(() =>
        page.locator('[data-pager-enabled]').evaluate((el) => getComputedStyle(el).transform),
      )
      .toBe('none');

    await swipe(page, 40);
    await showsDay(page, 'Today');
  });

  test('a short swipe stays on the day and the page does not scroll sideways', async ({ page }) => {
    await swipe(page, -4);
    await showsDay(page, 'Today');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
  });

  test('the pinned bar and the sticky card headers survive the pager', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, 500));
    const bar = page.locator('[data-collapsed-bar]');
    await expect(bar).toBeVisible();
    const top = await bar.evaluate((el) => el.getBoundingClientRect().top);
    expect(top).toBe(0);
    // A card's header sticks right under the bar and its pill strip (56 + 44 px) while its body is
    // still on screen.
    const header = page.locator('#day-panel [data-card-header]').first();
    const stuck = () => header.evaluate((el) => el.getBoundingClientRect().top);
    await page.evaluate(() => window.scrollTo(0, 400));
    await expect.poll(stuck).toBe(100);

    await swipe(page, -40);
    await showsDay(page, 'Tomorrow');
    expect(await bar.evaluate((el) => el.getBoundingClientRect().top)).toBe(0);
    await expect.poll(stuck).toBe(100);
  });
});
