import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, over, type Rgb } from '../../domain/contrast';
import { WORST_BACKGROUNDS } from '../../domain/glass';

const css = readFileSync('src/styles/global.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
const SMALL_TEXT_AA = 4.5;
const LARGE_TEXT_AA = 3;

/** Body of the `.sky-text` rule. */
function skyTextRule(): string {
  const rule = /\.sky-text\s*\{([^}]*)\}/.exec(css);
  expect(rule, '.sky-text rule in global.css').not.toBeNull();
  return rule![1];
}

/** The black alpha of the rim every glyph carries. */
function rimAlpha(): number {
  const m = /--sky-rim:\s*rgb\(0 0 0 \/ ([\d.]+)\);/.exec(skyTextRule());
  expect(m, 'a flat rgb(0 0 0 / alpha) --sky-rim in .sky-text').not.toBeNull();
  return Number(m![1]);
}

/** The text-shadow layers, one string each. */
function shadowLayers(): string[] {
  const m = /text-shadow:([^;]*);/.exec(skyTextRule());
  expect(m, 'a text-shadow in .sky-text').not.toBeNull();
  return m![1].split(',').map((l) => l.trim().replace(/\s+/g, ' '));
}

/**
 * The hero text sits straight on the sky, with no plate. Each glyph carries an unblurred 1 px copy
 * of itself in black at --sky-rim on every side, so every point within 1 px of a stroke is covered
 * by at least that alpha: the colour a small line is read against is the sky under the rim. That
 * holds wherever a line lands, so one number proves every line. The big time and the city are
 * large text and need 3:1 on the bare sky. Checked over every worst-case background
 * (luminance MAX_SKY_LUMA).
 *
 * The hero uses no secondary text colour (white at 0.72): it would fall short of 4.5:1 here. All
 * its text is full white, and hierarchy comes from size and weight (hero.test.tsx guards against
 * `text-text-muted`).
 */
describe('hero text contrast over the worst-case sky', () => {
  const rim = rimAlpha();
  const backgrounds = WORST_BACKGROUNDS.map((bg, i) => [i, bg] as const);

  it('is a crisp rim on all four sides: unblurred 1 px copies, no wide shadow', () => {
    expect(rim).toBeGreaterThan(0);
    expect(new Set(shadowLayers())).toEqual(
      new Set([
        '1px 0 0 var(--sky-rim)',
        '-1px 0 0 var(--sky-rim)',
        '0 1px 0 var(--sky-rim)',
        '0 -1px 0 var(--sky-rim)',
      ]),
    );
  });

  it.each(backgrounds)('background %i: white small lines hold 4.5:1 on the rim', (_i, bg) => {
    expect(contrastRatio(WHITE, over(BLACK, rim, bg))).toBeGreaterThanOrEqual(SMALL_TEXT_AA);
  });

  it.each(backgrounds)('background %i: large text holds 3:1 on the bare sky', (_i, bg) => {
    expect(contrastRatio(WHITE, bg)).toBeGreaterThanOrEqual(LARGE_TEXT_AA);
  });
});
