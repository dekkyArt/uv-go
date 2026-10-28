import { contrastRatio, hexToRgb, luminance, over, type Rgb } from './contrast';
import { GLASS, MAX_SKY_LUMA, SKY_PALETTE, TEXT_SECONDARY_ALPHA } from './skyPalette';

export interface Glass {
  rgb: Rgb;
  alpha: number;
}

const WHITE: Rgb = [255, 255, 255];
const TEXT_AA = 4.5;
const ALPHA_STEP = 0.01;

/** `c` scaled per channel (clamped at 255) until its luminance reaches MAX_SKY_LUMA. */
function brightenToMaxLuma(c: Rgb): Rgb {
  const scaled = (f: number) => c.map((v) => Math.min(255, v * f)) as Rgb;
  let lo = 0;
  let hi = 1000;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (luminance(scaled(mid)) <= MAX_SKY_LUMA) lo = mid;
    else hi = mid;
  }
  return scaled(lo);
}

/**
 * The backgrounds glass must hold text over: a gray, and every sky colour (each palette stop and
 * each phase's midpoint) pushed up to the brightest luminance allowed. `over()` blends in gamma
 * space, so a saturated sky of the same luminance gives a lighter surface than gray does.
 */
export const WORST_BACKGROUNDS: Rgb[] = [
  brightenToMaxLuma([1, 1, 1]),
  ...Object.values(SKY_PALETTE).flatMap(({ top, bottom }) => {
    const [t, b] = [hexToRgb(top), hexToRgb(bottom)];
    return [t, b, over(t, 0.5, b)].map(brightenToMaxLuma);
  }),
];

/** Does white and secondary text hold AA on glass (`rgb` at `alpha`) over `behind`? */
function holdsText(rgb: Rgb, alpha: number, behind: Rgb): boolean {
  const surface = over(rgb, alpha, behind);
  const secondary = over(WHITE, TEXT_SECONDARY_ALPHA, surface);
  return contrastRatio(WHITE, surface) >= TEXT_AA && contrastRatio(secondary, surface) >= TEXT_AA;
}

/** Glass tint for a sky of mean colour `base`: darkened, as opaque as white text needs over every worst-case background. */
export function glassFor(base: Rgb): Glass {
  const rgb = base.map((v) => Math.round(v * GLASS.darken)) as Rgb;
  // Integer steps avoid 0.01 float drift; 100 is full opacity, where white text always passes.
  for (let step = Math.round(GLASS.baseAlpha / ALPHA_STEP); step <= 100; step++) {
    const alpha = step * ALPHA_STEP;
    if (WORST_BACKGROUNDS.every((behind) => holdsText(rgb, alpha, behind))) {
      return { rgb, alpha: Number(alpha.toFixed(2)) };
    }
  }
  return { rgb, alpha: 1 };
}
