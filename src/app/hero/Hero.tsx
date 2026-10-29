import { m, useReducedMotion, type TargetAndTransition } from 'motion/react';
import type { ReactNode, Ref } from 'react';
import type { Place } from '../../data/types';
import type { DurationMin, EmptyReason, TimeWindow } from '../../domain/types';
import { firstResult } from '../../motion/choreography';
import { usePress } from '../../motion/press';
import { durations, springs } from '../../motion/tokens';
import { BUTTON_CLASS, durationLabel, GEO_ERROR, VERDICT_FILL_CLASS, verdictLabel } from '../ui';
import { NumericRoll } from '../components/NumericRoll';
import { placeTitle } from './heroText';

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
  /** The first-result choreography is playing: the best time and the verdict come in. */
  intro: boolean;
  findCityRef?: Ref<HTMLButtonElement>;
}

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
  if (reason === 'dark') return "It's dark during your free time. Try earlier hours.";
  return 'No time left today.';
}

/** The central answer block, white text straight on the sky over a soft dark scrim. */
export function Hero({
  state,
  locating,
  geoError,
  onUseLocation,
  onFindCity,
  onRetry,
  onShowTomorrow,
  notice,
  intro,
  findCityRef,
}: HeroProps) {
  const reduced = useReducedMotion() ?? false;
  const play = intro && !reduced && state.kind === 'result';
  const press = usePress();
  const title = state.kind === 'no-place' ? null : placeTitle(state.place);
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
        {state.reason ? <p className={SECONDARY_LINE}>{state.reason}</p> : null}
        {state.nowLine ? (
          <p className={SECONDARY_LINE}>
            <NumericRoll value={state.nowLine} />
          </p>
        ) : null}
      </>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 lg:items-start">
      <div className="relative flex min-h-[300px] w-full flex-col items-center justify-center gap-2 px-4 py-6 text-center text-text lg:items-start lg:text-left [text-shadow:0_1px_2px_rgb(0_0_0/0.25)]">
        <div aria-hidden="true" className="hero-scrim pointer-events-none" />
        {/* A size container: the big time is capped by this width as well as by the viewport. */}
        <div className="@container relative flex w-full flex-col items-center gap-2 lg:items-start">
          <h1 className="m-0 text-xs font-semibold uppercase leading-4 tracking-[0.06em]">
            {HERO_H1}
          </h1>
          <p className="m-0 max-w-full break-words text-[32px] font-normal leading-10 lg:text-[40px] lg:leading-[48px]">
            {title ? (
              <>
                {title.mine && <span aria-hidden="true">➤ </span>}
                {title.name}
              </>
            ) : (
              'Choose a place'
            )}
          </p>
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
          {below}
        </div>
      </div>
      {notice && (
        <p role="status" className="glass m-0 px-4 py-2 text-[15px] font-medium leading-5">
          Your free time today has passed — showing tomorrow
        </p>
      )}
    </div>
  );
}
