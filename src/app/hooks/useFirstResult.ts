import { useEffect, useState } from 'react';
import { totalDuration } from '../../motion/choreography';

export interface FirstResultState {
  /** True while the first-result choreography runs (spec 5.2); false for plain recalculations. */
  playIntro: boolean;
}

/**
 * The choreography plays once per `key` (place + day): the first result for a place and every
 * day change. Input changes keep the key, so they only recalculate. `key` is null while there is
 * nothing to show. With reduced motion there is no choreography at all.
 */
export function useFirstResult(key: string | null, reduced: boolean): FirstResultState {
  const [run, setRun] = useState<{ key: string; playing: boolean } | null>(null);

  let current = run;
  if (key !== null && run?.key !== key) {
    // Start the run in the same render, so children never see a frame without the intro.
    current = { key, playing: !reduced };
    setRun(current);
  }

  const runKey = current?.key ?? null;
  useEffect(() => {
    if (runKey === null) return;
    const done = setTimeout(
      () => setRun((r) => (r?.key === runKey && r.playing ? { key: runKey, playing: false } : r)),
      totalDuration() * 1000,
    );
    return () => clearTimeout(done);
  }, [runKey]);

  return { playIntro: key !== null && current?.key === key && current.playing };
}
