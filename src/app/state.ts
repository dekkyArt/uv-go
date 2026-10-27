import type { Forecast, Place } from '../data/types';
import { evaluate } from '../domain/evaluate';
import type { Activity, DurationMin, Inputs, NowLocal } from '../domain/types';

export type ForecastState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; forecast: Forecast }
  | { status: 'error' };

export interface AppState {
  place: Place | null;
  inputs: Inputs;
  forecast: ForecastState;
  selectedHour: number | null;
  autoSwitchDisabled: boolean;
  autoSwitchNotice: boolean;
  retryToken: number;
}

export type Action =
  | { type: 'setPlace'; place: Place }
  | { type: 'setDay'; day: Inputs['day'] }
  | { type: 'setFreeTime'; freeTime: Inputs['freeTime'] }
  | { type: 'setDuration'; duration: DurationMin }
  | { type: 'setActivity'; activity: Activity }
  | { type: 'selectHour'; hour: number | null }
  | { type: 'forecastLoading' }
  | { type: 'forecastLoaded'; forecast: Forecast; now: NowLocal }
  | { type: 'forecastFailed' }
  | { type: 'retry' };

export const DEFAULT_INPUTS: Inputs = {
  day: 'today',
  freeTime: { start: 13, end: 19 },
  duration: 60,
  activity: 'relaxed',
};

const MIN_START_HOUR = 0;
const MAX_START_HOUR = 23;
const MIN_END_HOUR = 1;
const MAX_END_HOUR = 24;

type StoredInputs = Partial<Pick<Inputs, 'freeTime' | 'duration' | 'activity'>>;

export function initialState(stored: { place: Place | null; inputs: StoredInputs }): AppState {
  return {
    place: stored.place,
    inputs: { ...DEFAULT_INPUTS, ...stored.inputs },
    forecast: { status: 'idle' },
    selectedHour: null,
    autoSwitchDisabled: false,
    autoSwitchNotice: false,
    retryToken: 0,
  };
}

function isValidFreeTime({ start, end }: Inputs['freeTime']): boolean {
  return (
    Number.isInteger(start) &&
    Number.isInteger(end) &&
    start >= MIN_START_HOUR &&
    start <= MAX_START_HOUR &&
    end >= MIN_END_HOUR &&
    end <= MAX_END_HOUR &&
    end > start
  );
}

/** True when the location's local date has moved past the first forecast day. */
export function isForecastStale(forecast: Forecast, now: NowLocal): boolean {
  return now.date !== forecast.days[0].date;
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'setPlace':
      return { ...state, place: action.place, selectedHour: null, autoSwitchNotice: false };
    case 'setDay':
      return {
        ...state,
        inputs: { ...state.inputs, day: action.day },
        // Choosing Today right after an automatic switch means "keep Today": stop auto-switching.
        autoSwitchDisabled:
          state.autoSwitchDisabled || (action.day === 'today' && state.autoSwitchNotice),
        autoSwitchNotice: false,
      };
    case 'setFreeTime':
      if (!isValidFreeTime(action.freeTime)) return state;
      return { ...state, inputs: { ...state.inputs, freeTime: action.freeTime } };
    case 'setDuration':
      return { ...state, inputs: { ...state.inputs, duration: action.duration } };
    case 'setActivity':
      return { ...state, inputs: { ...state.inputs, activity: action.activity } };
    case 'selectHour':
      return { ...state, selectedHour: action.hour };
    case 'forecastLoading':
      return { ...state, forecast: { status: 'loading' } };
    case 'forecastFailed':
      return { ...state, forecast: { status: 'error' } };
    case 'retry':
      return { ...state, retryToken: state.retryToken + 1 };
    case 'forecastLoaded': {
      const next: AppState = {
        ...state,
        forecast: { status: 'success', forecast: action.forecast },
      };
      if (state.autoSwitchDisabled || state.inputs.day !== 'today') return next;
      const { emptyReason } = evaluate(action.forecast.days[0], state.inputs, action.now);
      if (emptyReason !== 'past') return next;
      return {
        ...next,
        inputs: { ...state.inputs, day: 'tomorrow' },
        autoSwitchNotice: true,
      };
    }
  }
}
