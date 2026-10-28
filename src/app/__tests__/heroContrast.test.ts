import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, over, type Rgb } from '../../domain/contrast';
import { WORST_BACKGROUNDS } from '../../domain/glass';

const css = readFileSync('src/styles/global.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
const SMALL_TEXT_AA = 4.5;
const LARGE_TEXT_AA = 3;

interface Stop {
  alpha: number;
  position: number;
}

/** The colour stops of the `.hero-scrim` gradient: black at some alpha, or transparent. */
function scrimStops(): Stop[] {
  const rule = /\.hero-scrim\s*\{([^}]*)\}/.exec(css);
  expect(rule, '.hero-scrim rule in global.css').not.toBeNull();
  const gradient = /background:\s*radial-gradient\(([^;]*)\);/.exec(rule![1]);
  expect(gradient, 'a radial-gradient background in .hero-scrim').not.toBeNull();
  return [...gradient![1].matchAll(/(rgb\(0 0 0 \/ ([\d.]+)\)|transparent)\s+([\d.]+)%/g)].map(
    (m) => ({ alpha: m[2] === undefined ? 0 : Number(m[2]), position: Number(m[3]) }),
  );
}

/**
 * The hero text sits directly on the sky (no glass). The scrim is a plateau (constant alpha out to
 * 70%+ of its ellipse), not a point at the centre: the small lines (eyebrow, verdict, reason, Now
 * line, buttons) sit off-centre, and only the plateau lets one number prove them all. The big
 * time and the city are large text and need 3:1 on the bare sky, where the scrim has faded out.
 * Checked over every worst-case background (luminance MAX_SKY_LUMA).
 *
 * The hero uses no secondary text colour (white at 0.72): at the 0.28 scrim it reaches only
 * 3.58:1 in the worst case, short of 4.5:1. All its text is full white, and hierarchy comes from
 * size and weight (hero.test.tsx guards against `text-text-muted`).
 */
describe('hero text contrast over the worst-case sky', () => {
  const stops = scrimStops();
  const plateauAlpha = stops[0]?.alpha ?? 0;
  const backgrounds = WORST_BACKGROUNDS.map((bg, i) => [i, bg] as const);

  it('is a plateau: two equal black stops up to at least 70%, then a fade to transparent', () => {
    expect(stops).toHaveLength(3);
    expect(stops[0].alpha).toBeGreaterThan(0);
    expect(stops[1].alpha).toBe(stops[0].alpha);
    expect(stops[0].position).toBe(0);
    expect(stops[1].position).toBeGreaterThanOrEqual(70);
    expect(stops[2]).toEqual({ alpha: 0, position: 100 });
  });

  it.each(backgrounds)(
    'background %i: white small lines hold 4.5:1 anywhere on the scrim plateau',
    (_i, bg) => {
      expect(contrastRatio(WHITE, over(BLACK, plateauAlpha, bg))).toBeGreaterThanOrEqual(
        SMALL_TEXT_AA,
      );
    },
  );

  it.each(backgrounds)('background %i: large text holds 3:1 on the bare sky', (_i, bg) => {
    expect(contrastRatio(WHITE, bg)).toBeGreaterThanOrEqual(LARGE_TEXT_AA);
  });
});
