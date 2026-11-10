import { expect, test } from '@playwright/test';

test.use({ isMobile: false, hasTouch: false, viewport: { width: 1280, height: 800 } });

test('logo and wordmark grow together while rays stream until the mouse leaves', async ({
  page,
}) => {
  await page.goto('/uv-index/');
  const link = page.locator('[data-logo-link]');
  const symbol = link.locator('svg');
  const label = link.locator('[data-logo-wordmark]');
  const labelBefore = await label.boundingBox();
  await link.hover();
  await expect(symbol).toHaveCSS('transform', 'matrix(1.08, 0, 0, 1.08, 0, 0)');
  await expect(label).toHaveCSS('transform', 'matrix(1.08, 0, 0, 1.08, 0, 0)');
  const rays = link.locator('[data-logo-ray]');
  await expect(rays).toHaveCount(7);
  const particles = link.locator('[data-logo-particle]');
  await expect(particles).toHaveCount(14);
  const emissionRadii = await particles.evaluateAll((nodes) =>
    nodes.map((node) => {
      const start = (node.querySelector('path') as SVGPathElement).getPointAtLength(0);
      const frame = (node.getAnimations()[0].effect as KeyframeEffect).getKeyframes()[0];
      const position = new DOMPoint(start.x, start.y).matrixTransform(
        new DOMMatrix(String(frame.transform)),
      );
      // Include the rounded cap of the shadow stroke, not just the path centreline.
      return Math.hypot(position.x - 250, position.y - 285) - 10;
    }),
  );
  for (const radius of emissionRadii) {
    expect(radius).toBeGreaterThanOrEqual(102);
    expect(radius).toBeLessThanOrEqual(112);
  }
  // Hold the hover through two complete flights: this catches one-shot implementations.
  await expect
    .poll(async () =>
      particles.evaluateAll((nodes) =>
        nodes.every((node) => {
          const flight = node.getAnimations()[0];
          return (
            flight?.playState === 'running' &&
            Number(flight.currentTime) > Number(flight.effect!.getTiming().duration) * 2
          );
        }),
      ),
    )
    .toBe(true);
  const observed = { faded: false, visible: false };
  await expect
    .poll(
      async () => {
        const opacity = await particles
          .first()
          .evaluate((node) => Number(getComputedStyle(node).opacity));
        observed.faded ||= opacity < 0.05;
        observed.visible ||= opacity > 0.5;
        return observed.faded && observed.visible;
      },
      { intervals: [30] },
    )
    .toBe(true);
  const labelHovered = await label.boundingBox();
  expect(labelHovered!.width).toBeCloseTo(labelBefore!.width * 1.08, 1);
  expect(labelHovered!.height).toBeCloseTo(labelBefore!.height * 1.08, 1);
  await page.mouse.move(600, 400);
  await expect(symbol).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  await expect(label).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  expect(await label.boundingBox()).toEqual(labelBefore);
  await expect(particles).toHaveCount(0);
  for (const ray of await rays.all()) {
    await expect(ray).toHaveCSS('opacity', '1');
  }
});

test('reduced motion keeps the symbol and rays still on hover', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/uv-index/');
  const link = page.locator('[data-logo-link]');
  await link.hover();
  await expect(link.locator('svg')).toHaveCSS('transform', 'none');
  await expect(link.locator('[data-logo-wordmark]')).toHaveCSS('transform', 'none');
  await expect(link.locator('[data-logo-particle]')).toHaveCount(0);
  for (const ray of await link.locator('[data-logo-ray]').all()) {
    await expect(ray).toHaveCSS('transform', 'none');
  }
});
