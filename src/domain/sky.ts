import { rules } from './rules.config';
import { roundHalfUp } from './scoring';
import { skyConfig } from './sky.config';
import type { DayForecast } from './types';

export type SkyPhase = 'night' | 'dawn' | 'morning' | 'day' | 'golden' | 'dusk';
export type WeatherGroup = 'clear' | 'partly' | 'overcast' | 'fog' | 'rain' | 'snow' | 'thunder';

export interface SkyState {
  phase: SkyPhase;
  weather: WeatherGroup;
  uvGlow: number; // 0..1
  heat: boolean;
  wind: boolean;
  sunPosition: number; // 0..1
}

interface Sun {
  rise: number; // minutes since local midnight
  set: number;
}

interface Clock {
  date: string | null; // 'YYYY-MM-DD', null for a bare 'HH:MM'
  minutes: number;
}

// Accepts Open-Meteo local ISO ('YYYY-MM-DDTHH:MM') and bare 'HH:MM'.
const CLOCK = /^(?:(\d{4}-\d{2}-\d{2})T)?(\d{2}):(\d{2})$/;

function parseClock(value: string | null): Clock | null {
  const m = value === null ? null : CLOCK.exec(value);
  if (!m) return null;
  const hours = Number(m[2]);
  const mins = Number(m[3]);
  if (hours >= 24 || mins >= skyConfig.minutesPerHour) return null;
  return { date: m[1] ?? null, minutes: hours * skyConfig.minutesPerHour + mins };
}

// Usable sunrise/sunset, or null (polar day/night, missing data, wrong date).
// `dates` are extra dates (the day, the reference hour) the sun times must belong to.
function resolveSun(
  sunrise: string | null,
  sunset: string | null,
  dates: string[] = [],
): Sun | null {
  const rise = parseClock(sunrise);
  const set = parseClock(sunset);
  if (!rise || !set) return null;
  if (rise.date !== set.date) return null;
  if (rise.date !== null && dates.some((d) => d !== rise.date)) return null;
  if (rise.minutes >= set.minutes) return null;
  return { rise: rise.minutes, set: set.minutes };
}

function phaseAt(minutes: number, sun: Sun | null, isDay: boolean): SkyPhase {
  if (!sun) return isDay ? 'day' : 'night';
  const o = skyConfig.offsets;
  const solarNoon = (sun.rise + sun.set) / 2;
  if (minutes < sun.rise - o.dawn) return 'night';
  if (minutes < sun.rise + o.dawn) return 'dawn';
  if (minutes < solarNoon - o.solarNoonDayStart) return 'morning';
  if (minutes < sun.set - o.golden) return 'day';
  if (minutes < sun.set - o.duskStart) return 'golden';
  if (minutes < sun.set + o.duskEnd) return 'dusk';
  return 'night';
}

function positionAt(minutes: number, sun: Sun | null, isDay: boolean): number {
  if (!sun) return isDay ? skyConfig.fallbackSunPosition.day : skyConfig.fallbackSunPosition.night;
  const share = (minutes - sun.rise) / (sun.set - sun.rise);
  return Math.min(1, Math.max(0, share));
}

export function skyPhase(
  minutes: number,
  sunrise: string | null,
  sunset: string | null,
  isDay: boolean,
): SkyPhase {
  return phaseAt(minutes, resolveSun(sunrise, sunset), isDay);
}

// Same formula as the sun on the timeline arc.
export function sunPosition(
  minutes: number,
  sunrise: string | null,
  sunset: string | null,
  isDay: boolean,
): number {
  return positionAt(minutes, resolveSun(sunrise, sunset), isDay);
}

export function weatherGroup(code: number | null, cloudCover: number | null): WeatherGroup {
  if (code !== null) {
    const hit = skyConfig.weatherGroups.find((r) => code >= r.from && code <= r.to);
    if (hit) return hit.group;
  }
  if (cloudCover === null || cloudCover < skyConfig.cloudCover.clearBelow) return 'clear';
  return cloudCover < skyConfig.cloudCover.partlyBelow ? 'partly' : 'overcast';
}

function uvGlow(uv: number | null): number {
  if (uv === null) return 0;
  const max = skyConfig.uvGlowMax;
  return Math.min(Math.max(roundHalfUp(uv), 0), max) / max;
}

// A reference hour with no entry (should not happen: days are padded to 24 hours)
// is treated as clear weather and night for the isDay fallback.
export function skyState(refHour: number, day: DayForecast): SkyState {
  const hour = day.hours.find((h) => h.hour === refHour);
  const minutes = refHour * skyConfig.minutesPerHour;
  const isDay = hour?.isDay ?? false;
  const dates = hour ? [day.date, hour.time.slice(0, day.date.length)] : [day.date];
  const sun = resolveSun(day.sunrise, day.sunset, dates);
  return {
    phase: phaseAt(minutes, sun, isDay),
    weather: weatherGroup(hour?.weatherCode ?? null, hour?.cloudCover ?? null),
    uvGlow: uvGlow(hour?.uv ?? null),
    heat: hour?.feelsLike != null && hour.feelsLike >= rules.heat.min,
    wind: hour?.windKmh != null && hour.windKmh >= rules.wind.min,
    sunPosition: positionAt(minutes, sun, isDay),
  };
}

// Static article pages: no location, assumed sun times from config.
export function articlePhase(hour: number, minute: number): SkyPhase {
  const { sunrise, sunset } = skyConfig.articleFallback;
  return skyPhase(hour * skyConfig.minutesPerHour + minute, sunrise, sunset, true);
}
