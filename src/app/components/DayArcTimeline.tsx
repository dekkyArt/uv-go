import { m, useReducedMotion } from 'motion/react';
import { useId } from 'react';
import { sunPosition } from '../../domain/sky';
import type { DayForecast, ScoredHour, TimeWindow } from '../../domain/types';
import { durations, ease, springs } from '../../motion/tokens';
import { HourStrip } from './HourStrip';

interface Props {
  day: DayForecast;
  hours: ScoredHour[];
  freeTime: { start: number; end: number };
  best: TimeWindow | null;
  selectedHour: number | null;
  onSelect(h: number | null): void;
  playIntro: boolean;
}

// Half-ellipse in a 320 x 140 viewBox: the baseline sits at y = 120, the apex at y = 20.
const CENTRE = { x: 160, y: 120 };
const RADIUS = { x: 140, y: 100 };
const VIEW_BOX = '0 0 320 140';
const DEFAULT_HOUR = 12;
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;

/** Point on the day arc for t in 0..1 (sunrise to sunset). */
export function arcPoint(t: number): { x: number; y: number } {
  const angle = Math.PI * t;
  return {
    x: CENTRE.x - RADIUS.x * Math.cos(angle),
    y: CENTRE.y - RADIUS.y * Math.sin(angle),
  };
}

const ARC_PATH = (() => {
  const start = arcPoint(0);
  const end = arcPoint(1);
  return `M${start.x} ${start.y}A${RADIUS.x} ${RADIUS.y} 0 0 1 ${end.x} ${end.y}`;
})();

/** At night the moon crosses the arc with midnight at the top. */
function moonPosition(hour: number): number {
  return ((hour + HOURS_PER_DAY / 2) % HOURS_PER_DAY) / HOURS_PER_DAY;
}

export function DayArcTimeline({
  day,
  hours,
  freeTime,
  best,
  selectedHour,
  onSelect,
  playIntro,
}: Props) {
  const reduced = useReducedMotion() ?? false;
  const drawMask = `arc-draw-${useId().replace(/:/g, '')}`;

  // The sky follows the selected hour, else the best window, else midday.
  const refHour = selectedHour ?? best?.startHour ?? DEFAULT_HOUR;
  const isDay = hours[refHour]?.isDay ?? false;
  const position = isDay
    ? sunPosition(refHour * MINUTES_PER_HOUR, day.sunrise, day.sunset, true)
    : moonPosition(refHour);
  const { x, y } = arcPoint(position);

  return (
    <div className="flex flex-col gap-3">
      <svg viewBox={VIEW_BOX} aria-hidden="true" className="h-auto w-full">
        <line
          x1={arcPoint(0).x}
          y1={CENTRE.y}
          x2={arcPoint(1).x}
          y2={CENTRE.y}
          stroke="var(--color-border)"
          strokeWidth="1"
        />
        {/* Motion owns strokeDasharray while pathLength animates, so the draw runs on a mask
            and the dotted path stays static. */}
        <mask id={drawMask}>
          <m.path
            d={ARC_PATH}
            fill="none"
            stroke="white"
            strokeWidth="6"
            initial={playIntro && !reduced ? { pathLength: 0 } : false}
            animate={{ pathLength: 1, transition: { duration: durations.slow, ease } }}
          />
        </mask>
        <path
          d={ARC_PATH}
          fill="none"
          stroke="var(--color-text-muted)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="1 6"
          mask={`url(#${drawMask})`}
        />
        <m.g
          initial={false}
          animate={{ x, y }}
          transition={springs.gentle}
          {...(isDay
            ? { 'data-sun': '', 'data-position': position }
            : { 'data-moon': '', 'data-position': position })}
        >
          {isDay ? (
            <circle
              r="9"
              fill="var(--color-verdict-yellow)"
              stroke="var(--color-text)"
              strokeWidth="2"
            />
          ) : (
            <path
              d="M2 -9A9 9 0 1 0 9 5A7 7 0 0 1 2 -9Z"
              fill="var(--color-surface-strong)"
              stroke="var(--color-text)"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          )}
        </m.g>
      </svg>
      <HourStrip
        hours={hours}
        freeTime={freeTime}
        best={best}
        selectedHour={selectedHour}
        onSelect={onSelect}
        playIntro={playIntro}
      />
    </div>
  );
}
