import { describe, expect, it } from 'vitest';
import { contrastRatio, luminance, over, type Rgb } from '../../domain/contrast';
import { WORST_BACKGROUNDS } from '../../domain/glass';
import { MAX_SKY_LUMA, TEXT_SECONDARY_ALPHA } from '../../domain/skyPalette';
import { SUN_ZONE } from '../../domain/skyUniforms';
import { FRAGMENT_SRC } from '../sky/shader';
import { GLASSES } from '../../test/glasses';

/**
 * The pinned bar (0–56 px) and the card titles stuck under it sit in the sun zone, where the
 * shader lets the sun's `light` past the luminance cap. `uTopCap` follows the bar's opacity: at 1
 * the zone gives up its light and is clamped like the rest of the screen. This mirrors the
 * shader's last colour steps (checked line by line against the source below) and proves the
 * glass text over the result.
 */
const WHITE: Rgb = [255, 255, 255];
const TEXT_AA = 4.5;
type Vec3 = [number, number, number];

const HEADROOM = Number(/#define LUMA_HEADROOM ([\d.]+)/.exec(FRAGMENT_SRC)?.[1]);
const LUMA: Vec3 = [0.2126, 0.7152, 0.0722];
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const toLinear = (c: number) => (c < 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c < 0.00304 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

/** The shader from `col += light ...` to the output, in sRGB 0–1, at height `y` (from the top). */
function output(col: Vec3, light: Vec3, y: number, topCap: number): Vec3 {
  const cap = MAX_SKY_LUMA * HEADROOM;
  let c = col.map((v, i) => v + light[i] * (1 - topCap)) as Vec3;
  const capped = Math.max(y >= SUN_ZONE ? 1 : 0, topCap);
  if (capped > 0) {
    c = c.map(clamp01) as Vec3;
    const lin = c.map(toLinear) as Vec3;
    const k = Math.min(1, cap / Math.max(dot(lin, LUMA), 1e-4));
    const target = lin.map((v) => toSrgb(v * k));
    c = c.map((v, i) => v + (target[i] - v) * capped) as Vec3;
  }
  return c.map(clamp01) as Vec3;
}

const to255 = (c: Vec3): Rgb => c.map((v) => v * 255) as Rgb;
const to01 = (c: Rgb): Vec3 => c.map((v) => v / 255) as Vec3;

/** The sun's disc and core glow at full strength, and the moon's disc (shader layer 3). */
const SUN_COL: Vec3 = [1, 0.93, 0.8];
const LIGHTS: Vec3[] = [
  SUN_COL.map((v) => v * (1 + 0.75)) as Vec3,
  ([0.93, 0.95, 1] as Vec3).map((v) => v * 0.92) as Vec3,
];
/** Skies under the light: the worst-case backgrounds, the sun's own warm tint, and white. */
const SKIES: Vec3[] = [...WORST_BACKGROUNDS.map(to01), SUN_COL, [1, 1, 1]];
const IN_ZONE = SUN_ZONE / 2;

describe('the sun zone under the pinned bar', () => {
  it('mirrors the shader source', () => {
    expect(HEADROOM).toBeGreaterThan(0);
    expect(FRAGMENT_SRC).toMatch(/uniform float uTopCap;/);
    expect(FRAGMENT_SRC).toContain('col += light * (1.0 - uTopCap);');
    expect(FRAGMENT_SRC).toContain('float capped = max(step(uSunZone, uv.y), uTopCap);');
    expect(FRAGMENT_SRC).toContain(
      'col = mix(col, toSrgb(lin * min(1.0, cap / max(dot(lin, LUMA), 1e-4))), capped);',
    );
    expect(FRAGMENT_SRC).toContain(
      'vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.03928, c)); }',
    );
    expect(FRAGMENT_SRC).toContain(
      'vec3 toSrgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.00304, c)); }',
    );
    expect(FRAGMENT_SRC).toContain('#define LUMA vec3(0.2126, 0.7152, 0.0722)');
  });

  it('lets the sun past the cap without the bar: the hole the top cap closes', () => {
    const lit = output(to01(WORST_BACKGROUNDS[0]), LIGHTS[0], IN_ZONE, 0);
    expect(luminance(to255(lit))).toBeGreaterThan(MAX_SKY_LUMA);
  });

  it('holds the cap in the zone once the bar is in, whatever the sky and the light', () => {
    for (const sky of SKIES)
      for (const light of LIGHTS)
        expect(luminance(to255(output(sky, light, IN_ZONE, 1)))).toBeLessThanOrEqual(MAX_SKY_LUMA);
  });

  it('keeps white and secondary glass text at AA there, on every glass', () => {
    let worst = Infinity;
    for (const sky of SKIES)
      for (const light of LIGHTS) {
        const behind = to255(output(sky, light, IN_ZONE, 1));
        for (const g of GLASSES) {
          const surface = over(g.rgb, g.alpha, behind);
          worst = Math.min(
            worst,
            contrastRatio(WHITE, surface),
            contrastRatio(over(WHITE, TEXT_SECONDARY_ALPHA, surface), surface),
          );
        }
      }
    expect(worst).toBeGreaterThanOrEqual(TEXT_AA);
  });

  it('changes nothing below the zone, where the cap always holds', () => {
    for (const topCap of [0, 0.5, 1])
      expect(luminance(to255(output([1, 1, 1], LIGHTS[0], 0.5, topCap)))).toBeLessThanOrEqual(
        MAX_SKY_LUMA,
      );
  });
});
