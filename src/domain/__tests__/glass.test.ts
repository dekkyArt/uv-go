import { describe, expect, it } from 'vitest';
import { contrastRatio, hexToRgb, luminance, over, type Rgb } from '../contrast';
import { glassFor } from '../glass';
import { GLASS, MAX_SKY_LUMA, SKY_PALETTE, TEXT_SECONDARY_ALPHA } from '../skyPalette';
import type { SkyPhase } from '../sky';

const PHASES = Object.keys(SKY_PALETTE) as SkyPhase[];
const WHITE: Rgb = [255, 255, 255];

/** The gray whose luminance is `target`: binary search over the 0..255 levels. */
function grayWithLuminance(target: number): Rgb {
  let lo = 0;
  let hi = 255;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (luminance([mid, mid, mid]) <= target) lo = mid;
    else hi = mid - 1;
  }
  return [lo, lo, lo];
}

describe('sky glass', () => {
  const worstBehind = grayWithLuminance(MAX_SKY_LUMA);

  it('defines the six phases', () => {
    expect([...PHASES].sort()).toEqual(['dawn', 'day', 'dusk', 'golden', 'morning', 'night']);
  });

  it.each(PHASES)(
    'glass for %s keeps white and secondary text AA over the brightest allowed sky',
    (phase) => {
      const { top, bottom } = SKY_PALETTE[phase];
      const base = over(hexToRgb(top), 0.5, hexToRgb(bottom));
      const g = glassFor(base);
      const surface = over(g.rgb, g.alpha, worstBehind);
      expect(contrastRatio(WHITE, surface)).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(over(WHITE, TEXT_SECONDARY_ALPHA, surface), surface),
      ).toBeGreaterThanOrEqual(4.5);
      expect(g.alpha).toBeGreaterThanOrEqual(GLASS.baseAlpha);
      expect(g.alpha).toBeLessThanOrEqual(0.8);
    },
  );

  it('uses the smallest alpha step that passes', () => {
    const base = hexToRgb(SKY_PALETTE.day.top);
    const g = glassFor(base);
    if (g.alpha > GLASS.baseAlpha) {
      const lower = over(g.rgb, g.alpha - 0.01, worstBehind);
      const ok =
        contrastRatio(WHITE, lower) >= 4.5 &&
        contrastRatio(over(WHITE, TEXT_SECONDARY_ALPHA, lower), lower) >= 4.5;
      expect(ok).toBe(false);
    }
  });

  it('every palette stop stays within MAX_SKY_LUMA', () => {
    for (const phase of PHASES) {
      for (const stop of ['top', 'bottom'] as const) {
        const l = luminance(hexToRgb(SKY_PALETTE[phase][stop]));
        expect(l, `${phase} ${stop}`).toBeLessThanOrEqual(MAX_SKY_LUMA);
      }
    }
  });
});
