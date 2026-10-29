import { describe, expect, it } from 'vitest';
import { contrastRatio, over, type Rgb } from '../contrast';
import { WORST_BACKGROUNDS } from '../glass';
import type { SkyPhase, SkyState, WeatherGroup } from '../sky';
import { MAX_SKY_LUMA, SKY_PALETTE, TEXT_SECONDARY_ALPHA } from '../skyPalette';
import {
  BASE_CLOUD_SPEED,
  glassTint,
  mixUniforms,
  skyUniforms,
  SUN_ZONE,
  WEATHER_TABLE,
  type SkyUniforms,
} from '../skyUniforms';

const PHASES = Object.keys(SKY_PALETTE) as SkyPhase[];
const WEATHERS = Object.keys(WEATHER_TABLE) as WeatherGroup[];
const WHITE: Rgb = [255, 255, 255];

const state = (patch: Partial<SkyState> = {}): SkyState => ({
  phase: 'day',
  weather: 'clear',
  uvGlow: 0.5,
  heat: false,
  wind: false,
  sunPosition: 0.5,
  ...patch,
});

function expectTextHolds(u: SkyUniforms) {
  const g = glassTint(u);
  expect(g.alpha).toBeLessThanOrEqual(0.8);
  // WORST_BACKGROUNDS includes the gray of luminance MAX_SKY_LUMA.
  for (const behind of WORST_BACKGROUNDS) {
    const surface = over(g.rgb, g.alpha, behind);
    expect(contrastRatio(WHITE, surface)).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(over(WHITE, TEXT_SECONDARY_ALPHA, surface), surface),
    ).toBeGreaterThanOrEqual(4.5);
  }
}

describe('skyUniforms', () => {
  it('covers 6 phases and 7 weather groups', () => {
    expect(PHASES).toHaveLength(6);
    expect(WEATHERS).toHaveLength(7);
  });

  it.each(WEATHERS)('takes %s cloud and precipitation fields from the weather table', (weather) => {
    const u = skyUniforms(state({ weather }));
    const t = WEATHER_TABLE[weather];
    expect({
      cloudCover: u.cloudCover,
      cloudDark: u.cloudDark,
      fog: u.fog,
      rain: u.rain,
      snow: u.snow,
      glassDrops: u.glassDrops,
    }).toEqual(t);
  });

  it('uses the spec table values', () => {
    expect(WEATHER_TABLE.thunder).toEqual({
      cloudCover: 1,
      cloudDark: 0.75,
      fog: 0.1,
      rain: 1,
      snow: 0,
      glassDrops: 0.8,
    });
    expect(WEATHER_TABLE.clear.cloudCover).toBe(0.08);
  });

  it.each(PHASES)('uses the %s palette for the gradient', (phase) => {
    const u = skyUniforms(state({ phase }));
    const hex = (c: Rgb) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    expect(hex(u.skyTop)).toBe(SKY_PALETTE[phase].top);
    expect(hex(u.skyBottom)).toBe(SKY_PALETTE[phase].bottom);
  });

  it('night: no sun, full moon, stars show through the gaps in the clouds', () => {
    const u = skyUniforms(state({ phase: 'night', weather: 'partly', uvGlow: 0.9 }));
    expect(u.sunIntensity).toBe(0);
    expect(u.moon).toBe(1);
    expect(u.stars).toBeCloseTo(1 - WEATHER_TABLE.partly.cloudCover);
  });

  it.each(['dawn', 'morning', 'day', 'golden', 'dusk'] as const)(
    '%s: no stars, no moon, sun glow from uv',
    (phase) => {
      const u = skyUniforms(state({ phase, uvGlow: 0.7 }));
      expect(u.stars).toBe(0);
      expect(u.moon).toBe(0);
      expect(u.sunIntensity).toBe(0.7);
    },
  );

  it('wind doubles the cloud speed', () => {
    expect(skyUniforms(state()).cloudSpeed).toBe(BASE_CLOUD_SPEED);
    expect(skyUniforms(state({ wind: true })).cloudSpeed).toBe(BASE_CLOUD_SPEED * 2);
  });

  it('heat maps to 0 or 1', () => {
    expect(skyUniforms(state({ heat: true })).heat).toBe(1);
    expect(skyUniforms(state()).heat).toBe(0);
  });

  it('thunder gates the flash flag', () => {
    for (const weather of WEATHERS) {
      expect(skyUniforms(state({ weather })).thunder).toBe(weather === 'thunder' ? 1 : 0);
    }
  });

  it('passes the luma cap and sun zone through', () => {
    const u = skyUniforms(state());
    expect(u.maxLuma).toBe(MAX_SKY_LUMA);
    expect(u.sunZone).toBe(SUN_ZONE);
  });

  it('keeps the sun inside the top sun zone for any sunPosition', () => {
    for (let i = 0; i <= 100; i++) {
      const [x, y] = skyUniforms(state({ sunPosition: i / 100 })).sunPos;
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThanOrEqual(SUN_ZONE);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
    }
  });

  it('moves the sun left to right and highest at noon', () => {
    const at = (p: number) => skyUniforms(state({ sunPosition: p })).sunPos;
    expect(at(0)[0]).toBeLessThan(at(0.5)[0]);
    expect(at(0.5)[0]).toBeLessThan(at(1)[0]);
    expect(at(0.5)[1]).toBeLessThan(at(0)[1]);
    expect(at(0.5)[1]).toBeLessThan(at(1)[1]);
  });

  it('clamps an out-of-range sunPosition', () => {
    expect(skyUniforms(state({ sunPosition: 2 })).sunPos).toEqual(
      skyUniforms(state({ sunPosition: 1 })).sunPos,
    );
    expect(skyUniforms(state({ sunPosition: -1 })).sunPos).toEqual(
      skyUniforms(state({ sunPosition: 0 })).sunPos,
    );
  });
});

