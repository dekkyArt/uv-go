import { m } from 'motion/react';
import type { Ref } from 'react';
import { usePress } from '../../motion/press';
import { PinIcon } from '../icons/PinIcon';
import { ROUND_BUTTON_CLASS } from '../ui';

interface Props {
  /** Opens the Plan sheet (Free time, Duration, Activity and the day). */
  onPlan(): void;
  onCities(): void;
  planRef: Ref<HTMLButtonElement>;
  citiesRef: Ref<HTMLButtonElement>;
}

const ROUND_BUTTON = `${ROUND_BUTTON_CLASS} pointer-events-auto size-12`;

/**
 * Floats at the bottom centre on a phone: Plan and Cities. Desktop has none: the Plan card is on
 * the page and Cities sits next to the hero's place.
 */
export function Toolbar({ onPlan, onCities, planRef, citiesRef }: Props) {
  const press = usePress();
  return (
    <nav
      aria-label="App"
      // boot-group: each button comes in as the boot splash hands over (global.css).
      className="boot-group pointer-events-none fixed inset-x-0 bottom-[calc(12px+env(safe-area-inset-bottom))] z-30 flex items-center justify-center gap-3 [--boot-i:3]"
    >
      <m.button {...press} ref={planRef} type="button" className={ROUND_BUTTON} onClick={onPlan}>
        <svg
          width={22}
          height={22}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
          <circle cx="16" cy="6" r="2" />
          <circle cx="10" cy="12" r="2" />
          <circle cx="18" cy="18" r="2" />
        </svg>
        <span className="sr-only">Plan</span>
      </m.button>
      <m.button
        {...press}
        ref={citiesRef}
        type="button"
        className={ROUND_BUTTON}
        onClick={onCities}
      >
        <PinIcon />
        <span className="sr-only">Cities</span>
      </m.button>
    </nav>
  );
}
