import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type RefObject,
} from 'react';
import { useMotionValue, useReducedMotion } from 'motion/react';
import { createPortal } from 'react-dom';
import { loadInputs, loadPlace, saveInputs, savePlace } from '../data/storage';
import type { Place } from '../data/types';
import { evaluate } from '../domain/evaluate';
import type { Inputs } from '../domain/types';
import { useFeaturesFailed } from '../motion/featuresFailed';
import { MotionProvider } from '../motion/MotionProvider';
import { FreeTimeCard } from './cards/FreeTimeCard';
import { GlassCard } from './cards/GlassCard';
import { CELL_H } from './cards/HourCell';
import { HourlyCard } from './cards/HourlyCard';
import { PlanControls } from './cards/PlanControls';
import { TakeTiles } from './cards/TakeTiles';
import { fixedLayers } from './fixedLayers';
import { HERO_H1, Hero } from './hero/Hero';
import { CollapsedBar } from './hero/CollapsedBar';
import { heroState } from './hero/heroState';
import { placeTitle } from './hero/heroText';
import { COLLAPSED_H, useHeroCollapse } from './hero/useHeroCollapse';
import { useFirstResult } from './hooks/useFirstResult';
import { useForecastLoader } from './hooks/useForecastLoader';
import { useGeolocate } from './hooks/useGeolocate';
import { useIsDesktop } from './hooks/useIsDesktop';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useNow } from './hooks/useNow';
import { useSkyPair } from './hooks/useSkyRef';
import { DayPager } from './pager/DayPager';
import { CitiesSheet } from './sheet/CitiesSheet';
import { whenIdle } from './sky/whenIdle';
import { Sheet } from './sheet/Sheet';
import { initialState, isForecastStale, reducer } from './state';
import { Toolbar } from './toolbar/Toolbar';
import {
  DAY_OPTIONS,
  DAY_PANEL_ID,
  ROW_H,
  SHEET_BUTTON_CLASS,
  TOOLBAR_H,
  verdictLabel,
} from './ui';

type StoredInputs = Pick<Inputs, 'freeTime' | 'duration' | 'activity'>;

type SkyCanvasModule = typeof import('./sky/SkyCanvas');

/**
 * The live sky is its own chunk, fetched once the page is idle: the CSS phase gradient paints
 * first, the WebGL sky follows. Without the chunk (offline, a failed deploy) the CSS sky stays.
 */
function useIdleSkyCanvas(): SkyCanvasModule | null {
  const [chunk, setChunk] = useState<SkyCanvasModule | null>(null);
  useEffect(() => {
    let live = true;
    const cancel = whenIdle(() => {
      import('./sky/SkyCanvas')
        .then((m) => {
          if (live) setChunk(m);
        })
        .catch(() => {});
    });
    return () => {
      live = false;
      cancel();
    };
  }, []);
  return chunk;
}

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
/** The pager takes the whole row and lays out the hero and the day panel just as the root would. */
const PAGER_CLASS = `${LAYOUT_CLASS} lg:col-span-full`;
const HERO_COLUMN_CLASS = 'lg:sticky lg:top-24';
const PANEL_CLASS = 'flex min-w-0 flex-col gap-3 lg:gap-6';
const SPLIT_CLASS = 'flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6';
/**
 * What to take and Plan. On desktop it always takes the right half, even without Your free time
 * (no place, error), and it reserves the Plan card plus one row of tiles, so the tiles arriving
 * with a result do not move what is below. Three or more tiles (two rows) still grow it.
 *
 * The container is up to 1200 px (main: max 1200 px minus 2 * 16 px gutter), so the half column
 * is C = min(100vw, 1200px) - 32px wide in the page, (C - 24) * 2/3 for the right panel and half
 * of that minus the 24 px gap, (C - 24) / 3 - 12, for this column: 310.7 px at 1024, 369.3 px from
 * 1200 up (1280 and 1440 give the same). A tile is square, (column - 12) / 2 = (C - 24) / 6 - 12
 * (149 px at 1024, 178.7 px from 1200 up), so the reserve is PLAN + 24 + tile = PLAN + 12 +
 * (min(100vw, 1200px) - 56px) / 6, which is continuous in the width. 100vw counts a classic
 * scrollbar, so it can come out a couple of px too large, never too small.
 *
 * PLAN is the Plan card at that width (measured: 70 px of GlassCard chrome without a subtitle
 * plus PlanControls). The controls re-wrap with the column: 422 px from 1024 up to 1110 px
 * (column up to 339 px), 374 px from 1120 px. The reserve keeps 422 until the container stops
 * growing at 1200 px and uses 374 from there, so it is exact at 1024 and from 1200 up and
 * (slightly) generous in between: 422 + 12 + 161.3 = 595 at 1024, 374 + 12 + 190.7 = 577 at
 * 1200, 1280 and 1440.
 */
const PLAN_CARD_H_CLASS = 'h-[374px] lg:max-[1200px]:h-[422px]';
const SIDE_COLUMN_LG =
  'lg:col-start-2 lg:min-h-[calc(386px+(min(100vw,1200px)-56px)/6)] lg:max-[1200px]:min-h-[calc(434px+(min(100vw,1200px)-56px)/6)] lg:gap-6';
const SIDE_CLASS = `flex min-w-0 flex-col gap-3 ${SIDE_COLUMN_LG}`;

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

function HourlySkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-busy="true"
      data-skeleton=""
      className={`glass ${className}`.trim()}
      style={{ height: HOURLY_SKELETON_H }}
    />
  );
}

