import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mockApis, searchLisbon } from './mocks';

const PAGES = [
  '/',
  '/uv-index/',
  '/uv-risks/',
  '/sun-protection/',
  '/privacy/',
  '/404.html',
] as const;
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

async function accessibilityViolations(page: Page) {
  // The site footer's text on bare sky is an agreed design exception for contrast only.
  // Keep all other accessibility rules active there, including link and landmark checks.
  const general = await new AxeBuilder({ page }).disableRules('color-contrast').analyze();
  const contrast = await new AxeBuilder({ page })
    .withRules('color-contrast')
    .exclude('[data-page] > footer')
    .analyze();
  return [...general.violations, ...contrast.violations];
}

for (const hour of [0, 6, 12, 18]) {
  test(`first visit has no serious a11y violations at ${hour}:00`, async ({ page }) => {
    await mockApis(page);
    await page.clock.setFixedTime(new Date(2026, 5, 21, hour));
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Find a city', exact: true })).toBeVisible();
    await settleAnimations(page);

    const violations = await accessibilityViolations(page);
    expect(
      violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
    ).toEqual([]);
  });
}

for (const path of PAGES) {
  test(`no serious or critical a11y violations: ${path}`, async ({ page }) => {
    await mockApis(page);
    await page.goto(path);
    await expect(page.locator('main#main')).toBeVisible();

    if (path === '/') {
      await searchLisbon(page);
      await expect(page.locator('[data-hero-time]')).toHaveText(/^\d{2}:00–\d{2}:00$/);
      await settleAnimations(page);
    }

    const violations = await accessibilityViolations(page);
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

  const violations = await accessibilityViolations(page);
  const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(blocking.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
});
