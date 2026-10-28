import type { Ref } from 'react';
import type { Inputs } from '../../domain/types';
import { DayDots } from './DayDots';

interface Props {
  day: Inputs['day'];
  onDay(d: Inputs['day']): void;
  panelId: string;
  /** Opens the Plan sheet. Omitted on desktop, where the Plan card is on the page. */
  onPlan?: () => void;
  onCities(): void;
  planRef: Ref<HTMLButtonElement>;
  citiesRef: Ref<HTMLButtonElement>;
}

const ROUND_BUTTON =
  'glass pointer-events-auto flex size-12 items-center justify-center rounded-full text-text';

const ICON = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

/** Floats at the bottom centre: Plan (mobile), the Today/Tomorrow dots, Cities. */
export function Toolbar({ day, onDay, panelId, onPlan, onCities, planRef, citiesRef }: Props) {
  return (
    <nav
      aria-label="App"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(12px+env(safe-area-inset-bottom))] z-30 flex items-center justify-center gap-3"
    >
      {onPlan && (
        <button ref={planRef} type="button" className={ROUND_BUTTON} onClick={onPlan}>
          <svg {...ICON}>
            <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
            <circle cx="16" cy="6" r="2" />
            <circle cx="10" cy="12" r="2" />
            <circle cx="18" cy="18" r="2" />
          </svg>
          <span className="sr-only">Plan</span>
        </button>
      )}
      <div className="glass pointer-events-auto flex h-12 items-center rounded-full px-1">
        <DayDots day={day} onDay={onDay} panelId={panelId} />
      </div>
      <button ref={citiesRef} type="button" className={ROUND_BUTTON} onClick={onCities}>
        <svg {...ICON}>
          <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
        </svg>
        <span className="sr-only">Cities</span>
      </button>
    </nav>
  );
}
