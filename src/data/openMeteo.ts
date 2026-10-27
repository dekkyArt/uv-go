import type { DayForecast, HourData } from '../domain/types';
import { ForecastError, type Forecast } from './types';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const HOURLY_FIELDS =
  'uv_index,precipitation_probability,apparent_temperature,wind_speed_10m,is_day,weather_code,cloud_cover';

export function buildForecastUrl(lat: number, lon: number): string {
  return `${BASE_URL}?latitude=${lat}&longitude=${lon}&hourly=${HOURLY_FIELDS}&daily=sunrise,sunset&timezone=auto&forecast_days=2`;
}

type Series = unknown[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function seriesOf(obj: Record<string, unknown>, key: string, length: number): Series {
  const value = obj[key];
  if (!Array.isArray(value) || value.length < length) {
    throw new ForecastError(`Forecast response is missing "${key}"`);
  }
  return value;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

const pad = (n: number) => String(n).padStart(2, '0');

function emptyHour(date: string, hour: number): HourData {
  return {
    time: `${date}T${pad(hour)}:00`,
    hour,
    uv: null,
    rainProb: null,
    feelsLike: null,
    windKmh: null,
    isDay: false,
    weatherCode: null,
    cloudCover: null,
  };
}

export function mapForecast(json: unknown): Forecast {
  if (!isRecord(json) || !isRecord(json.hourly) || !isRecord(json.daily)) {
    throw new ForecastError('Unexpected forecast response');
  }
  const { hourly, daily } = json;

  const times = hourly.time;
  if (!Array.isArray(times)) throw new ForecastError('Forecast response is missing "time"');
  const n = times.length;
  const uv = seriesOf(hourly, 'uv_index', n);
  const rain = seriesOf(hourly, 'precipitation_probability', n);
  const feels = seriesOf(hourly, 'apparent_temperature', n);
  const wind = seriesOf(hourly, 'wind_speed_10m', n);
  const isDay = seriesOf(hourly, 'is_day', n);
  const code = seriesOf(hourly, 'weather_code', n);
  const cloud = seriesOf(hourly, 'cloud_cover', n);

  // Group by the date prefix of `time` (DST days have 23/25 entries), place by hour number.
  const byDate = new Map<string, Map<number, number>>();
  times.forEach((t, i) => {
    const match = typeof t === 'string' ? /^(\d{4}-\d{2}-\d{2})T(\d{2}):/.exec(t) : null;
    if (!match) return;
    const hour = Number(match[2]);
    if (hour < 0 || hour > 23) return;
    const slots = byDate.get(match[1]) ?? new Map<number, number>();
    if (!slots.has(hour)) slots.set(hour, i); // duplicate hour: keep the first
    byDate.set(match[1], slots);
  });
  const dates = [...byDate.keys()].slice(0, 2);
  if (dates.length < 2) throw new ForecastError('Forecast response has fewer than 2 days');

  const dailyTimes = seriesOf(daily, 'time', 0);
  const sunrises = seriesOf(daily, 'sunrise', dailyTimes.length);
  const sunsets = seriesOf(daily, 'sunset', dailyTimes.length);

  const days = dates.map((date): DayForecast => {
    const slots = byDate.get(date)!;
    const hours = Array.from({ length: 24 }, (_, hour): HourData => {
      const i = slots.get(hour);
      if (i === undefined) return emptyHour(date, hour);
      return {
        time: `${date}T${pad(hour)}:00`,
        hour,
        uv: num(uv[i]),
        rainProb: num(rain[i]),
        feelsLike: num(feels[i]),
        windKmh: num(wind[i]),
        isDay: isDay[i] === 1,
        weatherCode: num(code[i]),
        cloudCover: num(cloud[i]),
      };
    });
    const d = dailyTimes.indexOf(date);
    const sunrise = sunrises[d];
    const sunset = sunsets[d];
    if (d < 0 || typeof sunrise !== 'string' || typeof sunset !== 'string') {
      throw new ForecastError(`Forecast response has no sunrise/sunset for ${date}`);
    }
    return { date, hours, sunrise, sunset };
  });

  if (typeof json.utc_offset_seconds !== 'number' || typeof json.timezone !== 'string') {
    throw new ForecastError('Forecast response is missing time zone info');
  }

  return {
    days: [days[0], days[1]],
    utcOffsetSeconds: json.utc_offset_seconds,
    timezone: json.timezone,
  };
}

const cache = new Map<string, Forecast>();

export function clearForecastCache(): void {
  cache.clear();
}

function isAbortError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError'
  );
}

export async function getForecast(
  lat: number,
  lon: number,
  opts: { signal?: AbortSignal; force?: boolean } = {},
): Promise<Forecast> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  if (!opts.force) {
    const hit = cache.get(key);
    if (hit) return hit;
  }

  let json: unknown;
  try {
    const res = await fetch(buildForecastUrl(Number(lat.toFixed(2)), Number(lon.toFixed(2))), {
      signal: opts.signal,
    });
    if (!res.ok) throw new ForecastError(`Forecast request failed (${res.status})`);
    json = await res.json();
  } catch (err) {
    if (isAbortError(err)) throw err;
    if (err instanceof ForecastError) throw err;
    throw new ForecastError('Forecast request failed', { cause: err });
  }

  const forecast = mapForecast(json);
  cache.set(key, forecast);
  return forecast;
}
