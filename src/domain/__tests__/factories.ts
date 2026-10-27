import { hourVerdict, scoreHour } from '../scoring';
import type { Activity, DayForecast, HourData, ScoredHour } from '../types';

const pad = (n: number) => String(n).padStart(2, '0');

export function makeHour(p: Partial<HourData> & { hour: number }): HourData {
  return {
    uv: 0,
    rainProb: 0,
    feelsLike: 20,
    windKmh: 5,
    isDay: true,
    weatherCode: 0,
    cloudCover: 0,
    time: `2026-10-27T${pad(p.hour)}:00`,
    ...p,
  };
}

export function makeDay(
  overrides: Record<number, Partial<HourData>> = {},
  dayProps: Partial<DayForecast> = {},
): DayForecast {
  const hours = Array.from({ length: 24 }, (_, hour) =>
    makeHour({ hour, isDay: hour >= 7 && hour <= 19, ...overrides[hour] }),
  );
  return {
    date: '2026-10-27',
    hours,
    sunrise: '2026-10-27T06:30',
    sunset: '2026-10-27T19:30',
    ...dayProps,
  };
}

// Full ScoredHour for every hour of the day. isPast / inFreeTime are left false:
// window building does not read them (evaluate sets them for real).
export function scored(day: DayForecast, activity: Activity): ScoredHour[] {
  return day.hours.map((hour) => {
    const { points, noData, score } = scoreHour(hour, activity);
    return {
      ...hour,
      points,
      noData,
      score,
      verdict: hourVerdict(hour, score),
      isPast: false,
      inFreeTime: false,
    };
  });
}
