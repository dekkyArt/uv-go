import type { ReactNode, Ref } from 'react';
import type { Place } from '../../data/types';
import type { DurationMin, EmptyReason, TimeWindow } from '../../domain/types';
import { BUTTON_CLASS, durationLabel, GEO_ERROR, VERDICT_FILL_CLASS, verdictLabel } from '../ui';
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
  /** Reserved for the first-load choreography (Task 14). */
  intro: boolean;
  findCityRef?: Ref<HTMLButtonElement>;
}

const SECONDARY_LINE = 'm-0 max-w-[34ch] text-balance text-[17px] font-medium leading-6';

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
  findCityRef,
}: HeroProps) {
  const title = state.kind === 'no-place' ? null : placeTitle(state.place);
  const bigTime =
    state.kind === 'result' ? state.best.label : state.kind === 'empty' ? '—' : '--:--';

  let below: ReactNode = null;
  if (state.kind === 'no-place') {
    below = (
      <>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={onUseLocation}
            aria-busy={locating}
            disabled={locating}
            className={`${BUTTON_CLASS} disabled:opacity-60`}
          >
            {locating ? 'Locating…' : 'Use my location'}
          </button>
          <button type="button" ref={findCityRef} onClick={onFindCity} className={BUTTON_CLASS}>
            Find a city
          </button>
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
        <button type="button" onClick={onRetry} className={BUTTON_CLASS}>
          Try again
        </button>
      </>
    );
  } else if (state.kind === 'empty') {
    below = (
      <>
        <p className={SECONDARY_LINE}>{emptyText(state.reason, state.duration)}</p>
        {state.reason === 'past' && (
          <button type="button" onClick={onShowTomorrow} className={BUTTON_CLASS}>
            Show tomorrow
          </button>
        )}
      </>
    );
  } else {
    below = (
      <>
        <p className="m-0 flex items-center justify-center gap-2 text-xl font-medium leading-7">
          <span
            aria-hidden="true"
            data-verdict={state.best.verdict}
            className={`size-2.5 shrink-0 rounded-full ${VERDICT_FILL_CLASS[state.best.verdict]}`}
          />
          <span>{`${verdictLabel(state.best.verdict)} · ${durationLabel(state.duration)}`}</span>
        </p>
        {state.reason ? <p className={SECONDARY_LINE}>{state.reason}</p> : null}
        {state.nowLine ? <p className={`${SECONDARY_LINE}`}>{state.nowLine}</p> : null}
      </>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex min-h-[300px] w-full flex-col items-center justify-center gap-2 px-4 py-6 text-center text-text [text-shadow:0_1px_2px_rgb(0_0_0/0.25)]">
        <div
          aria-hidden="true"
          className="hero-scrim pointer-events-none absolute -inset-x-4 -inset-y-6"
        />
        <div className="relative flex w-full flex-col items-center gap-2">
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
          <p
            data-hero-time
            className={`tabular m-0 text-[length:min(16vw,104px)] font-extralight leading-none tracking-[-0.02em] ${
              state.kind === 'loading' ? 'motion-safe:animate-pulse' : ''
            }`}
          >
            {bigTime}
          </p>
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
