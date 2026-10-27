import type { NowLocal } from '../domain/types';

/** Current date/hour/minute in the location's time zone (UTC fields of the shifted instant). */
export function nowLocal(utcOffsetSeconds: number, nowMs: number = Date.now()): NowLocal {
  const shifted = new Date(nowMs + utcOffsetSeconds * 1000);
  return {
    date: shifted.toISOString().slice(0, 10),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}
