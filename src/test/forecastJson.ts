type Series = (number | null)[];

export interface ForecastJsonOptions {
  date?: string;
  offsetSeconds?: number;
  /** Per-array overrides; each must be a full 48-length array. */
  hourly?: Partial<Record<string, Series>>;
}

const pad = (n: number) => String(n).padStart(2, '0');

function nextDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Synthetic 48-hour Open-Meteo-shaped response (today + tomorrow) for tests. */
export function makeForecastJson(opts: ForecastJsonOptions = {}): Record<string, unknown> {
  const date = opts.date ?? '2026-10-27';
  const dates = [date, nextDate(date)];
  const hours = Array.from({ length: 48 }, (_, i) => i % 24);
  const fill = (v: number): Series => hours.map(() => v);

  const hourly: Record<string, unknown> = {
    time: hours.map((h, i) => `${dates[Math.floor(i / 24)]}T${pad(h)}:00`),
    uv_index: fill(0),
    precipitation_probability: fill(0),
    apparent_temperature: fill(20),
    wind_speed_10m: fill(5),
    is_day: hours.map((h) => (h >= 7 && h <= 19 ? 1 : 0)),
    weather_code: fill(0),
    cloud_cover: fill(0),
  };
  for (const [key, series] of Object.entries(opts.hourly ?? {})) {
    hourly[key] = series;
  }

  return {
    utc_offset_seconds: opts.offsetSeconds ?? 0,
    timezone: 'Europe/Lisbon',
    hourly,
    daily: {
      time: dates,
      sunrise: dates.map((d) => `${d}T06:30`),
      sunset: dates.map((d) => `${d}T19:30`),
    },
  };
}
