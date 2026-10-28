import { useEffect, useRef, type RefObject } from 'react';
import { formatPlace } from '../../data/geocoding';
import type { Place } from '../../data/types';
import { CitySearch } from '../components/CitySearch';
import { useGeolocate } from '../hooks/useGeolocate';
import { GEO_ERROR } from '../ui';
import { Sheet } from './Sheet';

interface Props {
  open: boolean;
  onClose(): void;
  place: Place | null;
  onPlace(p: Place): void;
  returnFocusRef: RefObject<HTMLElement | null>;
}

const ACTION_CLASS =
  'inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-white/15 bg-white/10 px-4 text-base font-medium text-white hover:bg-white/15 disabled:opacity-60';

/** Cities sheet: the current place, search, and "Use my location". Picking a place closes it. */
export function CitiesSheet({ open, onClose, place, onPlace, returnFocusRef }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const { locating, geoError, locate, clearError, cancel } = useGeolocate(choose);

  // A refused position leaves the cursor in the search, the alternative the message points to.
  useEffect(() => {
    if (geoError) inputRef.current?.focus();
  }, [geoError]);

  // Every way out (Esc, backdrop, drag, Close, a picked place) ends here: a position that
  // arrives later must not override the user's choice or leave a stale error behind.
  function close() {
    cancel();
    clearError();
    onClose();
  }

  function choose(p: Place) {
    onPlace(p);
    close();
  }

  return (
    <Sheet open={open} onClose={close} title="Cities" size="tall" returnFocusRef={returnFocusRef}>
      <div className="flex flex-col gap-4">
        {place && (
          <p className="flex items-center gap-2 text-base">
            <span aria-hidden="true">📍</span>
            <span className="font-medium">{formatPlace(place)}</span>
          </p>
        )}
        <CitySearch onSelect={choose} inputRef={inputRef} />
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={locate}
            aria-busy={locating}
            disabled={locating}
            className={ACTION_CLASS}
          >
            {locating ? 'Locating…' : 'Use my location'}
          </button>
          <p role="alert" className="text-sm text-verdict-red-text">
            {geoError ? GEO_ERROR : null}
          </p>
        </div>
        <button type="button" onClick={close} className={ACTION_CLASS}>
          Close
        </button>
      </div>
    </Sheet>
  );
}
