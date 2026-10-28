import { describe, expect, it } from 'vitest';
import { contrastRatio, hexToRgb, luminance, over, type Rgb } from '../contrast';
import { glassFor, WORST_BACKGROUNDS } from '../glass';
import { GLASS, MAX_SKY_LUMA, SKY_PALETTE, TEXT_SECONDARY_ALPHA } from '../skyPalette';
import type { SkyPhase } from '../sky';

const PHASES = Object.keys(SKY_PALETTE) as SkyPhase[];
const WHITE: Rgb = [255, 255, 255];

describe('sky glass', () => {
  it('defines the six phases', () => {
    expect([...PHASES].sort()).toEqual(['dawn', 'day', 'dusk', 'golden', 'morning', 'night']);
  });

  it('the worst-case backgrounds all sit at the luminance cap', () => {
    for (const bg of WORST_BACKGROUNDS) {
      expect(luminance(bg)).toBeLessThanOrEqual(MAX_SKY_LUMA);
      expect(luminance(bg)).toBeGreaterThan(MAX_SKY_LUMA - 0.005);
    }
  });

  it.each(PHASES)(
    'glass for %s keeps white and secondary text AA over every worst-case background',
    (phase) => {
      const { top, bottom } = SKY_PALETTE[phase];
      const g = glassFor(over(hexToRgb(top), 0.5, hexToRgb(bottom)));
      for (const behind of WORST_BACKGROUNDS) {
        const surface = over(g.rgb, g.alpha, behind);
        expect(contrastRatio(WHITE, surface)).toBeGreaterThanOrEqual(4.5);
        expect(
          contrastRatio(over(WHITE, TEXT_SECONDARY_ALPHA, surface), surface),
        ).toBeGreaterThanOrEqual(4.5);
      }
      expect(g.alpha).toBeGreaterThanOrEqual(GLASS.baseAlpha);
      expect(g.alpha).toBeLessThanOrEqual(0.8);
    },
  );

  it('uses the smallest alpha step that passes', () => {
    const g = glassFor(hexToRgb(SKY_PALETTE.day.top));
    if (g.alpha > GLASS.baseAlpha) {
      const failsSomewhere = WORST_BACKGROUNDS.some((behind) => {
        const lower = over(g.rgb, g.alpha - 0.01, behind);
        return (
          contrastRatio(WHITE, lower) < 4.5 ||
          contrastRatio(over(WHITE, TEXT_SECONDARY_ALPHA, lower), lower) < 4.5
        );
      });
      expect(failsSomewhere).toBe(true);
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
