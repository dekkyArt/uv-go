import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VEIL_MAX_OPACITY } from '../components/SkyLayer';

/**
 * Spec 9.2 / 12.2: content sits on translucent surfaces (.sky-panel) over the sky, and text and
 * graphics stay AA on every phase, in both themes, with every weather overlay at full strength.
 * The numbers come straight from global.css, so a palette edit that breaks AA fails here.
 */
const css = readFileSync('src/styles/global.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

type Rgb = [number, number, number];
const THEMES = ['light', 'dark'] as const;
const PHASES = ['night', 'dawn', 'morning', 'day', 'golden', 'dusk'] as const;
const TEXT_AA = 4.5;
const GRAPHIC_AA = 3;

function themeVars(theme: (typeof THEMES)[number]): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const hit = selector.includes(`[data-theme='${theme}']`);
    if (!hit) continue;
    for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      vars[name] = value.trim();
    }
  }
  return vars;
}

const hex = (s: string): Rgb => {
  const m = /^#([0-9a-f]{6})$/i.exec(s.trim());
  if (!m) throw new Error(`not a #rrggbb colour: ${s}`);
  return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) as Rgb;
};
const channel = (v: number) => {
  const x = v / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
const luminance = (c: Rgb) =>
  0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);
const ratio = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const over = (top: Rgb, alpha: number, bottom: Rgb): Rgb =>
  top.map((v, i) => v * alpha + bottom[i] * (1 - alpha)) as Rgb;

describe.each(THEMES)('sky contrast, %s theme', (theme) => {
  const v = themeVars(theme);
  const stops = PHASES.flatMap((phase) => {
    const gradient = v[`--sky-${phase}`];
    expect(gradient, `--sky-${phase} is defined`).toBeDefined();
    return [...gradient.matchAll(/#[0-9a-f]{6}/gi)].map(([c]) => ({ name: phase, rgb: hex(c) }));
  });

  // Everything that can sit between the panel and the page background.
  const glowAlpha = Number(v['--sky-glow-alpha']);
  const flashAlpha = Number(v['--sky-flash-alpha']);
  const panelAlpha = Number(v['--sky-panel-alpha']);
  const skies = [
    ...stops.flatMap(({ name, rgb }) => [
      { name, rgb },
      { name: `${name}+glow`, rgb: over(hex(v['--sky-glow-color']), glowAlpha, rgb) },
      { name: `${name}+veil`, rgb: over(hex(v['--sky-veil-color']), VEIL_MAX_OPACITY, rgb) },
      { name: `${name}+flash`, rgb: over(hex(v['--sky-flash-color']), flashAlpha, rgb) },
    ]),
    { name: 'moon-hi', rgb: hex(v['--sky-moon-hi']) },
    { name: 'moon-lo', rgb: hex(v['--sky-moon-lo']) },
  ];

  const bg = hex(v['--uv-bg']);
  const panels = skies.map(({ name, rgb }) => ({ name, rgb: over(bg, panelAlpha, rgb) }));

  const checks: [string, number][] = [
    ['text', TEXT_AA],
    ['text-muted', TEXT_AA],
    ['verdict-green-text', TEXT_AA],
    ['verdict-yellow-text', TEXT_AA],
    ['verdict-red-text', TEXT_AA],
    ['focus', GRAPHIC_AA],
    ['night', GRAPHIC_AA],
    ['verdict-green', GRAPHIC_AA],
    ['verdict-yellow', GRAPHIC_AA],
    ['verdict-red', GRAPHIC_AA],
  ];

  it('keeps the panel mostly opaque', () => {
    expect(panelAlpha).toBeGreaterThanOrEqual(0.85);
    expect(panelAlpha).toBeLessThan(1);
  });

  it.each(checks)('%s stays at least AA on the panel over every sky', (token, min) => {
    const fg = hex(v[`--uv-${token}`]);
    for (const { name, rgb } of panels) {
      expect(ratio(fg, rgb), `${token} on panel over ${name}`).toBeGreaterThanOrEqual(min);
    }
  });
});
