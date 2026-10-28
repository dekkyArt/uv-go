import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type RefObject,
} from 'react';
import { useReducedMotion } from 'motion/react';
import { loadInputs, loadPlace, saveInputs, savePlace } from '../data/storage';
import type { Place } from '../data/types';
import { evaluate } from '../domain/evaluate';
import type { Inputs } from '../domain/types';
import { MotionProvider } from '../motion/MotionProvider';
import { FreeTimeCard } from './cards/FreeTimeCard';
import { GlassCard } from './cards/GlassCard';
import { CELL_H } from './cards/HourCell';
import { HourlyCard } from './cards/HourlyCard';
import { PlanControls } from './cards/PlanControls';
import { TakeTiles } from './cards/TakeTiles';
import { HERO_H1, Hero } from './hero/Hero';
import { heroState } from './hero/heroState';
import { useFirstResult } from './hooks/useFirstResult';
import { useForecastLoader } from './hooks/useForecastLoader';
import { useGeolocate } from './hooks/useGeolocate';
import { useIsDesktop } from './hooks/useIsDesktop';
import { useNow } from './hooks/useNow';
import { useSky } from './hooks/useSkyRef';
import { CitiesSheet } from './sheet/CitiesSheet';
import { Sheet } from './sheet/Sheet';
import { initialState, isForecastStale, reducer } from './state';
import { Toolbar } from './toolbar/Toolbar';
import { DAY_OPTIONS, DAY_PANEL_ID, ROW_H, TOOLBAR_H, verdictLabel } from './ui';

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

/**
 * Mobile: one column (hero, then the day's cards). Desktop (spec 3.4, 4.2): the hero sticks in a
 * left column; on the right, Hourly over two columns, Your free time | What to take and Plan.
 */
const LAYOUT_CLASS =
  'flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(320px,4fr)_8fr] lg:items-start lg:gap-6';
const HERO_COLUMN_CLASS = 'lg:sticky lg:top-24';
const PANEL_CLASS = 'flex min-w-0 flex-col gap-3 lg:gap-6';
const SPLIT_CLASS = 'flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6';
const SIDE_CLASS = 'flex min-w-0 flex-col gap-3 lg:gap-6';

/** Room under the content for the fixed toolbar (spec 3.4). */
const BOTTOM_SPACE: CSSProperties = {
  paddingBottom: `calc(${TOOLBAR_H}px + 24px + env(safe-area-inset-bottom))`,
};

/**
 * Card skeletons have the height of the card they stand in for. GlassCard: 1 px border at the top
 * and bottom, a 16 px padded header and a 16 px padded body. Hourly's header is as tall as the
 * 48 px metric switch, its body one row of cells. Your free time's header is a 20 px title over an
 * 18 px subtitle, its body one ROW_H row per free hour (the column headers are visually hidden).
 */
const HOURLY_SKELETON_H = 2 + 16 + 48 + 2 * 16 + CELL_H;
const FREE_TIME_CHROME_H = 2 + 16 + 20 + 18 + 2 * 16;
const freeTimeSkeletonHeight = (rows: number | string) =>
  `calc(${rows} * ${ROW_H}px + ${FREE_TIME_CHROME_H}px)`;

function HourlySkeleton() {
  return (
    <div
      aria-busy="true"
      data-skeleton=""
      className="glass"
      style={{ height: HOURLY_SKELETON_H }}
    />
  );
}

function FreeTimeSkeleton({ rows }: { rows: number | string }) {
  return (
    <div
      aria-busy="true"
      data-skeleton=""
      className="glass"
      style={{ height: freeTimeSkeletonHeight(rows) }}
    />
  );
}

/**
 * Server render and hydration (spec 9): the hero with its H1 (the LCP text, the same as the app's)
 * and, when a place is stored (<html data-has-place>, set by reserveLayout before first paint),
 * the Hourly and Your free time skeletons at their final heights, so nothing below moves.
 */
function Placeholder() {
  return (
    <div className={LAYOUT_CLASS} style={BOTTOM_SPACE}>
      <div className={HERO_COLUMN_CLASS}>
        <div
          // The hero's fixed pre-content height (spec 9), with its scrim under the H1.
          className="relative flex h-[300px] w-full flex-col items-center justify-center px-4 py-6 text-center text-text [text-shadow:0_1px_2px_rgb(0_0_0/0.25)]"
        >
          <div
            aria-hidden="true"
            className="hero-scrim pointer-events-none absolute -inset-x-4 -inset-y-6"
          />
          <h1 className="relative m-0 text-xs font-semibold uppercase leading-4 tracking-[0.06em]">
            {HERO_H1}
          </h1>
        </div>
      </div>
      {/* Hidden on a first visit; the data-has-place variant is more specific, so it wins. */}
      <div className="hidden min-w-0 flex-col gap-3 lg:gap-6 [[data-has-place]_&]:flex">
        <HourlySkeleton />
        <div className={SPLIT_CLASS}>
          <FreeTimeSkeleton rows="var(--free-rows, 6)" />
        </div>
      </div>
    </div>
  );
}

