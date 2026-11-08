import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mockApis, searchLisbon } from './mocks';

const PAGES = ['/', '/uv-index', '/uv-risks', '/sun-protection', '/privacy', '/404'] as const;
/** Axe reads mid-fade colours as low contrast: wait for the entrance choreography to finish. */
async function settleAnimations(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (a) => a.effect?.getComputedTiming().iterations === Infinity || a.playState === 'finished',
      ),
  );
  // Motion drives some opacity changes from script, outside document.getAnimations().
  await page.waitForTimeout(2000);
}

for (const path of PAGES) {
  test(`no serious or critical a11y violations: ${path}`, async ({ page }) => {
    await mockApis(page);
    await page.goto(path);

    if (path === '/') {
      await searchLisbon(page);
      await expect(page.locator('[data-hero-time]')).toHaveText(/^\d{2}:00–\d{2}:00$/);
      await settleAnimations(page);
    }

    const { violations } = await new AxeBuilder({ page }).analyze();
    const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(
      blocking.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
      })),
    ).toEqual([]);
  });
}

test('no serious or critical a11y violations with the hero folded into the pinned bar', async ({
  page,
}) => {
  await mockApis(page);
  await page.goto('/');
  await searchLisbon(page);
  await expect(page.locator('[data-hero-time]')).toHaveText(/^\d{2}:00–\d{2}:00$/);
  await settleAnimations(page);

  await page.evaluate(() => window.scrollTo(0, 200));
  const bar = page.locator('[data-collapsed-bar]');
  await expect(bar).toHaveCSS('opacity', '1');
  await expect(bar).toHaveText(/^Lisbon · \d{2}:00–\d{2}:00 \| (Good|OK|Avoid)$/);

  const { violations } = await new AxeBuilder({ page }).analyze();
  const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(blocking.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
});
