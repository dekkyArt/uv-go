import { rules } from './rules.config';
import type { Activity, Factor, HourData, Rules, Verdict } from './types';

export function roundHalfUp(n: number): number {
  return Math.round(n);
}

// Last band whose `min` <= value, or undefined if none matches.
function pickBand<B extends { readonly min: number }>(
  bands: readonly B[],
  value: number,
): B | undefined {
  let found: B | undefined;
  for (const band of bands) {
    if (band.min <= value) found = band;
  }
  return found;
}

export function scoreHour(
  hour: HourData,
  activity: Activity,
  r: Rules = rules,
): { points: Record<Factor, number>; noData: Factor[]; score: number } {
  const points: Record<Factor, number> = { uv: 0, rain: 0, heat: 0, cold: 0, wind: 0 };
  const noData: Factor[] = [];

  if (hour.uv === null) {
    noData.push('uv');
  } else {
    const multiplier = (r.uv.multiplier as Partial<Record<Activity, number>>)[activity] ?? 1;
    points.uv = (pickBand(r.uv.bands, roundHalfUp(hour.uv))?.points ?? 0) * multiplier;
  }

  if (hour.rainProb === null) {
    noData.push('rain');
  } else {
    points.rain = pickBand(r.rain.bands, hour.rainProb)?.points ?? 0;
  }

  if (hour.feelsLike === null) {
    noData.push('heat', 'cold');
  } else {
    if (hour.feelsLike >= r.heat.min) {
      const byActivity = r.heat.pointsByActivity as Partial<Record<Activity, number>>;
      points.heat = byActivity[activity] ?? r.heat.points;
    }
    if (hour.feelsLike < r.cold.below) points.cold = r.cold.points;
  }

  if (hour.windKmh === null) {
    noData.push('wind');
  } else if (hour.windKmh >= r.wind.min) {
    points.wind = r.wind.points;
  }

  const score = points.uv + points.rain + points.heat + points.cold + points.wind;
  return { points, noData, score };
}

export function verdictFor(score: number, r: Rules = rules): Verdict {
  const band = pickBand(r.verdict.bands, roundHalfUp(score)) ?? r.verdict.bands[0];
  return band.verdict;
}

export function hourVerdict(hour: HourData, score: number, r: Rules = rules): Verdict | 'night' {
  return hour.isDay ? verdictFor(score, r) : 'night';
}
