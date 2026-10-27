import { describe, expect, it } from 'vitest';
import { articlePhase, skyPhase, skyState, sunPosition, weatherGroup } from '../sky';
import { makeDay } from './factories';

// sunrise 06:00 = 360, sunset 21:00 = 1260, solarNoon 13:30 = 810.
const SUNRISE = '2026-06-21T06:00';
const SUNSET = '2026-06-21T21:00';

describe('skyPhase', () => {
  it.each([
    [300, 'night'],
    [315, 'dawn'],
    [405, 'morning'],
    [690, 'day'],
    [1170, 'golden'],
    [1245, 'dusk'],
    [1305, 'night'],
  ] as const)('minute %i is %s (start of a phase is inclusive)', (minutes, phase) => {
    expect(skyPhase(minutes, SUNRISE, SUNSET, true)).toBe(phase);
  });

  it('is night just before dawn and day just before golden', () => {
    expect(skyPhase(314, SUNRISE, SUNSET, false)).toBe('night');
    expect(skyPhase(689, SUNRISE, SUNSET, true)).toBe('morning');
    expect(skyPhase(1169, SUNRISE, SUNSET, true)).toBe('day');
    expect(skyPhase(1244, SUNRISE, SUNSET, true)).toBe('golden');
    expect(skyPhase(1304, SUNRISE, SUNSET, false)).toBe('dusk');
  });
});

describe('weatherGroup', () => {
  it.each([
    [0, 'clear'],
    [1, 'clear'],
    [2, 'partly'],
    [3, 'overcast'],
    [45, 'fog'],
    [48, 'fog'],
    [51, 'rain'],
    [67, 'rain'],
    [80, 'rain'],
    [82, 'rain'],
    [71, 'snow'],
    [77, 'snow'],
    [85, 'snow'],
    [86, 'snow'],
    [95, 'thunder'],
    [99, 'thunder'],
  ] as const)('code %i is %s', (code, group) => {
    expect(weatherGroup(code, null)).toBe(group);
  });

  it('falls back to cloud cover when the code is null', () => {
    expect(weatherGroup(null, 10)).toBe('clear');
    expect(weatherGroup(null, 50)).toBe('partly');
    expect(weatherGroup(null, 80)).toBe('overcast');
    expect(weatherGroup(null, 24)).toBe('clear');
    expect(weatherGroup(null, 25)).toBe('partly');
    expect(weatherGroup(null, 69)).toBe('partly');
    expect(weatherGroup(null, 70)).toBe('overcast');
    expect(weatherGroup(null, null)).toBe('clear');
  });

  it('uses cloud cover for a code outside the map', () => {
    expect(weatherGroup(4, 80)).toBe('overcast');
  });
});

describe('sunPosition', () => {
  it('is the share of the way between sunrise and sunset', () => {
    expect(sunPosition(360, SUNRISE, SUNSET, true)).toBe(0);
    expect(sunPosition(1260, SUNRISE, SUNSET, true)).toBe(1);
    expect(sunPosition(810, SUNRISE, SUNSET, true)).toBe(0.5);
  });

  it('clamps outside daylight', () => {
    expect(sunPosition(200, SUNRISE, SUNSET, false)).toBe(0);
    expect(sunPosition(1400, SUNRISE, SUNSET, false)).toBe(1);
  });
});

describe('falls back to isDay when sunrise/sunset invalid', () => {
  const cases: [string, string | null, string | null][] = [
    ['sunrise null', null, SUNSET],
    ['sunset null', SUNRISE, null],
    ['unparsable sunrise', 'never', SUNSET],
    ['unparsable sunset', SUNRISE, '25:99'],
    ['sunrise after sunset', SUNSET, SUNRISE],
    ['sunrise equals sunset', SUNRISE, SUNRISE],
    ['dates differ', '2026-06-21T06:00', '2026-06-22T21:00'],
  ];

  it.each(cases)('%s', (_name, sunrise, sunset) => {
    expect(skyPhase(720, sunrise, sunset, true)).toBe('day');
    expect(skyPhase(720, sunrise, sunset, false)).toBe('night');
    expect(sunPosition(720, sunrise, sunset, true)).toBe(0.5);
    expect(sunPosition(720, sunrise, sunset, false)).toBe(0);
  });

  it('skyState falls back when the sun times belong to another date', () => {
    const day = makeDay({}, { sunrise: '2026-10-26T06:30', sunset: '2026-10-26T19:30' });
    expect(skyState(12, day).phase).toBe('day');
    expect(skyState(12, day).sunPosition).toBe(0.5);
    expect(skyState(3, day).phase).toBe('night');
    expect(skyState(3, day).sunPosition).toBe(0);
  });

  it('skyState falls back for polar day and night', () => {
    const polarDay = makeDay({ 3: { isDay: true } }, { sunrise: '', sunset: '' });
    expect(skyState(3, polarDay).phase).toBe('day');
    const polarNight = makeDay({ 12: { isDay: false } }, { sunrise: '', sunset: '' });
    expect(skyState(12, polarNight).phase).toBe('night');
    expect(skyState(12, polarNight).sunPosition).toBe(0);
  });
});

describe('skyState', () => {
  // makeDay: 2026-10-27, sunrise 06:30 (390), sunset 19:30 (1170).
  it('combines phase, weather, glow and sun position for the reference hour', () => {
    const day = makeDay({ 13: { uv: 5.5, weatherCode: 61, feelsLike: 18, windKmh: 10 } });
    const s = skyState(13, day);
    expect(s.phase).toBe('day');
    expect(s.weather).toBe('rain');
    expect(s.uvGlow).toBeCloseTo(6 / 11);
    expect(s.heat).toBe(false);
    expect(s.wind).toBe(false);
    expect(s.sunPosition).toBeCloseTo((780 - 390) / (1170 - 390));
  });

  it('uvGlow rounds half up and clamps to 0..1', () => {
    const glow = (uv: number | null) => skyState(12, makeDay({ 12: { uv } })).uvGlow;
    expect(glow(0)).toBe(0);
    expect(glow(5.5)).toBeCloseTo(6 / 11);
    expect(glow(11)).toBe(1);
    expect(glow(14)).toBe(1);
    expect(glow(null)).toBe(0);
  });

  it('heat starts at feels-like 30 and wind at 40 km/h', () => {
    const at = (feelsLike: number | null, windKmh: number | null) =>
      skyState(12, makeDay({ 12: { feelsLike, windKmh } }));
    expect(at(29.9, 39.9)).toMatchObject({ heat: false, wind: false });
    expect(at(30, 40)).toMatchObject({ heat: true, wind: true });
    expect(at(null, null)).toMatchObject({ heat: false, wind: false });
  });

  it('uses cloud cover when the weather code is missing', () => {
    const day = makeDay({ 12: { weatherCode: null, cloudCover: 90 } });
    expect(skyState(12, day).weather).toBe('overcast');
  });
});

describe('articlePhase', () => {
  it('uses the fallback sunrise 06:30 and sunset 19:30', () => {
    expect(articlePhase(5, 0)).toBe('night');
    expect(articlePhase(7, 0)).toBe('dawn');
    expect(articlePhase(12, 0)).toBe('day');
    expect(articlePhase(23, 0)).toBe('night');
  });
});
