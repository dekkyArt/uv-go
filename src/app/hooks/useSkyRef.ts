import { useEffect, useMemo, useState } from 'react';
import { articlePhase, skyState, sunPosition } from '../../domain/sky';
import type { SkyState } from '../../domain/sky';
import { skyConfig } from '../../domain/sky.config';
import type { DayForecast, EvaluationResult, NowLocal } from '../../domain/types';
import type { AppState } from '../state';

const DEVICE_TICK_MS = 60_000;
/** Hour used for Tomorrow when there is no best window (spec 9.3). */
const TOMORROW_REF_HOUR = 12;
/** Sun glow while no forecast is known: a clear sky, a middling UV. */
const DEVICE_GLOW = 0.5;

export interface SkyRef {
  refHour: number;
  day: DayForecast | null;
  /** No forecast yet (no place, loading, error): the sky follows the device clock, clear weather. */
  deviceFallback: boolean;
}

interface DeviceClock {
  hour: number;
  minute: number;
}

function readClock(): DeviceClock {
  const d = new Date();
  return { hour: d.getHours(), minute: d.getMinutes() };
}

/** The device's local time, refreshed every minute. */
function useDeviceClock(): DeviceClock {
  const [clock, setClock] = useState(readClock);
  useEffect(() => {
    const id = setInterval(() => setClock(readClock()), DEVICE_TICK_MS);
    return () => clearInterval(id);
  }, []);
  return clock;
}

type Day = AppState['inputs']['day'];

/** `result` and `selectedHour` belong to the active day; the other day goes by the clock alone. */
function refFor(
  state: AppState,
  result: EvaluationResult | null,
  now: NowLocal | null,
  device: DeviceClock,
  which: Day = state.inputs.day,
): SkyRef {
  const forecast = state.forecast.status === 'success' ? state.forecast.forecast : null;
  const day = forecast?.days[which === 'today' ? 0 : 1] ?? null;
  if (day === null) return { refHour: device.hour, day: null, deviceFallback: true };

  const active = which === state.inputs.day;
  let refHour: number;
  if (active && state.selectedHour !== null) refHour = state.selectedHour;
  else if (active && result?.best) refHour = result.best.startHour;
  else if (which === 'today' && now !== null) refHour = now.hour;
  else refHour = TOMORROW_REF_HOUR;
  return { refHour, day, deviceFallback: false };
}

/**
 * The hour the sky is drawn for (spec 9.3): the selected hour, else the start of the best window,
 * else the current hour (Today) or noon (Tomorrow). Without a forecast: the device hour.
 */
export function useSkyRef(
  state: AppState,
  result: EvaluationResult | null,
  now: NowLocal | null,
): SkyRef {
  return refFor(state, result, now, useDeviceClock());
}

/**
 * Sky for one day: the forecast hour's sky, or (no forecast) the article sky of the device time.
 * That fallback phase is the one SkyScript puts on <html>, so the live layer takes over unchanged.
 */
function useDaySky({ refHour, day, deviceFallback }: SkyRef, device: DeviceClock): SkyState {
  return useMemo(() => {
    if (!deviceFallback && day !== null) return skyState(refHour, day);
    const { sunrise, sunset } = skyConfig.articleFallback;
    const minutes = device.hour * skyConfig.minutesPerHour + device.minute;
    return {
      phase: articlePhase(device.hour, device.minute),
      weather: 'clear',
      uvGlow: DEVICE_GLOW,
      heat: false,
      wind: false,
      sunPosition: sunPosition(minutes, sunrise, sunset, true),
    };
  }, [refHour, day, deviceFallback, device.hour, device.minute]);
}

/**
 * The skies of Today and Tomorrow, so the live sky can follow a swipe between them. The active
 * day's sky follows its selected hour and best window; the other day's, its clock hour (spec 9.3).
 */
export function useSkyPair(
  state: AppState,
  result: EvaluationResult | null,
  now: NowLocal | null,
): { today: SkyState; tomorrow: SkyState } {
  const device = useDeviceClock();
  const today = useDaySky(refFor(state, result, now, device, 'today'), device);
  const tomorrow = useDaySky(refFor(state, result, now, device, 'tomorrow'), device);
  return useMemo(() => ({ today, tomorrow }), [today, tomorrow]);
}
