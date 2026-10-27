import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, type Ref } from 'react';
import { roundHalfUp } from '../../domain/scoring';
import type { Activity, EvaluationResult, TimeWindow } from '../../domain/types';
import { firstResult } from '../../motion/choreography';
import { durations, springs } from '../../motion/tokens';
import { useCountUp } from '../hooks/useCountUp';
import { VerdictIcon } from '../icons/VerdictIcon';
import {
  CARD_CLASS,
  FACTORS,
  FACTOR_LABELS,
  VERDICT_TEXT_CLASS,
  activityLabel,
  verdictLabel,
} from '../ui';
import { WhatToTake } from './WhatToTake';

interface Props {
  result: EvaluationResult & { best: TimeWindow };
  activity: Activity;
  /** First result: the card reveals its body after the label hand-off (ТЗ 10.3). */
  intro?: boolean;
  /** The time label is still travelling in the search frame on the timeline. */
  labelInFrame?: boolean;
  ref?: Ref<HTMLElement>;
}

const oneDecimal = (n: number) => n.toFixed(1);

/** Highest UV in the window, rounded like the rest of the app; null when there is no data. */
function peakUv(best: TimeWindow): number | null {
  const values = best.hours.flatMap((h) => (h.uv === null ? [] : [h.uv]));
  return values.length === 0 ? null : roundHalfUp(Math.max(...values));
}

export function ResultCard({ result, activity, intro = false, labelInFrame = false, ref }: Props) {
  const { best, reason, checklist } = result;
  const length = best.hours.length;
  const reduced = useReducedMotion() ?? false;
  const reveal = intro && !reduced;
  const fade = { duration: reduced ? durations.fast : durations.base };

  // The verdict badge turns from neutral to its colour when the body reveals.
  const [revealed, setRevealed] = useState(!reveal);
  useEffect(() => {
    if (revealed) return;
    const timer = setTimeout(() => setRevealed(true), firstResult.cardReveal * 1000);
    return () => clearTimeout(timer);
  }, [revealed]);

  const [whyOpen, setWhyOpen] = useState(false);

  const uv = peakUv(best);
  const uvRef = useRef<HTMLSpanElement>(null);
  useCountUp(uvRef, uv ?? 0, { intro: reveal, delay: firstResult.cardReveal, reduced });

  return (
    <article ref={ref} aria-label="Best time" className={`${CARD_CLASS} flex flex-col gap-4`}>
      <div>
        <p className="text-sm text-text-muted">Best time to go out</p>
        <p className="relative min-h-10 text-4xl font-bold tracking-tight">
          {labelInFrame && <span className="sr-only">Best time {best.label}</span>}
          {/* The node is not re-keyed by its value, so a recalculation only swaps the text and the
              answer is readable at once (ТЗ 1: animation never hides it). Only the first-result
              hand-off from the timeline frame (layoutId) mounts it and fades it in. */}
          <AnimatePresence initial={false}>
            {!labelInFrame && (
              <m.span
                layoutId="best-window-label"
                className="inline-block"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: fade }}
              >
                {best.label}
              </m.span>
            )}
          </AnimatePresence>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p
          className={`inline-flex items-center gap-2 text-lg font-semibold transition-colors duration-300 motion-reduce:duration-150 ${VERDICT_TEXT_CLASS[best.verdict]}`}
        >
          <VerdictIcon verdict={best.verdict} neutral={!revealed} />
          <span>{verdictLabel(best.verdict)}</span>
        </p>
        {uv !== null && (
          <m.p
            className="text-sm text-text-muted"
            initial={reveal ? { opacity: 0 } : false}
            animate={{
              opacity: 1,
              transition: { ...fade, delay: reveal ? firstResult.cardReveal : 0 },
            }}
          >
            UV <span ref={uvRef} className="font-semibold tabular-nums text-text" />
          </m.p>
        )}
      </div>
      {/* Plain text: a new reason replaces the old one without a fade from 0. */}
      {reason && <p className="text-base">{reason}</p>}
      {/* Neighbours glide to their new place when this block opens instead of jumping. */}
      <m.details layout="position" transition={springs.gentle} open={whyOpen} className="text-sm">
        <summary
          onClick={(event) => {
            event.preventDefault();
            setWhyOpen((open) => !open);
          }}
          className="inline-flex min-h-11 cursor-pointer items-center font-medium"
        >
          Why this time?
        </summary>
        <div className="mt-1 flex flex-col gap-2 text-text-muted">
          <p>
            Average score {oneDecimal(best.score)} (lower is better), scored for{' '}
            {activityLabel(activity).toLowerCase()} activity.
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {FACTORS.map((factor) => {
              const mean = best.hours.reduce((sum, h) => sum + h.points[factor], 0) / length;
              return (
                <li key={factor}>
                  {FACTOR_LABELS[factor]} {oneDecimal(mean)}
                </li>
              );
            })}
          </ul>
        </div>
      </m.details>
      <m.div layout="position" transition={springs.gentle}>
        <WhatToTake items={checklist} intro={intro} />
      </m.div>
    </article>
  );
}