function FreeTimeSkeleton({ rows, className = '' }: { rows: number | string; className?: string }) {
  return (
    <div
      aria-busy="true"
      data-skeleton=""
      className={`glass ${className}`.trim()}
      style={{ height: freeTimeSkeletonHeight(rows) }}
    />
  );
}

/** Shown only once a place is stored (<html data-has-place>); the variant is more specific. */
const WITH_PLACE = 'hidden [[data-has-place]_&]:block';

/**
 * Server render and hydration (spec 9): the hero with its H1 (the LCP text, the same as the app's)
 * and, when a place is stored (<html data-has-place>, set by reserveLayout before first paint),
 * the Hourly and Your free time skeletons at their final heights, so nothing below moves. On
 * desktop the Plan card is on the page in every state, so its column is always reserved.
 */
function Placeholder() {
  return (
    <div className={LAYOUT_CLASS} style={BOTTOM_SPACE}>
      <div className={HERO_COLUMN_CLASS}>
        <div
          // The hero's fixed pre-content height (spec 9), with its scrim under the H1.
          className="relative flex h-[300px] w-full flex-col items-center justify-center px-4 py-6 text-center text-text lg:items-start lg:text-left [text-shadow:0_1px_2px_rgb(0_0_0/0.25)]"
        >
          <div aria-hidden="true" className="hero-scrim pointer-events-none" />
          <h1 className="relative m-0 text-xs font-semibold uppercase leading-4 tracking-[0.06em]">
            {HERO_H1}
          </h1>
        </div>
      </div>
      {/* A first visit on a phone shows no cards; desktop always has the Plan column. */}
      <div className="hidden min-w-0 flex-col gap-3 lg:flex lg:gap-6 [[data-has-place]_&]:flex">
        <HourlySkeleton className={WITH_PLACE} />
        <div className={SPLIT_CLASS}>
          <FreeTimeSkeleton rows="var(--free-rows, 6)" className={WITH_PLACE} />
          <div className={`hidden min-w-0 flex-col lg:flex ${SIDE_COLUMN_LG}`}>
            <div aria-busy="true" data-skeleton="" className={`glass ${PLAN_CARD_H_CLASS}`} />
          </div>
        </div>
      </div>
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
  const sky = useSkyPair(state, evaluation, now);
  const introKey =
    place === null || evaluation === null
      ? null
      : `${place.id}:${place.lat},${place.lon}:${inputs.day}`;
  const { playIntro: introRun } = useFirstResult(introKey, reduced);
  // Without the motion features nothing would leave its intro values: no intro, and the page
  // remounts below at rest.
  const motionFailed = useFeaturesFailed();
  const playIntro = introRun && !motionFailed;

  // The Plan sheet exists only below 1024 px; past it the Plan card is on the page instead.
  const isDesktop = useIsDesktop();
  // On a phone the hero folds into a pinned bar as the page scrolls; on desktop it stays put.
  const collapse = useHeroCollapse(!isDesktop);
  // Touch devices swipe between the days; 0 is Today, 1 is Tomorrow (the sky reads it).
  const coarsePointer = useMediaQuery('(pointer: coarse)');
  const swipeEnabled = coarsePointer && !reduced && !isDesktop;
  const dayProgress = useMotionValue(inputs.day === 'tomorrow' ? 1 : 0);
  const noTopCap = useMotionValue(0);
  const [planOpen, setPlanOpen] = useState(false);
  if (isDesktop && planOpen) setPlanOpen(false);
  const [citiesOpen, setCitiesOpen] = useState(false);
  const [layers] = useState(fixedLayers);
  const skyChunk = useIdleSkyCanvas();

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

  // The sticky card headers sit below the pinned bar, which exists on a phone with a result.
  const barShown = !isDesktop && hero.kind === 'result';

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
        index={0}
        tuck={barShown}
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
        index={1}
        tuck={barShown}
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

  const rootStyle = {
    ...BOTTOM_SPACE,
    '--hero-collapsed-h': `${barShown ? COLLAPSED_H : 0}px`,
  } as CSSProperties;

  return (
    <div className={LAYOUT_CLASS} style={rootStyle}>
      {/* The fixed layers stay outside the page, which scales under an open sheet. */}
      {createPortal(
        <>
          {/* Behind everything. */}
          {skyChunk && (
            <skyChunk.default
              today={sky.today}
              tomorrow={sky.tomorrow}
              progress={dayProgress}
              // The bar and the titles stuck under it sit in the sun zone: no sun past the cap there.
              topCap={barShown ? collapse.barOpacity : noTopCap}
              reducedMotion={reduced}
            />
          )}
          {barShown && hero.kind === 'result' && (
            <CollapsedBar
              place={placeTitle(hero.place).name}
              label={hero.best.label}
              verdict={hero.best.verdict}
              opacity={collapse.barOpacity}
            />
          )}
          <Toolbar
            day={inputs.day}
            onDay={(day) => dispatch({ type: 'setDay', day })}
            panelId={DAY_PANEL_ID}
            onPlan={isDesktop ? undefined : () => setPlanOpen(true)}
            onCities={() => openCities(false)}
            planRef={planRef}
            citiesRef={citiesRef}
          />
        </>,
        layers,
      )}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <DayPager
        key={motionFailed ? 'at-rest' : 'live'}
        day={inputs.day}
        onDay={(day) => dispatch({ type: 'setDay', day })}
        enabled={swipeEnabled}
        progress={dayProgress}
        className={PAGER_CLASS}
      >
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
            collapse={collapse}
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
      </DayPager>

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
          <button type="button" onClick={() => setPlanOpen(false)} className={SHEET_BUTTON_CLASS}>
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
