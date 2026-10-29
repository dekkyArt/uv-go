import type { Rgb } from './contrast';
import type { WeatherGroup } from './sky';

export interface WeatherLook {
  cloudCover: number;
  cloudDark: number;
  fog: number;
  rain: number;
  snow: number;
  glassDrops: number;
}

/** Starting values per weather group (spec 6.3). */
export const WEATHER_TABLE: Record<WeatherGroup, WeatherLook> = {
  clear: { cloudCover: 0.08, cloudDark: 0, fog: 0, rain: 0, snow: 0, glassDrops: 0 },
  partly: { cloudCover: 0.45, cloudDark: 0.05, fog: 0, rain: 0, snow: 0, glassDrops: 0 },
  overcast: { cloudCover: 0.85, cloudDark: 0.35, fog: 0.1, rain: 0, snow: 0, glassDrops: 0 },
  fog: { cloudCover: 0.6, cloudDark: 0.2, fog: 0.8, rain: 0, snow: 0, glassDrops: 0 },
  rain: { cloudCover: 0.95, cloudDark: 0.55, fog: 0.15, rain: 0.7, snow: 0, glassDrops: 0.6 },
  snow: { cloudCover: 0.8, cloudDark: 0.25, fog: 0.1, rain: 0, snow: 0.7, glassDrops: 0 },
  thunder: { cloudCover: 1, cloudDark: 0.75, fog: 0.1, rain: 1, snow: 0, glassDrops: 0.8 },
};

/** Bottom of the sun zone, as a fraction of screen height from the top: the sun never goes lower. */
export const SUN_ZONE = 0.18;

/** Cloud drift in the shader; wind doubles it. */
export const BASE_CLOUD_SPEED = 0.02;

/** The sun crosses x from `xMin` to `xMax` along an arc: y (from the top) is `yLow` at the horizon, `yHigh` at noon. */
export const SUN_ARC = { xMin: 0.1, xMax: 0.9, yLow: 0.16, yHigh: 0.06 };

/** Glass tint: the sky's mean colour is greyed by clouds, then darkened by dark clouds. */
export const GLASS_SKY = {
  cloudGray: [0x8a, 0x96, 0xa8] as Rgb,
  /** Share of cloud cover mixed into the gray. */
  cloudMix: 0.6,
  /** Share of cloud darkness taken off the brightness. */
  darkMix: 0.5,
};
