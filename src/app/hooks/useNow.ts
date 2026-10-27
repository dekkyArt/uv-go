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

/** Current time in the location's zone, refreshed every minute and when the tab wakes (null until the zone is known). */
export function useNow(utcOffsetSeconds: number | null): NowLocal | null {
  const [state, setState] = useState(() => snapshot(utcOffsetSeconds));

  // A new offset (another location) invalidates the stored value immediately, during render.
  if (state.offset !== utcOffsetSeconds) setState(snapshot(utcOffsetSeconds));

  useEffect(() => {
    if (utcOffsetSeconds === null) return;
    const refresh = () => setState(snapshot(utcOffsetSeconds));
    const id = setInterval(refresh, NOW_TICK_MS);
    // A sleeping tab or phone may have skipped many ticks: catch up as soon as it is visible again.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [utcOffsetSeconds]);

  return state.offset === utcOffsetSeconds ? state.now : snapshot(utcOffsetSeconds).now;
}
