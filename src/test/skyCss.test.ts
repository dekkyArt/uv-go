import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, hexToRgb, over, type Rgb } from '../domain/contrast';
import { glassFor } from '../domain/glass';
import type { SkyPhase } from '../domain/sky';
import { SKY_PALETTE, TEXT_SECONDARY_ALPHA } from '../domain/skyPalette';

/** global.css carries the same palette and glass numbers the domain modules compute and test. */
const css = readFileSync('src/styles/global.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const WHITE: Rgb = [255, 255, 255];
const PHASES = Object.keys(SKY_PALETTE) as SkyPhase[];

describe('global.css sky tokens', () => {
  it.each(PHASES)('--sky-%s is the palette gradient', (phase) => {
    const { top, bottom } = SKY_PALETTE[phase];
    const m = new RegExp(`--sky-${phase}:\\s*([^;]+);`).exec(css);
    expect(m, `--sky-${phase} is defined`).not.toBeNull();
    expect(m![1].replace(/\s+/g, ' ').trim()).toBe(
      `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)`,
    );
  });

  it.each(PHASES)('html[data-sky-phase=%s] sets the glass computed for that phase', (phase) => {
    const { top, bottom } = SKY_PALETTE[phase];
    const g = glassFor(over(hexToRgb(top), 0.5, hexToRgb(bottom)));
    const m = new RegExp(`html\\[data-sky-phase='${phase}'\\]\\s*\\{([^}]*)\\}`).exec(css);
    expect(m, `a rule for ${phase}`).not.toBeNull();
    const body = m![1];
    expect(/--glass-rgb:\s*([^;]+);/.exec(body)?.[1].trim()).toBe(g.rgb.join(' '));
    expect(Number(/--glass-alpha:\s*([^;]+);/.exec(body)?.[1])).toBe(g.alpha);
  });

  it.each(PHASES)('the %s glass in the CSS holds AA over the CSS sky gradient', (phase) => {
    const gradient = new RegExp(`--sky-${phase}:\\s*([^;]+);`).exec(css)![1];
    const stops = [...gradient.matchAll(/#[0-9a-f]{6}/gi)].map(([c]) => hexToRgb(c));
    const body = new RegExp(`html\\[data-sky-phase='${phase}'\\]\\s*\\{([^}]*)\\}`).exec(css)![1];
    const rgb = /--glass-rgb:\s*([^;]+);/.exec(body)![1].trim().split(/\s+/).map(Number) as Rgb;
    const alpha = Number(/--glass-alpha:\s*([^;]+);/.exec(body)![1]);
    const behinds = [...stops, over(stops[0], 0.5, stops[stops.length - 1])];
    for (const behind of behinds) {
      const surface = over(rgb, alpha, behind);
      expect(contrastRatio(WHITE, surface), `white over ${behind}`).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(over(WHITE, TEXT_SECONDARY_ALPHA, surface), surface),
        `secondary over ${behind}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('has no theme switch left', () => {
    expect(css).not.toContain('data-theme');
    expect(css).not.toContain('@custom-variant dark');
  });
});
