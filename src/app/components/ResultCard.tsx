import type { Activity, EvaluationResult, TimeWindow, Verdict } from '../../domain/types';
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
}

// Minimal inline icons; the verdict is always icon + text, never colour alone.
function VerdictMark({ verdict }: { verdict: Verdict }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 20 20',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (verdict === 'green') {
    return (
      <svg {...common}>
        <circle cx="10" cy="10" r="8" />
        <path d="M6 10.5l3 3 5-6" />
      </svg>
    );
  }
  if (verdict === 'yellow') {
    return (
      <svg {...common}>
        <path d="M10 2.5l8 14H2z" />
        <path d="M10 8v4M10 14.5v.01" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="10" cy="10" r="8" />
      <path d="M7 7l6 6M13 7l-6 6" />
    </svg>
  );
}

const oneDecimal = (n: number) => n.toFixed(1);

export function ResultCard({ result, activity }: Props) {
  const { best, reason, checklist } = result;
  const length = best.hours.length;

  return (
    <article aria-label="Best time" className={`${CARD_CLASS} flex flex-col gap-4`}>
      <div>
        <p className="text-sm text-text-muted">Best time to go out</p>
        <p className="text-4xl font-bold tracking-tight">{best.label}</p>
      </div>
      <p
        className={`inline-flex items-center gap-2 self-start text-lg font-semibold ${VERDICT_TEXT_CLASS[best.verdict]}`}
      >
        <VerdictMark verdict={best.verdict} />
        <span>{verdictLabel(best.verdict)}</span>
      </p>
      {reason && <p className="text-base">{reason}</p>}
      <details className="text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium">
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
      </details>
      <WhatToTake items={checklist} />
    </article>
  );
}
