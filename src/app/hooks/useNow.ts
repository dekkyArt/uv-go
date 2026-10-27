import { useEffect, useState } from 'react';
import { nowLocal } from '../../data/time';
import type { NowLocal } from '../../domain/types';

export const NOW_TICK_MS = 60_000;

interface Snapshot {
  offset: number | null;
  now: NowLocal | null;
}

function snapshot(offset: number | null): Snapshot {
  return { offset, now: offset === null ? null : nowLocal(offset) };
}

/** Current time in the location's zone, refreshed every minute (null until the zone is known). */
export function useNow(utcOffsetSeconds: number | null): NowLocal | null {
  const [state, setState] = useState(() => snapshot(utcOffsetSeconds));

  // A new offset (another location) invalidates the stored value immediately, during render.
  if (state.offset !== utcOffsetSeconds) setState(snapshot(utcOffsetSeconds));

  useEffect(() => {
    if (utcOffsetSeconds === null) return;
    const id = setInterval(() => setState(snapshot(utcOffsetSeconds)), NOW_TICK_MS);
    return () => clearInterval(id);
  }, [utcOffsetSeconds]);

  return state.offset === utcOffsetSeconds ? state.now : snapshot(utcOffsetSeconds).now;
}
