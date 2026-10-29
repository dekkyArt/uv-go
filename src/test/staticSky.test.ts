import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, hexToRgb, luminance, over, type Rgb } from '../domain/contrast';
import { glassFor, WORST_BACKGROUNDS } from '../domain/glass';
import type { SkyPhase } from '../domain/sky';
import { MAX_SKY_LUMA, SKY_PALETTE, TEXT_SECONDARY_ALPHA } from '../domain/skyPalette';

/** The static pages (articles, 404) paint the phase from global.css alone: no WebGL sky. */
const css = readFileSync('src/styles/global.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const WHITE: Rgb = [255, 255, 255];
const PHASES = Object.keys(SKY_PALETTE) as SkyPhase[];

const rule = (selector: string): string => {
  const escaped = selector.replace(/[[\]().*+?^${}|]/g, '\\$&');
  const m = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm').exec(css);
  expect(m, `a rule for ${selector}`).not.toBeNull();
  return m![1];
};

/** The sun glow html::after paints: colour, peak alpha, and the box it is confined to. */
function glow() {
  const body = rule('html::after');
  const height = Number(/height:\s*([\d.]+)vh/.exec(body)?.[1]);
  const gradient =
    /radial-gradient\(ellipse\s+[\d.]+vw\s+([\d.]+)vh\s+at\s+[\d.]+%\s+([\d.]+)vh,\s*rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\),\s*transparent\)/.exec(
      body,
    );
  expect(gradient, 'html::after is a radial glow to transparent').not.toBeNull();
  const [, radiusY, centreY, r, g, b, alpha] = gradient!;
  return {
    height,
    reachY: Number(centreY) + Number(radiusY),
    rgb: [Number(r), Number(g), Number(b)] as Rgb,
    alpha: Number(alpha),
  };
}

/** The phase gradient (top to bottom, linear in sRGB like CSS) at `t` of the viewport height. */
function skyAt(phase: SkyPhase, t: number): Rgb {
  const { top, bottom } = SKY_PALETTE[phase];
  return over(hexToRgb(bottom), t, hexToRgb(top));
}

describe('static sky: sun glow on pages without the app', () => {
  it('is confined to the top 18vh and fades out inside that box', () => {
    const { height, reachY } = glow();
    expect(height).toBeLessThanOrEqual(18);
    expect(reachY).toBeLessThanOrEqual(height);
  });

  it('is hidden once the live sky is drawing', () => {
    expect(rule('html[data-sky-live]::before,\nhtml[data-sky-live]::after')).toContain(
      'visibility: hidden',
    );
  });

  it.each(PHASES)('keeps the %s backdrop under MAX_SKY_LUMA across the whole zone', (phase) => {
    const { height, rgb, alpha } = glow();
    for (let pct = 0; pct <= height; pct++) {
      const behind = over(rgb, alpha, skyAt(phase, pct / 100));
      expect(luminance(behind), `${phase} at ${pct}vh`).toBeLessThanOrEqual(MAX_SKY_LUMA);
    }
  });

  it.each(PHASES)(
    'keeps white and secondary text at AA on the %s glass under the glow',
    (phase) => {
      const { top, bottom } = SKY_PALETTE[phase];
      const g = glassFor(over(hexToRgb(top), 0.5, hexToRgb(bottom)));
      const { height, rgb, alpha } = glow();
      for (let pct = 0; pct <= height; pct++) {
        const surface = over(g.rgb, g.alpha, over(rgb, alpha, skyAt(phase, pct / 100)));
        expect(contrastRatio(WHITE, surface), `white at ${pct}vh`).toBeGreaterThanOrEqual(4.5);
        expect(
          contrastRatio(over(WHITE, TEXT_SECONDARY_ALPHA, surface), surface),
          `secondary at ${pct}vh`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});

describe('static sky: the TL;DR plate on the article glass', () => {
  const layout = readFileSync('src/components/ArticleLayout.astro', 'utf8');
  const plate = /<section aria-labelledby="tldr-heading" class="([^"]*)"[\s\S]*?<\/section>/.exec(
    layout,
  );

  it('is a white/8 plate with full-white text only', () => {
    expect(plate, 'the TL;DR section').not.toBeNull();
    expect(plate![1]).toContain('bg-white/8');
    expect(plate![0]).not.toContain('text-text-muted');
  });

  it.each(PHASES)(
    'holds white text at AA on the %s glass over every worst-case backdrop',
    (phase) => {
      const { top, bottom } = SKY_PALETTE[phase];
      const g = glassFor(over(hexToRgb(top), 0.5, hexToRgb(bottom)));
      for (const behind of WORST_BACKGROUNDS) {
        const surface = over(WHITE, 0.08, over(g.rgb, g.alpha, behind));
        expect(contrastRatio(WHITE, surface)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});
