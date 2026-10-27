import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { loadInputs, loadPlace, saveInputs, savePlace } from '../data/storage';
import type { Place } from '../data/types';
import { evaluate } from '../domain/evaluate';
import type { Inputs, ScoredHour, TimeWindow } from '../domain/types';
import { MotionProvider } from '../motion/MotionProvider';
import { durations } from '../motion/tokens';
import { EmptyState } from './components/EmptyState';
import { ErrorState } from './components/ErrorState';
import { FreeTimePicker } from './components/FreeTimePicker';
import { HourDetails } from './components/HourDetails';
import { DayArcTimeline } from './components/DayArcTimeline';
import { LoadingSun } from './components/LoadingSun';
import { LocationPicker } from './components/LocationPicker';
import { MiniResult } from './components/MiniResult';
import { ResultCard } from './components/ResultCard';
import { SegmentedControl } from './components/SegmentedControl';
import { TimelineSkeleton } from './components/TimelineSkeleton';
import { useFirstResult } from './hooks/useFirstResult';
import { useForecastLoader } from './hooks/useForecastLoader';
import { useNow } from './hooks/useNow';
import { useSky } from './hooks/useSkyRef';
import { initialState, isForecastStale, reducer } from './state';
import { useCardOffscreen } from './hooks/useCardOffscreen';
import {
  ACTIVITY_OPTIONS,
  ADJUST_SKELETON_CLASS,
  CARD_CLASS,
  CARD_SLOT_CLASS,
  DAY_OPTIONS,
  DURATION_OPTIONS,
  LOCATION_SKELETON_CLASS,
  PANEL_CLASS,
  verdictLabel,
} from './ui';

type StoredInputs = Pick<Inputs, 'freeTime' | 'duration' | 'activity'>;

/** The live sky is its own chunk: the CSS phase gradient paints first, the animated layer follows. */
const SkyLayer = lazy(() => import('./components/SkyLayer'));

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
    <Placeholder />
  );
}

/** Longest an old card may stay on screen after its exit should have finished (> durations.fast). */
const EXIT_GRACE_MS = 400;

/**
 * The motion features load lazily. A card that left before they arrived never gets its exit
 * animation, and AnimatePresence would keep it on screen for good. When an exit does not finish
 * in time, a new `presenceKey` remounts the presence tree with the current card.
 */
function useUnstickPresence(cardKey: string) {
  const [presenceKey, setPresenceKey] = useState(0);
  const shownKey = useRef(cardKey);
  const leaving = useRef(false);

  useEffect(() => {
    if (shownKey.current === cardKey) return;
    shownKey.current = cardKey;
    leaving.current = true;
    const timer = setTimeout(() => {
      if (!leaving.current) return;
      leaving.current = false;
      setPresenceKey((k) => k + 1);
    }, EXIT_GRACE_MS);
    return () => clearTimeout(timer);
  }, [cardKey]);

  return {
    presenceKey,
    onExitComplete: () => {
      leaving.current = false;
    },
  };
}

const LAYOUT_CLASS =
  'flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-x-8';
const CARD_SLOT_PLACEMENT = 'lg:col-start-1 lg:row-start-2';
const TIMELINE_PLACEMENT = 'lg:col-start-2 lg:row-span-2 lg:row-start-2';

/**
 * Server render and hydration: empty blocks of the sizes the interactive layout takes (location,
 * card container, timeline, plan), so the footer stays put when the app mounts.
 */
function Placeholder() {
  return (
    <div aria-busy="true" className={LAYOUT_CLASS}>
      <div data-location-skeleton="" className={`${PANEL_CLASS} ${LOCATION_SKELETON_CLASS}`} />
      <div data-card-slot="" className={`${CARD_SLOT_CLASS} ${CARD_SLOT_PLACEMENT}`}>
        <div className={CARD_CLASS} />
      </div>
      <div className={`${PANEL_CLASS} ${TIMELINE_PLACEMENT}`}>
        <TimelineSkeleton />
      </div>
      <div data-adjust-skeleton="" className={`${PANEL_CLASS} ${ADJUST_SKELETON_CLASS}`} />
    </div>
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
  const sky = useSky(state, evaluation, now);
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

  // One card at a time; the key tells AnimatePresence when the state, not just the data, changes.
  let card;
  let cardKey = 'none';
  if (place === null) {
    cardKey = 'no-place';
    card = (
      <div className={`${CARD_CLASS} flex items-center text-text-muted`}>
        Choose a city to see the best time to go out.
      </div>
    );
  } else if (state.forecast.status === 'error') {
    cardKey = 'error';
    card = <ErrorState onRetry={() => dispatch({ type: 'retry' })} />;
  } else if (evaluation === null) {
    cardKey = 'loading';
    card = (
      <div
        data-skeleton=""
        aria-busy="true"
        className={`${CARD_CLASS} flex flex-col items-center justify-center gap-3`}
      >
        <LoadingSun />
        <p role="status" className="text-base text-text-muted">
          Loading forecast…
        </p>
      </div>
    );
  } else if (evaluation.best !== null) {
    cardKey = 'result';
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
    cardKey = 'empty';
    card = (
      <EmptyState
        reason={evaluation.emptyReason}
        duration={inputs.duration}
        onShowTomorrow={() => dispatch({ type: 'setDay', day: 'tomorrow' })}
      />
    );
  }

  const { presenceKey, onExitComplete } = useUnstickPresence(cardKey);

  const announcement =
    best !== null && evaluation?.reason
      ? `Best time ${best.label}, ${verdictLabel(best.verdict)}. ${evaluation.reason}.`
      : '';

  return (
    <div className={LAYOUT_CLASS}>
      {/* Fixed and behind everything: not a grid item, so it takes no part in the layout. */}
      <Suspense fallback={null}>
        <SkyLayer sky={sky} reducedMotion={reduced} />
      </Suspense>

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

      <section aria-label="Location" className={`${PANEL_CLASS} flex flex-col gap-3 lg:col-span-2`}>
        {place === null && <h2 className="text-2xl font-bold">Where are you heading out?</h2>}
        <LocationPicker place={place} onPlace={choosePlace} />
      </section>

      <div data-card-slot="" className={`${CARD_SLOT_CLASS} ${CARD_SLOT_PLACEMENT}`}>
        {/* Crossfade between states: the old one leaves quickly (the answer must not wait), the
            new one fades in. The container keeps its height, so nothing below moves. */}
        <AnimatePresence
          key={presenceKey}
          mode="wait"
          initial={false}
          onExitComplete={onExitComplete}
        >
          <m.div
            key={cardKey}
            className="flex flex-1 flex-col"
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              transition: { duration: reduced ? durations.fast : durations.base },
            }}
            exit={{ opacity: 0, transition: { duration: durations.fast } }}
          >
            {card}
          </m.div>
        </AnimatePresence>
        {/* Below the card, so it never pushes the card (or the one fading out) down. */}
        {state.autoSwitchNotice && (
          <p role="status" className="rounded-lg bg-surface-strong px-3 py-2 text-sm">
            Your free time today has passed — showing tomorrow
          </p>
        )}
      </div>

      <section
        aria-label="Day timeline"
        className={`${PANEL_CLASS} flex flex-col gap-4 ${TIMELINE_PLACEMENT}`}
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
          <TimelineSkeleton />
        )}
        {selected !== null && <HourDetails hour={selected} onClose={closeDetails} />}
      </section>

      <section
        aria-labelledby="adjust-heading"
        className={`${PANEL_CLASS} flex flex-col gap-4 lg:col-start-1 lg:row-start-3`}
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
