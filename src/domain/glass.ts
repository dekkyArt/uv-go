import { contrastRatio, luminance, over, type Rgb } from './contrast';
import { GLASS, MAX_SKY_LUMA, TEXT_SECONDARY_ALPHA } from './skyPalette';

export interface Glass {
  rgb: Rgb;
  alpha: number;
}

const WHITE: Rgb = [255, 255, 255];
const TEXT_AA = 4.5;
const ALPHA_STEP = 0.01;

// The brightest gray the sky may be: the worst background the glass has to hold text over.
const WORST_BEHIND: Rgb = (() => {
  let lo = 0;
  let hi = 255;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (luminance([mid, mid, mid]) <= MAX_SKY_LUMA) lo = mid;
    else hi = mid - 1;
  }
  return [lo, lo, lo];
})();

/** Glass tint for a sky of mean colour `base`: darkened, as opaque as white text needs over the brightest allowed sky. */
export function glassFor(base: Rgb): Glass {
  const rgb = base.map((v) => Math.round(v * GLASS.darken)) as Rgb;
  // Integer steps avoid 0.01 float drift; 100 is full opacity, where white text always passes.
  for (let step = Math.round(GLASS.baseAlpha / ALPHA_STEP); step <= 100; step++) {
    const alpha = step * ALPHA_STEP;
    const surface = over(rgb, alpha, WORST_BEHIND);
    const secondary = over(WHITE, TEXT_SECONDARY_ALPHA, surface);
    if (contrastRatio(WHITE, surface) >= TEXT_AA && contrastRatio(secondary, surface) >= TEXT_AA) {
      return { rgb, alpha: Number(alpha.toFixed(2)) };
    }
  }
  return { rgb, alpha: 1 };
}
