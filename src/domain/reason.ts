import { rules } from './rules.config';
import { roundHalfUp } from './scoring';
import type { Factor, Rules, ScoredHour, TimeWindow } from './types';

const SEPARATOR = ' · ';
const MAX_PARTS = 2;

function numbers(values: readonly (number | null)[]): number[] {
  return values.filter((v): v is number => v !== null);
}

function maxOf(values: readonly (number | null)[]): number | null {
  const present = numbers(values);
  return present.length > 0 ? Math.max(...present) : null;
}

function minOf(values: readonly (number | null)[]): number | null {
  const present = numbers(values);
  return present.length > 0 ? Math.min(...present) : null;
}

function round(n: number | null): number | null {
  return n === null ? null : roundHalfUp(n);
}

function factorSum(hours: readonly ScoredHour[], factor: Factor): number {
  return hours.reduce((sum, h) => sum + h.points[factor], 0);
}

// Template text for a factor with points, filled with the window's values.
// Returns null when the value the template needs is missing.
function describeFactor(factor: Factor, hours: readonly ScoredHour[], r: Rules): string | null {
  const t = r.reasonTemplates;
  switch (factor) {
    case 'uv': {
      const uv = round(maxOf(hours.map((h) => (h.uv === null ? null : roundHalfUp(h.uv)))));
      if (uv === null) return null;
      let text: string | undefined;
      for (const band of t.uv) {
        if (band.min <= uv) text = band.text;
      }
      return (text ?? t.uv[0].text).replace('{uv}', String(uv));
    }
    case 'rain': {
      const rain = maxOf(hours.map((h) => h.rainProb));
      return rain === null ? null : t.rain.replace('{rain}', String(roundHalfUp(rain)));
    }
    case 'heat': {
      const feels = round(maxOf(hours.map((h) => h.feelsLike)));
      return feels === null ? null : t.heat.replace('{t}', String(feels));
    }
    case 'cold': {
      const feels = round(minOf(hours.map((h) => h.feelsLike)));
      return feels === null ? null : t.cold.replace('{t}', String(feels));
    }
    case 'wind': {
      const wind = round(maxOf(hours.map((h) => h.windKmh)));
      return wind === null ? null : t.wind.replace('{w}', String(wind));
    }
  }
}

export function buildReason(w: TimeWindow, r: Rules = rules): string {
  const priority = r.reasonPriority as readonly Factor[];
  const ranked = priority
    .map((factor, order) => ({ factor, order, sum: factorSum(w.hours, factor) }))
    .filter((f) => f.sum > 0)
    // Largest sum first; equal sums keep config priority order.
    .sort((a, b) => b.sum - a.sum || a.order - b.order)
    .slice(0, MAX_PARTS);

  const parts = ranked
    .map((f) => describeFactor(f.factor, w.hours, r))
    .filter((text): text is string => text !== null);

  return parts.length > 0 ? parts.join(SEPARATOR) : r.reasonTemplates.none;
}
