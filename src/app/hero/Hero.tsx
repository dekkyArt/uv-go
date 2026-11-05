import { m, useReducedMotion, type TargetAndTransition } from 'motion/react';
import type { ReactNode, Ref } from 'react';
import type { Place } from '../../data/types';
import type { DurationMin, EmptyReason, TimeWindow } from '../../domain/types';
import { firstResult } from '../../motion/choreography';
import { usePress } from '../../motion/press';
import { durations, springs } from '../../motion/tokens';
import {
  BUTTON_CLASS,
  HERO_PIN_BUTTON_CLASS,
  durationLabel,
  GEO_ERROR,
  VERDICT_FILL_CLASS,
  verdictLabel,
} from '../ui';
import { NumericRoll } from '../components/NumericRoll';
import { PinEditIcon } from '../icons/PinEditIcon';
import { placeTitle } from './heroText';
import type { HeroCollapse } from './useHeroCollapse';

export const HERO_H1 = 'Know the best time to go outside';

export type HeroState =
  | { kind: 'no-place' }
  | { kind: 'loading'; place: Place }
  | { kind: 'error'; place: Place }
  | { kind: 'empty'; place: Place; reason: EmptyReason; duration: DurationMin }
  | {
      kind: 'result';
      place: Place;
      best: TimeWindow;
      reason: string | null;
      duration: DurationMin;
      nowLine: string;
    };

interface HeroProps {
  state: HeroState;
  /** A position request is in flight (no-place state). */
  locating: boolean;
  geoError: boolean;
  onUseLocation(): void;
  onFindCity(): void;
  onRetry(): void;
  onShowTomorrow(): void;
  /** The day switched to tomorrow by itself: say so under the hero. */
  notice: boolean;
  /** What to take, under the answer and above the notice (a reserved row while loading). */
  take?: ReactNode;
  /** The first-result choreography is playing: the best time and the verdict come in. */
  intro: boolean;
  /** Scroll-bound values that fold the result into the pinned bar; absent, nothing folds. */
  collapse?: HeroCollapse;
  findCityRef?: Ref<HTMLButtonElement>;
  /**
   * Opens Cities from a pin next to the place's name (desktop, which has no toolbar). Absent, or
   * before a place is chosen ("Find a city" is there then), there is no pin.
   */
  onCities?: () => void;
  citiesRef?: Ref<HTMLButtonElement>;
}

/**
 * The hero's box, shared with the server placeholder (UvGoApp) so the H1 does not move when the app
 * arrives. Centred on a phone; on desktop the text starts at the column's edge and top, in line
 * with the header's logo and the first card, as there is no plate to inset it from.
 */
export const HERO_BOX_CLASS =
  'sky-text flex w-full flex-col items-center justify-center gap-2 px-4 pb-3 pt-6 text-center text-text lg:items-start lg:justify-start lg:p-0 lg:text-left';

const SECONDARY_LINE = 'm-0 max-w-[34ch] text-balance text-[17px] font-medium leading-6';

/** The best time and the verdict line come out of a blur (spec 5.2). */
const HIDDEN = { opacity: 0, y: 12, filter: 'blur(8px)' };

function comeIn(delay: number): TargetAndTransition {
  return {
    opacity: [0, 1],
    y: [12, 0],
    filter: ['blur(8px)', 'blur(0px)'],
    transition: { ...springs.smooth, duration: firstResult.heroInDuration, delay },
    // No filter left behind: even blur(0px) keeps the text on its own layer.
    transitionEnd: { filter: 'none' },
  };
}

/** Every key the intro or the pulse touches, so none is left to animate back to `initial`. */
const REST: TargetAndTransition = {
  opacity: 1,
  y: 0,
  filter: 'none',
  transition: { duration: durations.fast },
};

/** "--:--" breathes while loading; 0.6 keeps the placeholder readable. */
const PULSE: TargetAndTransition = {
  opacity: [1, 0.6, 1],
  y: 0,
  filter: 'none',
  transition: { duration: 1.6, ease: 'easeInOut', repeat: Infinity },
};

function emptyText(reason: EmptyReason, duration: DurationMin): string {
  if (reason === 'too-short') {
    return `Your free time is shorter than ${durationLabel(duration)}. Extend it or pick a shorter outing.`;
  }
  if (reason === 'dark')
    return 'No daylight window fits this outing. Change your free time or duration.';
  return 'No future start time fits your plan today.';
}

/**
 * The central answer block: white text straight on the sky, no plate behind it. Each glyph carries
 * the dark rim of `.sky-text` (global.css), which keeps the small lines legible on any sky.
 */
