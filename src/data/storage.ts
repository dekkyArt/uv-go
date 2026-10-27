import type { Activity, DurationMin, Inputs } from '../domain/types';
import type { Place } from './types';

const LOCATION_KEY = 'uvgo:location';
const INPUTS_KEY = 'uvgo:inputs';

type StoredInputs = Pick<Inputs, 'freeTime' | 'duration' | 'activity'>;

const DURATIONS: readonly DurationMin[] = [30, 60, 120, 180];
const ACTIVITIES: readonly Activity[] = ['active', 'relaxed', 'long-sun'];
const MIN_START_HOUR = 0;
const MAX_START_HOUR = 23;
const MIN_END_HOUR = 1;
const MAX_END_HOUR = 24;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable or full: the app works without remembering.
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function loadPlace(): Place | null {
  const raw = readJson(LOCATION_KEY);
  if (!isRecord(raw)) return null;
  const { id, name, admin1, country, lat, lon } = raw;
  if (typeof name !== 'string' || name === '') return null;
  if (!isFiniteNumber(lat) || !isFiniteNumber(lon)) return null;
  if (id !== undefined && !isFiniteNumber(id)) return null;
  const place: Place = { id: id ?? 0, name, lat, lon };
  if (typeof admin1 === 'string') place.admin1 = admin1;
  if (typeof country === 'string') place.country = country;
  return place;
}

export function savePlace(p: Place): void {
  writeJson(LOCATION_KEY, p);
}

function parseFreeTime(value: unknown): StoredInputs['freeTime'] | undefined {
  if (!isRecord(value)) return undefined;
  const { start, end } = value;
  if (!Number.isInteger(start) || !Number.isInteger(end)) return undefined;
  const s = start as number;
  const e = end as number;
  if (s < MIN_START_HOUR || s > MAX_START_HOUR) return undefined;
  if (e < MIN_END_HOUR || e > MAX_END_HOUR || e <= s) return undefined;
  return { start: s, end: e };
}

export function loadInputs(): Partial<StoredInputs> {
  const raw = readJson(INPUTS_KEY);
  if (!isRecord(raw)) return {};
  const result: Partial<StoredInputs> = {};
  const freeTime = parseFreeTime(raw.freeTime);
  if (freeTime) result.freeTime = freeTime;
  const duration = DURATIONS.find((d) => d === raw.duration);
  if (duration !== undefined) result.duration = duration;
  const activity = ACTIVITIES.find((a) => a === raw.activity);
  if (activity !== undefined) result.activity = activity;
  return result;
}

export function saveInputs(v: StoredInputs): void {
  // Pick the stored fields explicitly so `day` (or anything else) never leaks in.
  writeJson(INPUTS_KEY, {
    freeTime: { start: v.freeTime.start, end: v.freeTime.end },
    duration: v.duration,
    activity: v.activity,
  });
}
