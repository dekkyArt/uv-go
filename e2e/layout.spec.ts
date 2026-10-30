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
  const middle = await page.locator('[data-page]').evaluate((el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return r.top + ((window.scrollY + window.innerHeight / 2) / el.offsetHeight) * r.height;
  });
  expect(middle).toBeCloseTo(844 / 2, 0);
  // Everything behind the sheet is out of reach, the toolbar included.
  await expect(page.locator('[data-fixed-layers]')).toHaveAttribute('inert', '');
});

test('desktop: the card titles scroll with their cards instead of sitting on the rows', async ({
  page,
}) => {
  await openLisbon(page, { width: 1280, height: 800 });
  const headers = page.locator('#day-panel [data-card-header]');
  await expect(headers.first()).toBeVisible();
  for (const position of await headers.evaluateAll((els) =>
    els.map((el) => getComputedStyle(el).position),
  ))
    expect(position).not.toBe('sticky');

  // Scrolled until the Hourly and Your free time tops have passed the top of the viewport.
  await page.evaluate(() => window.scrollTo(0, 400));
  const overlaps = await headers.evaluateAll((els) =>
    els.map((el) => {
      const body = el.parentElement!.querySelector('[data-card-body]')!;
      return el.getBoundingClientRect().bottom - body.getBoundingClientRect().top;
    }),
  );
  for (const overlap of overlaps) expect(overlap).toBeLessThanOrEqual(0);
});

test('phone: the pager does not clip the hero scrim; the page clips at the viewport edge', async ({
  page,
}) => {
  await openLisbon(page, { width: 390, height: 844 });
  await expect(page.locator('[data-pager-enabled="true"]')).toHaveCount(1);
  const { clippers, scrim, pageOverflowX } = await page.evaluate(() => {
    const el = document.querySelector('.hero-scrim')!;
    const page = document.querySelector('[data-page]')!;
    const clippers: string[] = [];
    for (let a = el.parentElement; a && a !== page; a = a.parentElement) {
      const style = getComputedStyle(a);
      if (style.overflowX !== 'visible' || style.clipPath !== 'none')
        clippers.push(`${a.tagName}.${a.className}`);
    }
    const r = el.getBoundingClientRect();
    return {
      clippers,
      scrim: { left: r.left, right: r.right },
      pageOverflowX: getComputedStyle(page).overflowX,
    };
  });
  // Nothing between the scrim and the page cuts it, so its 16 px feather reaches the screen edge.
  expect(clippers).toEqual([]);
  expect(scrim.left).toBeCloseTo(0, 0);
  expect(scrim.right).toBeCloseTo(390, 0);
  expect(pageOverflowX).toBe('clip');
});

/** Highest WCAG luminance in the sun zone (top 18 %) of the sky alone, with the page hidden. */
async function sunZoneLuma(page: Page): Promise<number> {
  const hide = await page.addStyleTag({
    content: '[data-page], [data-collapsed-bar], nav[aria-label="App"] { visibility: hidden }',
  });
  const shot = await page.screenshot({
    clip: { x: 0, y: 0, width: 390, height: Math.floor(844 * 0.18) },
  });
  await hide.evaluate((el: Element) => el.remove());
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, img.width, img.height).data;
    const ch = (v: number) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    };
    let max = 0;
    for (let i = 0; i < d.length; i += 4)
      max = Math.max(max, 0.2126 * ch(d[i]) + 0.7152 * ch(d[i + 1]) + 0.0722 * ch(d[i + 2]));
    return max;
  }, shot.toString('base64'));
}

test('phone: the sun gives up its light in the sun zone once the pinned bar is in', async ({
  page,
}) => {
  await openLisbon(page, { width: 390, height: 844 });
  await expect(page.locator('canvas.sky-canvas[data-ready]')).toHaveCount(1);
  // At the top of the page the sun shines past the cap (spec 6.4)...
  await expect.poll(() => sunZoneLuma(page)).toBeGreaterThan(0.3);
  // ...and under the bar the zone holds MAX_SKY_LUMA (0.3) like the rest of the sky.
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect(page.locator('[data-collapsed-bar]')).toBeVisible();
  await expect.poll(() => sunZoneLuma(page)).toBeLessThanOrEqual(0.3 + 1 / 255);
});
