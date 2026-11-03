import { expect, test, type Page } from '@playwright/test';
import { makeForecastJson } from '../src/test/forecastJson';
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

test('phone: the pager does not clip its content; the page clips at the viewport edge', async ({
  page,
}) => {
  await openLisbon(page, { width: 390, height: 844 });
  await expect(page.locator('[data-pager-enabled="true"]')).toHaveCount(1);
  const { clippers, pageOverflowX } = await page.evaluate(() => {
    const hero = document.querySelector('[data-hero-time]')!.closest('.sky-text')!;
    const page = document.querySelector('[data-page]')!;
    const clippers: string[] = [];
    for (let a = hero.parentElement; a && a !== page; a = a.parentElement) {
      const style = getComputedStyle(a);
      if (style.overflowX !== 'visible' || style.clipPath !== 'none')
        clippers.push(`${a.tagName}.${a.className}`);
    }
    return { clippers, pageOverflowX: getComputedStyle(page).overflowX };
  });
  // Nothing between the hero and the page cuts the sliding content short of the screen edge.
  expect(clippers).toEqual([]);
  expect(pageOverflowX).toBe('clip');
});

/** Highest WCAG luminance in the sun zone (top 18 %) of the sky alone, with the page hidden. */
async function sunZoneLuma(page: Page): Promise<number> {
  const hide = await page.addStyleTag({
    content:
      '[data-page], [data-collapsed-bar], [data-take-strip], nav[aria-label="App"] { visibility: hidden }',
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

test('phone: focus scrolls clear of the pinned bar, its pill strip and the tallest stuck header', async ({
  page,
}) => {
  await openLisbon(page, { width: 390, height: 844 });
  const headers = await page
    .locator('#day-panel [data-card-header]')
    .evaluateAll((els) => els.map((el) => (el as HTMLElement).offsetHeight));
  const padding = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop),
  );
  // 56 px of bar, 44 px of strip, plus STUCK_HEADER_H, which has to cover the tallest header.
  expect(padding).toBe(172);
  expect(Math.max(...headers)).toBeLessThanOrEqual(padding - 100);
});

test('phone: the What to take pills fold into one row under the pinned bar on scroll', async ({
  page,
}) => {
  await openLisbon(page, { width: 390, height: 844 });
  const strip = page.locator('[data-take-strip]');
  const onPage = page.getByRole('region', { name: 'What to take' });
  // At the top the pills are on the page, the strip is not on screen.
  await expect(strip).toHaveCSS('opacity', '0');
  await expect(onPage).toHaveCSS('opacity', '1');

  await page.evaluate(() => window.scrollTo(0, 900));
  await expect(page.locator('[data-collapsed-bar]')).toHaveCSS('opacity', '1');
  await expect(strip).toHaveCSS('opacity', '1');
  await expect(onPage).toHaveCSS('opacity', '0');

  // One row of pills right under the 56 px bar, all of the same height.
  const pills = await strip.locator('li').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, height: r.height };
    }),
  );
  expect(pills.length).toBeGreaterThan(0);
  for (const pill of pills) expect(pill).toEqual({ top: 62, height: 32 });

  // Every card is cut at the strip's bottom edge: no glass shows behind the pills. The clips are
  // written on the next frame after a scroll, so the check polls.
  const highestVisibleTop = () =>
    page.locator('#day-panel section.glass').evaluateAll((els) =>
      Math.min(
        ...els.map((el) => {
          const top = el.getBoundingClientRect().top;
          const m = /^inset\((\d+(?:\.\d+)?)px/.exec(getComputedStyle(el).clipPath);
          return top + (m ? Number(m[1]) : 0);
        }),
      ),
    );
  await expect.poll(highestVisibleTop).toBeGreaterThanOrEqual(100 - 0.5);

  // Back at the top the pills return to the page.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(strip).toHaveCSS('opacity', '0');
  await expect(onPage).toHaveCSS('opacity', '1');
});

test('phone: a strip too wide for the screen scrolls sideways and fades its far edge', async ({
  page,
}) => {
  await mockApis(page);
  // High UV, rain and heat all through the day: every pill but the warm layer.
  const json = makeForecastJson({
    hourly: {
      uv_index: Array.from({ length: 48 }, () => 9),
      precipitation_probability: Array.from({ length: 48 }, () => 60),
      apparent_temperature: Array.from({ length: 48 }, () => 30),
    },
  });
  await page.route('**/api.open-meteo.com/**', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(json) }),
  );
  await page.setViewportSize({ width: 320, height: 640 });
  await page.addInitScript((p) => {
    window.localStorage.setItem('uvgo:location', JSON.stringify(p));
  }, STORED_LISBON);
  await page.goto('/');
  await expect(page.locator('[data-hero-time]')).toHaveText(TIME_RANGE);
  await page.evaluate(() => window.scrollTo(0, 900));
  const row = page.locator('[data-take-strip] ul');
  await expect(page.locator('[data-take-strip]')).toHaveCSS('opacity', '1');

  const size = await row.evaluate((el) => ({ client: el.clientWidth, scroll: el.scrollWidth }));
  expect(size.scroll).toBeGreaterThan(size.client);
  // `transparent` comes back from the computed style as rgba(0, 0, 0, 0).
  const clear = 'rgba\\(0, 0, 0, 0\\)';
  await expect(row).toHaveCSS('mask-image', new RegExp(`${clear} 100%`));
  await expect(row).not.toHaveCSS('mask-image', new RegExp(`${clear} 0px`));

  await row.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
  await expect(row).toHaveCSS('mask-image', new RegExp(`${clear} 0px`));
  await expect(row).not.toHaveCSS('mask-image', new RegExp(`${clear} 100%`));
});

test('desktop: the Plan card stays put while its inputs change the What to take pills', async ({
  page,
}) => {
  // No first-result intro: the cards rising in would move Plan on their own.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openLisbon(page, { width: 1280, height: 800 });
  const plan = page.getByRole('region', { name: 'Plan' });
  const take = page.getByRole('region', { name: 'What to take' });
  const top = () => plan.evaluate((el) => el.getBoundingClientRect().top);
  const start = await top();
  // The pills sit in the hero's column, to the left of the cards.
  const takeRight = await take.evaluate((el) => el.getBoundingClientRect().right);
  const planLeft = await plan.evaluate((el) => el.getBoundingClientRect().left);
  expect(takeRight).toBeLessThanOrEqual(planLeft);

  for (const name of ['Active', 'Long in the sun', 'Relaxed', '30 min', '3 h', '1 h']) {
    await plan.getByRole('radio', { name }).click();
    expect(await top()).toBe(start);
  }
});
