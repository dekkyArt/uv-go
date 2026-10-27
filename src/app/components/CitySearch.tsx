import { useId, useState, type KeyboardEvent, type RefObject } from 'react';
import { formatPlace } from '../../data/geocoding';
import type { Place } from '../../data/types';
import { useCitySearch } from '../hooks/useCitySearch';

interface Props {
  onSelect(p: Place): void;
  inputRef: RefObject<HTMLInputElement | null>;
}

const MIN_QUERY_LENGTH = 2;
const NONE = -1;

export function CitySearch({ onSelect, inputRef }: Props) {
  const [query, setQuery] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(NONE);
  const { results, status } = useCitySearch(query);
  const listId = useId();

  const searching = query.trim().length >= MIN_QUERY_LENGTH;
  const open = searching && !dismissed && results.length > 0;
  const activeIndex = active < results.length ? active : NONE;
  const optionId = (i: number) => `${listId}-option-${i}`;

  function select(place: Place) {
    setQuery('');
    setActive(NONE);
    setDismissed(false);
    onSelect(place);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case 'ArrowDown':
        if (results.length === 0) return;
        e.preventDefault();
        setDismissed(false);
        setActive((activeIndex + 1) % results.length);
        break;
      case 'ArrowUp':
        if (results.length === 0) return;
        e.preventDefault();
        setDismissed(false);
        setActive(activeIndex <= 0 ? results.length - 1 : activeIndex - 1);
        break;
      case 'Enter':
        if (!open) return;
        e.preventDefault();
        select(results[activeIndex === NONE ? 0 : activeIndex]);
        break;
      case 'Escape':
        if (!open) return;
        e.preventDefault();
        setDismissed(true);
        setActive(NONE);
        break;
    }
  }

  let message: string | null = null;
  if (searching && status === 'error') message = 'Search is unavailable. Try again.';
  else if (searching && status === 'done' && results.length === 0) message = 'No cities found';

  return (
    <div className="relative">
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search for a city
      </label>
      <input
        ref={inputRef}
        id={`${listId}-input`}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && activeIndex !== NONE ? optionId(activeIndex) : undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder="Search for a city"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setDismissed(false);
          setActive(NONE);
        }}
        onKeyDown={onKeyDown}
        className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base text-text placeholder:text-text-muted"
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Cities"
        hidden={!open}
        className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
      >
        {open &&
          results.map((place, i) => (
            <li
              key={`${place.id}-${i}`}
              id={optionId(i)}
              role="option"
              aria-selected={i === activeIndex}
              // Keep focus in the input so a click never blurs it before selecting.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(place)}
              className={`flex min-h-11 cursor-pointer items-center px-3 text-sm text-text ${
                i === activeIndex ? 'bg-surface-strong' : 'hover:bg-surface-strong'
              }`}
            >
              {formatPlace(place)}
            </li>
          ))}
      </ul>
      <p role="status" className="mt-1 min-h-5 text-sm text-text-muted">
        {message}
      </p>
    </div>
  );
}
