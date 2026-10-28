import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, over, type Rgb } from '../../domain/contrast';
import { WORST_BACKGROUNDS } from '../../domain/glass';

const css = readFileSync('src/styles/global.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
const SMALL_TEXT_AA = 4.5;
const LARGE_TEXT_AA = 3;

/** Body of the `.hero-scrim` rule (the base one, without the media query). */
function scrimRule(): string {
  const rule = /\.hero-scrim\s*\{([^}]*)\}/.exec(css);
  expect(rule, '.hero-scrim rule in global.css').not.toBeNull();
  return rule![1];
}

/** The flat black alpha of the scrim background. */
function scrimAlpha(): number {
  const m = /background:\s*rgb\(0 0 0 \/ ([\d.]+)\);/.exec(scrimRule());
  expect(m, 'a flat rgb(0 0 0 / alpha) background in .hero-scrim').not.toBeNull();
  return Number(m![1]);
}

/**
 * The hero text sits directly on the sky (no glass). The scrim is a flat alpha over the whole hero
 * box (feathered only in the bleed around it, where there is no text), so one number proves every
 * line wherever it lands. e2e/heroScrim.spec.ts checks the lines are inside the unfeathered box.
 * The big time and the city are large text and need 3:1 on the bare sky.
 * Checked over every worst-case background (luminance MAX_SKY_LUMA).
 *
 * The hero uses no secondary text colour (white at 0.72): at the 0.28 scrim it reaches only
 * 3.58:1 in the worst case, short of 4.5:1. All its text is full white, and hierarchy comes from
 * size and weight (hero.test.tsx guards against `text-text-muted`).
 */
describe('hero text contrast over the worst-case sky', () => {
  const plateauAlpha = scrimAlpha();
  const backgrounds = WORST_BACKGROUNDS.map((bg, i) => [i, bg] as const);

  it('is a flat black, not a gradient: it does not depend on where a line lands', () => {
    expect(plateauAlpha).toBeGreaterThan(0);
    expect(/background:\s*[^;]*gradient/.test(scrimRule())).toBe(false);
  });

  it('feathers only inside the bleed: transparent at the edge, full at --scrim-x / --scrim-y', () => {
    const rule = scrimRule();
    const bleed = (name: string) => {
      const m = new RegExp(`--scrim-${name}:\\s*(\\d+)px`).exec(rule);
      expect(m, `--scrim-${name} in .hero-scrim`).not.toBeNull();
      return Number(m![1]);
    };
    expect(bleed('x')).toBeGreaterThan(0);
    expect(bleed('y')).toBeGreaterThan(0);
    // The scrim box is the hero box grown by exactly the bleed...
    expect(rule).toMatch(/inset:\s*calc\(var\(--scrim-y\) \* -1\) calc\(var\(--scrim-x\) \* -1\);/);
    // ...and each mask layer is transparent, full from one bleed in, full until one bleed from the
    // far edge, transparent: the fade never reaches into the hero box.
    for (const [dir, name] of [
      ['right', 'x'],
      ['bottom', 'y'],
    ] as const) {
      const layer = new RegExp(
        `linear-gradient\\(\\s*to ${dir},\\s*transparent,\\s*#000 var\\(--scrim-${name}\\),\\s*#000 calc\\(100% - var\\(--scrim-${name}\\)\\),\\s*transparent\\s*\\)`,
      );
      expect(rule, `a ${dir} mask layer`).toMatch(layer);
    }
    expect(rule).toMatch(/mask-composite:\s*intersect;/);
    expect(rule).toMatch(/-webkit-mask-composite:\s*source-in;/);
  });

  it.each(backgrounds)(
    'background %i: white small lines hold 4.5:1 anywhere on the flat scrim',
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
