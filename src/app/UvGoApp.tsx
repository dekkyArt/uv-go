import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useReducedMotion } from 'motion/react';
import { loadInputs, loadPlace, saveInputs, savePlace } from '../data/storage';
import type { Place } from '../data/types';
import { evaluate } from '../domain/evaluate';
import type { Inputs, ScoredHour, TimeWindow } from '../domain/types';
import { MotionProvider } from '../motion/MotionProvider';
import { EmptyState } from './components/EmptyState';
import { ErrorState } from './components/ErrorState';
import { FreeTimePicker } from './components/FreeTimePicker';
import { HourDetails } from './components/HourDetails';
import { DayArcTimeline } from './components/DayArcTimeline';
import { LocationPicker } from './components/LocationPicker';
import { MiniResult } from './components/MiniResult';
import { ResultCard } from './components/ResultCard';
import { SegmentedControl } from './components/SegmentedControl';
import { useFirstResult } from './hooks/useFirstResult';
import { useForecastLoader } from './hooks/useForecastLoader';
import { useNow } from './hooks/useNow';
import { initialState, isForecastStale, reducer } from './state';
import { useCardOffscreen } from './hooks/useCardOffscreen';
import { ACTIVITY_OPTIONS, CARD_CLASS, DAY_OPTIONS, DURATION_OPTIONS, verdictLabel } from './ui';

type StoredInputs = Pick<Inputs, 'freeTime' | 'duration' | 'activity'>;

const noopSubscribe = () => () => {};

/**
 * Server render and hydration both see `false`, so the markup matches; the browser then
 * switches to `true` and the stored place and inputs can be read without a mismatch.
 */
function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export default function UvGoApp() {
  return useIsClient() ? (
    <MotionProvider>
      <App />
    </MotionProvider>
  ) : (
    <section aria-busy="true" className={CARD_CLASS} />
  );
}

