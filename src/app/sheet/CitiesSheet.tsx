import { useEffect, useRef, type RefObject } from 'react';
import { formatPlace } from '../../data/geocoding';
import { placeTitle } from '../hero/heroText';
import type { Place } from '../../data/types';
import { CitySearch } from '../components/CitySearch';
import { useGeolocate } from '../hooks/useGeolocate';
import { GEO_ERROR, SHEET_BUTTON_CLASS, VERDICT_FILL_CLASS } from '../ui';
import { Sheet } from './Sheet';

interface Props {
  open: boolean;
  onClose(): void;
  place: Place | null;
  onPlace(p: Place): void;
  returnFocusRef: RefObject<HTMLElement | null>;
}

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
            <span className="font-medium">
              {placeTitle(place).mine ? placeTitle(place).name : formatPlace(place)}
            </span>
          </p>
        )}
        <CitySearch onSelect={choose} inputRef={inputRef} />
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={locate}
            aria-busy={locating}
            disabled={locating}
            className={SHEET_BUTTON_CLASS}
          >
            {locating ? 'Locating…' : 'Use my location'}
          </button>
          {/* White text: red text falls short of 4.5:1 on the glass, so the dot carries the colour. */}
          <p role="alert" className="flex items-center gap-2 text-sm text-text">
            {geoError ? (
              <>
                <span
                  aria-hidden="true"
                  className={`size-2 shrink-0 rounded-full ${VERDICT_FILL_CLASS.red}`}
                />
                {GEO_ERROR}
              </>
            ) : null}
          </p>
        </div>
        <button type="button" onClick={close} className={SHEET_BUTTON_CLASS}>
          Close
        </button>
      </div>
    </Sheet>
  );
}
