import { m, useReducedMotion, useTransform, type MotionValue } from 'motion/react';
import type { Verdict } from '../../domain/types';
import { VERDICT_FILL_CLASS, VERDICT_SHORT } from '../ui';
import { COLLAPSED_H } from './useHeroCollapse';

interface Props {
  place: string;
  label: string;
  verdict: Verdict;
  opacity: MotionValue<number>;
}

/**
 * The hero folded into a pinned bar (spec 5.3). Pointer and touch only: it is `aria-hidden` and
 * not focusable (keyboard users have the skip link and Home), so it is a plain div, not a button.
 */
export function CollapsedBar({ place, label, verdict, opacity }: Props) {
  const reduced = useReducedMotion() ?? false;
  // Invisible means untouchable: the bar must not eat taps meant for the page under it.
  const pointerEvents = useTransform(opacity, (o) => (o > 0.5 ? 'auto' : 'none'));
  return (
    <m.div
      aria-hidden="true"
      data-collapsed-bar
      onClick={() => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })}
      style={{ opacity, pointerEvents, height: COLLAPSED_H }}
      className="glass fixed inset-x-0 top-0 z-20 flex cursor-pointer items-center justify-center gap-2 rounded-none border-x-0 border-t-0 px-4 text-[17px] font-medium leading-6 text-text"
    >
      <span
        data-verdict={verdict}
        className={`size-2.5 shrink-0 rounded-full ${VERDICT_FILL_CLASS[verdict]}`}
      />
      <span className="flex min-w-0">
        <span className="truncate">{place}</span>
        <span className="shrink-0 whitespace-pre">{` · ${label} | ${VERDICT_SHORT[verdict]}`}</span>
      </span>
    </m.div>
  );
}