const DONE_CLASS =
  'inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-white/15 bg-white/10 px-4 text-base font-medium text-white hover:bg-white/15';

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

  // The hero's "Use my location"; the Cities sheet has its own.
  const { locating, geoError, locate } = useGeolocate(choosePlace);

  // The first-result choreography plays once per place and day; input changes only recalculate.
  const reduced = useReducedMotion() ?? false;
  const sky = useSky(state, evaluation, now);
  const introKey =
    place === null || evaluation === null
      ? null
      : `${place.id}:${place.lat},${place.lon}:${inputs.day}`;
  const { playIntro } = useFirstResult(introKey, reduced);

  // The Plan sheet exists only below 1024 px; past it the Plan card is on the page instead.
  const isDesktop = useIsDesktop();
  const [planOpen, setPlanOpen] = useState(false);
  if (isDesktop && planOpen) setPlanOpen(false);
  const [citiesOpen, setCitiesOpen] = useState(false);

  const planRef = useRef<HTMLButtonElement>(null);
  const citiesRef = useRef<HTMLButtonElement>(null);
  const findCityRef = useRef<HTMLButtonElement>(null);
  // Focus goes back to whichever button opened Cities. The hero's "Find a city" is gone once a
  // place is picked, so then it falls back to the toolbar's Cities.
  const citiesFromHero = useRef(false);
  const citiesReturn = useMemo<RefObject<HTMLElement | null>>(
    () => ({
      get current() {
        return (citiesFromHero.current ? findCityRef.current : null) ?? citiesRef.current;
      },
    }),
    [],
  );

  function openCities(fromHero: boolean) {
    citiesFromHero.current = fromHero;
    setCitiesOpen(true);
  }

  const best = evaluation?.best ?? null;
  const nowHour = inputs.day === 'today' ? (now?.hour ?? null) : null;
  const hero = heroState(state, evaluation, now);
  const dayLabel = DAY_OPTIONS.find((o) => o.value === inputs.day)?.label;

  const announcement =
    best !== null && evaluation?.reason
      ? `Best time ${best.label}, ${verdictLabel(best.verdict)}. ${evaluation.reason}.`
      : '';

  const planControls = (
    <PlanControls
      inputs={inputs}
      onFreeTime={(freeTime) => changeStored({ freeTime }, { type: 'setFreeTime', freeTime })}
      onDuration={(duration) => changeStored({ duration }, { type: 'setDuration', duration })}
      onActivity={(activity) => changeStored({ activity }, { type: 'setActivity', activity })}
    />
  );

  // Cards follow the hero's state (spec 4.8): skeletons while loading, nothing without a place or
  // after an error, What to take only with a result.
  let hourlyCard = null;
  let freeTimeCard = null;
  let takeTiles = null;
  if (hero.kind === 'loading') {
    hourlyCard = <HourlySkeleton />;
    freeTimeCard = <FreeTimeSkeleton rows={inputs.freeTime.end - inputs.freeTime.start} />;
  } else if (evaluation !== null && activeDay !== null) {
    hourlyCard = (
      <HourlyCard
        day={activeDay}
        hours={evaluation.scoredHours}
        freeTime={inputs.freeTime}
        best={best}
        selectedHour={selectedHour}
        nowHour={nowHour}
        onSelect={(hour) => dispatch({ type: 'selectHour', hour })}
        intro={playIntro}
      />
    );
    freeTimeCard = (
      <FreeTimeCard
        hours={evaluation.scoredHours}
        freeTime={inputs.freeTime}
        best={best}
        nowHour={nowHour}
        duration={inputs.duration}
        activity={inputs.activity}
        intro={playIntro}
      />
    );
    if (best !== null) {
      takeTiles = (
        <TakeTiles
          items={evaluation.checklist}
          window={best}
          activity={inputs.activity}
          intro={playIntro}
        />
      );
    }
  }

  return (
    <div className={LAYOUT_CLASS} style={BOTTOM_SPACE}>
      {/* Fixed and behind everything: not a grid item, so it takes no part in the layout. */}
      <Suspense fallback={null}>
        <SkyLayer sky={sky} reducedMotion={reduced} />
      </Suspense>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div className={HERO_COLUMN_CLASS}>
        <Hero
          state={hero}
          locating={locating}
          geoError={geoError}
          onUseLocation={locate}
          onFindCity={() => openCities(true)}
          onRetry={() => dispatch({ type: 'retry' })}
          onShowTomorrow={() => dispatch({ type: 'setDay', day: 'tomorrow' })}
          notice={state.autoSwitchNotice}
          intro={playIntro}
          findCityRef={findCityRef}
        />
      </div>

      <div id={DAY_PANEL_ID} role="tabpanel" aria-label={dayLabel} className={PANEL_CLASS}>
        {hourlyCard}
        {(freeTimeCard !== null || takeTiles !== null || isDesktop) && (
          <div className={SPLIT_CLASS}>
            {freeTimeCard}
            {(takeTiles !== null || isDesktop) && (
              <div className={SIDE_CLASS}>
                {takeTiles}
                {isDesktop && <GlassCard title="Plan">{planControls}</GlassCard>}
              </div>
            )}
          </div>
        )}
      </div>

      <Toolbar
        day={inputs.day}
        onDay={(day) => dispatch({ type: 'setDay', day })}
        panelId={DAY_PANEL_ID}
        onPlan={isDesktop ? undefined : () => setPlanOpen(true)}
        onCities={() => openCities(false)}
        planRef={planRef}
        citiesRef={citiesRef}
      />

      <Sheet
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        title="Plan"
        size="auto"
        returnFocusRef={planRef}
      >
        <div className="flex flex-col gap-5">
          {planControls}
          {/* The sheet has no close button of its own, and reduced motion has no swipe. */}
          <button type="button" onClick={() => setPlanOpen(false)} className={DONE_CLASS}>
            Done
          </button>
        </div>
      </Sheet>
      <CitiesSheet
        open={citiesOpen}
        onClose={() => setCitiesOpen(false)}
        place={place}
        onPlace={choosePlace}
        returnFocusRef={citiesReturn}
      />
    </div>
  );
}
