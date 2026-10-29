import { hexToRgb, over, type Rgb } from './contrast';
import { glassFor, type Glass } from './glass';
import type { SkyState } from './sky';
import {
  BASE_CLOUD_SPEED,
  GLASS_SKY,
  SUN_ARC,
  SUN_ZONE,
  WEATHER_TABLE,
} from './skyUniforms.config';
import { MAX_SKY_LUMA, SKY_PALETTE } from './skyPalette';

export { BASE_CLOUD_SPEED, SUN_ZONE, WEATHER_TABLE };

export interface SkyUniforms {
  skyTop: Rgb;
  skyBottom: Rgb;
  /** Screen fractions, y measured from the top. */
  sunPos: [number, number];
  sunIntensity: number;
  moon: number;
  stars: number;
  cloudCover: number;
  cloudDark: number;
  cloudSpeed: number;
  fog: number;
  rain: number;
  snow: number;
  glassDrops: number;
  heat: number;
  thunder: number;
  maxLuma: number;
  sunZone: number;
}

export function skyUniforms(s: SkyState): SkyUniforms {
  const look = WEATHER_TABLE[s.weather];
  const { top, bottom } = SKY_PALETTE[s.phase];
  const night = s.phase === 'night';
  const p = Math.min(1, Math.max(0, s.sunPosition));
  return {
    skyTop: hexToRgb(top),
    skyBottom: hexToRgb(bottom),
    // A shallow arc inside the top SUN_ZONE: lowest at sunrise/sunset, highest at noon.
    sunPos: [
      SUN_ARC.xMin + (SUN_ARC.xMax - SUN_ARC.xMin) * p,
      SUN_ARC.yLow - (SUN_ARC.yLow - SUN_ARC.yHigh) * Math.sin(Math.PI * p),
    ],
    sunIntensity: night ? 0 : s.uvGlow,
    moon: night ? 1 : 0,
    stars: night ? 1 - look.cloudCover : 0,
    cloudCover: look.cloudCover,
    cloudDark: look.cloudDark,
    cloudSpeed: s.wind ? BASE_CLOUD_SPEED * 2 : BASE_CLOUD_SPEED,
    fog: look.fog,
    rain: look.rain,
    snow: look.snow,
    glassDrops: look.glassDrops,
    heat: s.heat ? 1 : 0,
    thunder: s.weather === 'thunder' ? 1 : 0,
    maxLuma: MAX_SKY_LUMA,
    sunZone: SUN_ZONE,
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpRgb = (a: Rgb, b: Rgb, t: number): Rgb => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

/** Linear blend of every field: the sky follows the pager. */
export function mixUniforms(a: SkyUniforms, b: SkyUniforms, t: number): SkyUniforms {
  return {
    skyTop: lerpRgb(a.skyTop, b.skyTop, t),
    skyBottom: lerpRgb(a.skyBottom, b.skyBottom, t),
    sunPos: [lerp(a.sunPos[0], b.sunPos[0], t), lerp(a.sunPos[1], b.sunPos[1], t)],
    sunIntensity: lerp(a.sunIntensity, b.sunIntensity, t),
    moon: lerp(a.moon, b.moon, t),
    stars: lerp(a.stars, b.stars, t),
    cloudCover: lerp(a.cloudCover, b.cloudCover, t),
    cloudDark: lerp(a.cloudDark, b.cloudDark, t),
    cloudSpeed: lerp(a.cloudSpeed, b.cloudSpeed, t),
    fog: lerp(a.fog, b.fog, t),
    rain: lerp(a.rain, b.rain, t),
    snow: lerp(a.snow, b.snow, t),
    glassDrops: lerp(a.glassDrops, b.glassDrops, t),
    heat: lerp(a.heat, b.heat, t),
    thunder: lerp(a.thunder, b.thunder, t),
    maxLuma: lerp(a.maxLuma, b.maxLuma, t),
    sunZone: lerp(a.sunZone, b.sunZone, t),
  };
}

/** Glass for this sky: its mean colour, greyed by clouds, darkened by dark clouds, then `glassFor`. */
export function glassTint(u: SkyUniforms): Glass {
  const mean = over(u.skyTop, 0.5, u.skyBottom);
  const greyed = over(GLASS_SKY.cloudGray, u.cloudCover * GLASS_SKY.cloudMix, mean);
  const k = 1 - GLASS_SKY.darkMix * u.cloudDark;
  return glassFor(greyed.map((v) => v * k) as Rgb);
}
