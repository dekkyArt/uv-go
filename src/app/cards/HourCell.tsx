import { forwardRef } from 'react';
import { WeatherIcon } from '../icons/weather/Icon';
import { weatherIcon } from '../icons/weather/weatherIcon';
import type { ScoredHour } from '../../domain/types';
import { CELL_W, VERDICT_FILL_CLASS } from '../ui';
import { cellName, metricValue, type Metric, type StripItem } from './stripItems';

/** Fixed cell height, so the best-window outline can be drawn at an exact size. */
export const CELL_H = 100;

/**
 * Past hours: only the decorative icon and dot fade. The text keeps AA contrast by switching to
 * the secondary colour instead of fading, because axe computes contrast through opacity.
 */
const PAST_FADE = 'opacity-45';

const CELL_BASE = 'flex shrink-0 snap-start flex-col items-center justify-between py-2';

interface HourCellProps {
  hour: ScoredHour;
  metric: Metric;
  isNow: boolean;
  selected: boolean;
  tabbable: boolean;
  onPress(): void;
  onFocus(): void;
}

/** One hour: label, weather icon, metric value and verdict dot. A button that opens the details. */
export const HourCell = forwardRef<HTMLButtonElement, HourCellProps>(function HourCell(
  { hour, metric, isNow, selected, tabbable, onPress, onFocus },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      data-hour={hour.hour}
      {...(hour.isPast ? { 'data-past': '' } : null)}
      aria-pressed={selected}
      tabIndex={tabbable ? 0 : -1}
      onClick={onPress}
      onFocus={onFocus}
      style={{ width: CELL_W, height: CELL_H }}
      className={`${CELL_BASE} rounded-2xl ${hour.isPast ? 'text-text-muted' : 'text-text'} ${selected ? 'bg-surface-strong' : ''}`}
    >
      <span aria-hidden="true" className="text-[15px] font-semibold leading-5 tabular-nums">
        {isNow ? 'Now' : String(hour.hour).padStart(2, '0')}
      </span>
      <WeatherIcon
        name={weatherIcon(hour.weatherCode, hour.cloudCover, hour.isDay)}
        className={hour.isPast ? `size-7 ${PAST_FADE}` : undefined}
      />
      <span aria-hidden="true" className="text-[17px] font-medium leading-6 tabular-nums">
        {metricValue(hour, metric)}
      </span>
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${VERDICT_FILL_CLASS[hour.verdict]} ${hour.isPast ? PAST_FADE : ''}`}
      />
      {/* The name is hidden text, not aria-label: the short visible "14" and "5" are not part of
          it word for word, which axe reports as a label/content mismatch. */}
      <span className="sr-only">{cellName(hour)}</span>
    </button>
  );
});

/** Sunrise or sunset between two hours: time, glyph and the event name. Not a button. */
export function SunCell({ item }: { item: Extract<StripItem, { kind: 'sun' }> }) {
  return (
    <div
      data-sun-event={item.event}
      style={{ width: CELL_W, height: CELL_H }}
      className={`${CELL_BASE} text-text`}
    >
      <span className="text-[15px] font-semibold leading-5 tabular-nums">{item.time}</span>
      <WeatherIcon name={item.event} />
      <span className="text-[13px] font-medium leading-6">
        {item.event === 'sunrise' ? 'Sunrise' : 'Sunset'}
      </span>
      <span aria-hidden="true" className="size-1.5" />
    </div>
  );
}
