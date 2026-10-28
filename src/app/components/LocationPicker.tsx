import { useEffect, useRef, useState } from 'react';
import { formatPlace } from '../../data/geocoding';
import { requestPosition, yourLocationPlace } from '../../data/geolocation';
import type { Place } from '../../data/types';
import { BUTTON_CLASS, GEO_ERROR } from '../ui';
import { CitySearch } from './CitySearch';

interface Props {
  place: Place | null;
  onPlace(p: Place): void;
}

export function LocationPicker({ place, onPlace }: Props) {
  const [editing, setEditing] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const showSearch = place === null || editing;

  // "Change" reveals the search; put the cursor in it.
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function choose(p: Place) {
    setEditing(false);
    setGeoError(false);
    onPlace(p);
  }

  async function useMyLocation() {
    setLocating(true);
    setGeoError(false);
    try {
      const { lat, lon } = await requestPosition();
      choose(yourLocationPlace(lat, lon));
    } catch {
      setGeoError(true);
      inputRef.current?.focus();
    } finally {
      setLocating(false);
    }
  }

  if (!showSearch) {
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base">
        <span aria-hidden="true">📍</span>
        <span className="font-medium">{formatPlace(place)}</span>
        <span aria-hidden="true" className="text-text-muted">
          ·
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2 font-medium text-focus underline underline-offset-2"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <button
        type="button"
        onClick={useMyLocation}
        aria-busy={locating}
        disabled={locating}
        className={`${BUTTON_CLASS} sm:shrink-0 disabled:opacity-60`}
      >
        {locating ? 'Locating…' : 'Use my location'}
      </button>
      <div className="min-w-0 flex-1">
        <CitySearch onSelect={choose} inputRef={inputRef} />
        <p role="alert" className="text-sm text-verdict-red-text">
          {geoError ? GEO_ERROR : null}
        </p>
      </div>
      {editing && (
        <button type="button" onClick={() => setEditing(false)} className={BUTTON_CLASS}>
          Cancel
        </button>
      )}
    </div>
  );
}