export function Hero({
  state,
  locating,
  geoError,
  onUseLocation,
  onFindCity,
  onRetry,
  onShowTomorrow,
  notice,
  take,
  intro,
  collapse,
  findCityRef,
  onCities,
  citiesRef,
}: HeroProps) {
  const reduced = useReducedMotion() ?? false;
  const play = intro && !reduced && state.kind === 'result';
  const press = usePress();
  const title = state.kind === 'no-place' ? null : placeTitle(state.place);
  // Only a result folds: the other states carry buttons that must stay on the page.
  const fold = state.kind === 'result' ? collapse : undefined;
  const bigTime =
    state.kind === 'result' ? state.best.label : state.kind === 'empty' ? '—' : '--:--';

  let below: ReactNode = null;
  if (state.kind === 'no-place') {
    below = (
      <>
        <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
          <m.button
            {...press}
            type="button"
            onClick={onUseLocation}
            aria-busy={locating}
            disabled={locating}
            className={`${BUTTON_CLASS} disabled:opacity-60`}
          >
            {locating ? 'Locating…' : 'Use my location'}
          </m.button>
          <m.button
            {...press}
            type="button"
            ref={findCityRef}
            onClick={onFindCity}
            className={BUTTON_CLASS}
          >
            Find a city
          </m.button>
        </div>
        <p role="alert" className="m-0 min-h-6 max-w-[34ch] text-[15px] font-medium leading-6">
          {geoError ? GEO_ERROR : null}
        </p>
      </>
    );
  } else if (state.kind === 'loading') {
    below = (
      <p role="status" className={`${SECONDARY_LINE}`}>
        Loading forecast…
      </p>
    );
  } else if (state.kind === 'error') {
    below = (
      <>
        <p role="alert" className={SECONDARY_LINE}>
          Couldn&apos;t load the forecast.
        </p>
        <m.button {...press} type="button" onClick={onRetry} className={BUTTON_CLASS}>
          Try again
        </m.button>
      </>
    );
  } else if (state.kind === 'empty') {
    below = (
      <>
        <p className={SECONDARY_LINE}>{emptyText(state.reason, state.duration)}</p>
        {state.reason === 'past' && (
          <m.button {...press} type="button" onClick={onShowTomorrow} className={BUTTON_CLASS}>
            Show tomorrow
          </m.button>
        )}
      </>
    );
  } else {
    below = (
      <>
        {/* The intro animates the line's own opacity, so the scroll fade goes on a wrapper. */}
        <m.div style={{ opacity: fold?.eyebrowOpacity }}>
          <m.p
            initial={play ? HIDDEN : false}
            animate={play ? comeIn(firstResult.heroIn + firstResult.verdictLag) : REST}
            className="m-0 flex items-center justify-center gap-2 text-xl font-medium leading-7 lg:justify-start"
          >
            <span
              aria-hidden="true"
              data-verdict={state.best.verdict}
              className={`size-2.5 shrink-0 rounded-full ${VERDICT_FILL_CLASS[state.best.verdict]}`}
            />
            <span>{`${verdictLabel(state.best.verdict)} · ${durationLabel(state.duration)}`}</span>
          </m.p>
        </m.div>
        {state.reason ? (
          <m.p style={{ opacity: fold?.detailsOpacity }} className={SECONDARY_LINE}>
            {state.reason}
          </m.p>
        ) : null}
        {state.nowLine ? (
          <m.p style={{ opacity: fold?.detailsOpacity }} className={SECONDARY_LINE}>
            <NumericRoll value={state.nowLine} />
          </m.p>
        ) : null}
      </>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 lg:items-start">
      {/* boot-in: comes in as the boot splash hands over (global.css). */}
      <div className={`boot-in ${HERO_BOX_CLASS} min-h-[300px] [--boot-i:1]`}>
        {/* A size container: the big time is capped by this width as well as by the viewport. */}
        <div className="@container flex w-full flex-col items-center gap-2 lg:items-start">
          <m.h1
            style={{ opacity: fold?.eyebrowOpacity }}
            className="m-0 text-xs font-semibold uppercase leading-4 tracking-[0.06em]"
          >
            {HERO_H1}
          </m.h1>
          <div className="flex max-w-full items-center gap-3">
            <p className="m-0 min-w-0 break-words text-[32px] font-normal leading-10 lg:text-[40px] lg:leading-[48px]">
              {title ? (
                <>
                  {title.mine && <span aria-hidden="true">➤ </span>}
                  {title.name}
                </>
              ) : (
                'Choose a place'
              )}
            </p>
            {title && onCities && (
              <m.button
                {...press}
                ref={citiesRef}
                type="button"
                onClick={onCities}
                className={HERO_PIN_BUTTON_CLASS}
              >
                <PinEditIcon />
                <span className="sr-only">Cities</span>
              </m.button>
            )}
          </div>
          {/* The scroll transform lives here: the intro animates the time's own y. */}
          <m.div
            data-hero-collapse
            style={{ scale: fold?.timeScale, y: fold?.timeY }}
            className="origin-top"
          >
            <m.p
              data-hero-time
              initial={play ? HIDDEN : false}
              animate={
                play
                  ? comeIn(firstResult.heroIn)
                  : state.kind === 'loading' && !reduced
                    ? PULSE
                    : REST
              }
              // "15:00–16:00" is about 5.5em wide in SF Pro and 6em in Inter: 16cqi keeps it on one
              // line in the hero's own width (a 320 px phone, the desktop column), where 16vw would not.
              className="tabular m-0 whitespace-nowrap text-[length:min(16vw,104px,16cqi)] font-extralight leading-none tracking-[-0.02em]"
            >
              {/* A fresh roll per kind: "--:--" turning into the first result is the intro's job. */}
              <NumericRoll key={state.kind} value={bigTime} />
            </m.p>
          </m.div>
          {below}
        </div>
        {take ? <div className="mt-2 w-full">{take}</div> : null}
        {/* No plate: the line sits on the sky with the hero's rim, like the text above it. */}
        {notice && (
          <p role="status" className="m-0 max-w-[34ch] text-[15px] font-medium leading-5">
            No future start time fits today — showing tomorrow
          </p>
        )}
      </div>
    </div>
  );
}