describe('mixUniforms', () => {
  const a = skyUniforms(state({ phase: 'night', weather: 'clear' }));
  const b = skyUniforms(state({ phase: 'day', weather: 'rain', wind: true }));

  it('averages every field at t = 0.5', () => {
    const m = mixUniforms(a, b, 0.5);
    expect(m.rain).toBeCloseTo((a.rain + b.rain) / 2);
    expect(m.cloudSpeed).toBeCloseTo((a.cloudSpeed + b.cloudSpeed) / 2);
    expect(m.skyTop[0]).toBeCloseTo((a.skyTop[0] + b.skyTop[0]) / 2);
    expect(m.sunPos[1]).toBeCloseTo((a.sunPos[1] + b.sunPos[1]) / 2);
  });

  it('returns the endpoints at t = 0 and t = 1', () => {
    expect(mixUniforms(a, b, 0)).toEqual(a);
    expect(mixUniforms(a, b, 1)).toEqual(b);
  });
});

describe('glass from the sky', () => {
  const cases = PHASES.flatMap((phase) => WEATHERS.map((weather) => [phase, weather] as const));

  it.each(cases)('%s / %s keeps white and secondary text AA', (phase, weather) => {
    expectTextHolds(skyUniforms(state({ phase, weather })));
  });

  it('keeps AA in the middle of a swipe between neighbouring phases, any weathers', () => {
    PHASES.forEach((phase, i) => {
      const next = PHASES[(i + 1) % PHASES.length];
      for (const w1 of WEATHERS) {
        for (const w2 of WEATHERS) {
          const mixed = mixUniforms(
            skyUniforms(state({ phase, weather: w1 })),
            skyUniforms(state({ phase: next, weather: w2 })),
            0.5,
          );
          expectTextHolds(mixed);
        }
      }
    });
  });

  it('gives darker glass for rain than for clear', () => {
    const clear = glassTint(skyUniforms(state({ weather: 'clear' })));
    const rain = glassTint(skyUniforms(state({ weather: 'rain' })));
    expect(rain.rgb[0] + rain.rgb[1] + rain.rgb[2]).toBeLessThan(
      clear.rgb[0] + clear.rgb[1] + clear.rgb[2],
    );
  });
});
