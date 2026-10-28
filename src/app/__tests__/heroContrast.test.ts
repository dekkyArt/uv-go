import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, over, type Rgb } from '../../domain/contrast';
import { WORST_BACKGROUNDS } from '../../domain/glass';

const css = readFileSync('src/styles/global.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
const SMALL_TEXT_AA = 4.5;
const LARGE_TEXT_AA = 3;

/** The darkest alpha of the scrim: the first colour stop of its radial gradient. */
function scrimAlpha(): number {
  const rule = /\.hero-scrim\s*\{([^}]*)\}/.exec(css);
  expect(rule, '.hero-scrim rule in global.css').not.toBeNull();
  const stop = /radial-gradient\([^)]*?rgb\(0 0 0 \/ ([\d.]+)\)/.exec(rule![1]);
  expect(stop, 'a black first stop in the .hero-scrim gradient').not.toBeNull();
  return Number(stop![1]);
}

/**
 * The hero text sits directly on the sky (no glass): the scrim darkens its middle, and fades out
 * to the bare sky at its edge. Checked over every worst-case background (luminance MAX_SKY_LUMA).
 *
 * The hero uses no secondary text colour (white at 0.72): at the 0.28 scrim it reaches only
 * 3.58:1 in the worst case, short of 4.5:1. All its text is full white, and hierarchy comes from
 * size and weight (hero.test.tsx guards against `text-text-muted`).
 */
describe('hero text contrast over the worst-case sky', () => {
  const alpha = scrimAlpha();
  const backgrounds = WORST_BACKGROUNDS.map((bg, i) => [i, bg] as const);

  it.each(backgrounds)(
    'background %i: white small lines hold 4.5:1 at the scrim centre',
    (_i, bg) => {
      expect(contrastRatio(WHITE, over(BLACK, alpha, bg))).toBeGreaterThanOrEqual(SMALL_TEXT_AA);
    },
  );

  it.each(backgrounds)('background %i: large text holds 3:1 on the bare sky', (_i, bg) => {
    expect(contrastRatio(WHITE, bg)).toBeGreaterThanOrEqual(LARGE_TEXT_AA);
  });
});
