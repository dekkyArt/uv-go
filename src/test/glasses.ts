import { hexToRgb, over } from '../domain/contrast';
import { glassFor, type Glass } from '../domain/glass';
import type { SkyPhase, WeatherGroup } from '../domain/sky';
import { glassTint, skyUniforms, WEATHER_TABLE } from '../domain/skyUniforms';
import { SKY_PALETTE } from '../domain/skyPalette';

const PHASES = Object.keys(SKY_PALETTE) as SkyPhase[];
const WEATHERS = Object.keys(WEATHER_TABLE) as WeatherGroup[];

/**
 * Every glass the page can show: the CSS one of each phase (global.css), and the live one the
 * WebGL sky sets for each phase and weather (glassTint).
 */
export const GLASSES: Glass[] = [
  ...PHASES.map((phase) => {
    const { top, bottom } = SKY_PALETTE[phase];
    return glassFor(over(hexToRgb(top), 0.5, hexToRgb(bottom)));
  }),
  ...PHASES.flatMap((phase) =>
    WEATHERS.map((weather) =>
      glassTint(
        skyUniforms({ phase, weather, uvGlow: 1, heat: false, wind: false, sunPosition: 0.5 }),
      ),
    ),
  ),
];