function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    initialState({ place: loadPlace(), inputs: loadInputs() }),
  );
  const { place, inputs, selectedHour } = state;

  useForecastLoader(place, state.retryToken, dispatch);

  const forecast = state.forecast.status === 'success' ? state.forecast.forecast : null;
  const now = useNow(forecast?.utcOffsetSeconds ?? null);

  // The location's date moved past the forecast's first day: fetch fresh data once per date.
  const staleHandledFor = useRef<string | null>(null);
  useEffect(() => {
    if (forecast === null || now === null) return;
    if (!isForecastStale(forecast, now) || staleHandledFor.current === now.date) return;
    staleHandledFor.current = now.date;
    dispatch({ type: 'retry' });
  }, [forecast, now]);

  const activeDay = forecast?.days[inputs.day === 'today' ? 0 : 1] ?? null;
  const evaluation = useMemo(
    () =>
      activeDay === null ? null : evaluate(activeDay, inputs, inputs.day === 'today' ? now : null),
    [activeDay, inputs, now],
  );

  const closeDetails = useCallback(() => dispatch({ type: 'selectHour', hour: null }), []);

  function choosePlace(p: Place) {
    savePlace(p);
    dispatch({ type: 'setPlace', place: p });
  }

  function changeStored(patch: Partial<StoredInputs>, action: Parameters<typeof dispatch>[0]) {
    saveInputs({
      freeTime: inputs.freeTime,
      duration: inputs.duration,
      activity: inputs.activity,
      ...patch,
    });
    dispatch(action);
  }

  // The first-result choreography plays once per place and day; input changes only recalculate.
  const reduced = useReducedMotion() ?? false;
  const introKey =
    place === null || evaluation === null
      ? null
      : `${place.id}:${place.lat},${place.lon}:${inputs.day}`;
  const { playIntro, labelInFrame } = useFirstResult(introKey, reduced);

  const [cardEl, setCardEl] = useState<HTMLElement | null>(null);
  const cardOffscreen = useCardOffscreen(cardEl);

  const best: TimeWindow | null = evaluation?.best ?? null;
  const selected: ScoredHour | null =
    evaluation !== null && selectedHour !== null ? evaluation.scoredHours[selectedHour] : null;

  let card;
  if (place === null) {
    card = (
      <div className={`${CARD_CLASS} flex items-center text-text-muted`}>
        Choose a city to see the best time to go out.
      </div>
    );
  } else if (state.forecast.status === 'error') {
    card = <ErrorState onRetry={() => dispatch({ type: 'retry' })} />;
  } else if (evaluation === null) {
    card = (
      <div aria-busy="true" className={CARD_CLASS}>
        <span className="sr-only">Loading the forecast</span>
      </div>
    );
  } else if (evaluation.best !== null) {
    card = (
      <ResultCard
        key={introKey}
        ref={setCardEl}
        result={{ ...evaluation, best: evaluation.best }}
        activity={inputs.activity}
        intro={playIntro}
        labelInFrame={labelInFrame}
      />
    );
  } else if (evaluation.emptyReason !== null) {
    card = (
      <EmptyState
        reason={evaluation.emptyReason}
        duration={inputs.duration}
        onShowTomorrow={() => dispatch({ type: 'setDay', day: 'tomorrow' })}
      />
    );
  }

  const announcement =
    best !== null && evaluation?.reason
      ? `Best time ${best.label}, ${verdictLabel(best.verdict)}. ${evaluation.reason}.`
      : '';

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-x-8">
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {best !== null && (
        <MiniResult
          label={best.label}
          verdict={best.verdict}
          visible={cardOffscreen}
          onClick={() =>
            cardEl?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
          }
        />
      )}

      <section aria-label="Location" className="flex flex-col gap-3 lg:col-span-2">
        {place === null && <h2 className="text-2xl font-bold">Where are you heading out?</h2>}
        <LocationPicker place={place} onPlace={choosePlace} />
      </section>

      <div className="flex flex-col gap-3 lg:col-start-1 lg:row-start-2">
        {state.autoSwitchNotice && (
          <p role="status" className="rounded-lg bg-surface-strong px-3 py-2 text-sm">
            Your free time today has passed — showing tomorrow
          </p>
        )}
        {card}
      </div>

      <section
        aria-label="Day timeline"
        className="flex flex-col gap-4 lg:col-start-2 lg:row-span-2 lg:row-start-2"
      >
        {evaluation !== null && activeDay !== null ? (
          <DayArcTimeline
            key={introKey}
            day={activeDay}
            hours={evaluation.scoredHours}
            freeTime={inputs.freeTime}
            best={best}
            selectedHour={selectedHour}
            onSelect={(hour) => dispatch({ type: 'selectHour', hour })}
            playIntro={playIntro}
            labelInFrame={labelInFrame}
          />
        ) : (
          <div aria-hidden="true" className="h-[4.75rem] rounded-md bg-surface-strong" />
        )}
        {selected !== null && <HourDetails hour={selected} onClose={closeDetails} />}
      </section>

      <section
        aria-labelledby="adjust-heading"
        className="flex flex-col gap-4 lg:col-start-1 lg:row-start-3"
      >
        <h2 id="adjust-heading" className="text-lg font-semibold">
          Adjust your plan
        </h2>
        <SegmentedControl
          label="Day"
          options={[...DAY_OPTIONS]}
          value={inputs.day}
          onChange={(day) => dispatch({ type: 'setDay', day })}
        />
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium">Free time</h3>
          <FreeTimePicker
            value={inputs.freeTime}
            onChange={(freeTime) => changeStored({ freeTime }, { type: 'setFreeTime', freeTime })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium">Duration</h3>
          <SegmentedControl
            label="Duration"
            options={DURATION_OPTIONS}
            value={inputs.duration}
            onChange={(duration) => changeStored({ duration }, { type: 'setDuration', duration })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium">Activity</h3>
          <SegmentedControl
            label="Activity"
            options={ACTIVITY_OPTIONS}
            value={inputs.activity}
            onChange={(activity) => changeStored({ activity }, { type: 'setActivity', activity })}
          />
        </div>
      </section>
    </div>
  );
}
