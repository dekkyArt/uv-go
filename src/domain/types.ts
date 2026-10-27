import type { rules } from './rules.config';

export type Activity = 'active' | 'relaxed' | 'long-sun';
export type DurationMin = 30 | 60 | 120 | 180;
export type Verdict = 'green' | 'yellow' | 'red';
export type Factor = 'uv' | 'rain' | 'heat' | 'cold' | 'wind';

export interface HourData {
  time: string; // 'YYYY-MM-DDTHH:00', local time of the location
  hour: number; // 0–23
  uv: number | null;
  rainProb: number | null;
  feelsLike: number | null;
  windKmh: number | null;
  isDay: boolean; // false if is_day = 0 or null
  weatherCode: number | null;
  cloudCover: number | null;
}

export interface DayForecast {
  date: string;
  hours: HourData[];
  sunrise: string;
  sunset: string;
}

export interface Inputs {
  day: 'today' | 'tomorrow';
  freeTime: { start: number; end: number };
  duration: DurationMin;
  activity: Activity;
}

export interface ScoredHour extends HourData {
  points: Record<Factor, number>;
  noData: Factor[];
  score: number;
  verdict: Verdict | 'night';
  isPast: boolean;
  inFreeTime: boolean;
}

export interface TimeWindow {
  startHour: number;
  hours: ScoredHour[];
  score: number; // exact mean
  verdict: Verdict;
  label: string; // '17:00–18:00' | '17:00–17:30'
}

export type EmptyReason = 'too-short' | 'dark' | 'past';

export type ChecklistId = 'sunscreen' | 'hat-sunglasses' | 'rain-jacket' | 'water' | 'warm-layer';

export interface ChecklistItem {
  id: ChecklistId;
  label: string;
}

export interface NowLocal {
  date: string;
  hour: number;
  minute: number;
}

export interface EvaluationResult {
  scoredHours: ScoredHour[]; // 24
  best: TimeWindow | null;
  emptyReason: EmptyReason | null;
  reason: string | null;
  checklist: ChecklistItem[];
}

export type Rules = typeof rules;
