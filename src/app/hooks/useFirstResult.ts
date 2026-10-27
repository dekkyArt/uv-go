import { useEffect, useState } from 'react';
import { firstResult, totalDuration } from '../../motion/choreography';

type Stage = 'search' | 'handoff' | 'done';

export interface FirstResultState {
  /** True while the first-result choreography runs (ТЗ 10.3); false for plain recalculations. */
  playIntro: boolean;
  /** True until the time label leaves the search frame for the card header. */
  labelInFrame: boolean;
}

/**
 * The choreography plays once per `key` (place + day): the first result for a place and every
 * day change. Input changes keep the key, so they only recalculate. `key` is null while there is
 * nothing to show. With reduced motion there is no choreography at all.
 */
export function useFirstResult(key: string | null, reduced: boolean): FirstResultState {
  const [run, setRun] = useState<{ key: string; stage: Stage } | null>(null);

  let current = run;
  if (key !== null && run?.key !== key) {
    // Start the run in the same render, so children never see a frame without the intro.
    current = { key, stage: reduced ? 'done' : 'search' };
    setRun(current);
  }

  const runKey = current?.key ?? null;
  useEffect(() => {
    if (runKey === null) return;
    const advance = (from: Stage, to: Stage) => () =>
      setRun((r) => (r?.key === runKey && r.stage === from ? { key: runKey, stage: to } : r));
    const handoff = setTimeout(advance('search', 'handoff'), firstResult.labelHandoff * 1000);
    const done = setTimeout(advance('handoff', 'done'), totalDuration() * 1000);
    return () => {
      clearTimeout(handoff);
      clearTimeout(done);
    };
  }, [runKey]);

  const stage = key !== null && current?.key === key ? current.stage : 'done';
  return { playIntro: stage !== 'done', labelInFrame: stage === 'search' };
}
