import { roundHalfUp } from '../../domain/scoring';
import type { Activity, DurationMin, ScoredHour, TimeWindow } from '../../domain/types';
import { WeatherIcon } from '../icons/weather/Icon';
import { weatherIcon } from '../icons/weather/weatherIcon';
import {
  ROW_H,
  VERDICT_FILL_CLASS,
  VERDICT_SHORT,
  VERDICT_TEXT_CLASS,
  activityLabel,
  durationLabel,
  formatHour,
  verdictLabel,
} from '../ui';
import { GlassCard } from './GlassCard';
import { ScoreBar } from './ScoreBar';
import { freeTimeRows, type FreeTimeRow } from './freeTimeRows';

interface Props {
  hours: ScoredHour[];
  freeTime: { start: number; end: number };
  best: TimeWindow | null;
  /** Current hour of the shown day (Today), or null (Tomorrow). */
  nowHour: number | null;
  duration: DurationMin;
  activity: Activity;
  /** Reserved for the first-result choreography; the card has no intro motion yet. */
  intro: boolean;
}

/** Rain below this share is not worth a line. */
const RAIN_SHOWN_FROM = 30;

/**
 * Past hours: only the decorative icon, bar and verdict dot fade. The text keeps AA contrast by
 * switching to the secondary colour instead of fading, because axe computes contrast through
 * opacity.
 */
const PAST_FADE = 'opacity-45';

// Horizontal padding is set per cell, one utility each, so no two utilities compete.
const CELL = 'align-middle';

function Row({ row, intro }: { row: FreeTimeRow; intro: boolean }) {
  const { hour } = row;
  const verdict = hour.verdict === 'night' ? null : hour.verdict;
  const fade = hour.isPast ? PAST_FADE : '';
  const rain = hour.rainProb === null ? null : roundHalfUp(hour.rainProb);
  const uv = hour.uv === null ? '–' : String(roundHalfUp(hour.uv));

  return (
    <tr
      data-hour={hour.hour}
      {...(hour.isPast ? { 'data-past': '' } : null)}
      style={{ height: ROW_H }}
      className={hour.isPast ? 'text-text-muted' : 'text-text'}
    >
      <td className={`${CELL} pr-1`}>
        <span
          className={`block text-[15px] leading-5 tabular-nums ${row.best ? 'font-semibold' : 'font-normal'}`}
        >
          {formatHour(hour.hour)}
        </span>
        {row.best && (
          <span className="block text-[11px] font-medium uppercase leading-3 tracking-wide">
            Best
          </span>
        )}
      </td>
      <td className={`${CELL} px-1`}>
        <div className="flex flex-col items-center">
          <WeatherIcon
            name={weatherIcon(hour.weatherCode, hour.cloudCover, hour.isDay)}
            className={`size-6 ${fade}`.trim()}
          />
          {rain !== null && rain >= RAIN_SHOWN_FROM && (
            <span
              className={`text-[11px] font-medium leading-3 tabular-nums ${hour.isPast ? 'text-text-muted' : 'text-[#64d2ff]'}`}
            >
              {rain}%
            </span>
          )}
        </div>
      </td>
      <td className={`${CELL} px-0 text-[13px] tabular-nums whitespace-nowrap text-text-muted`}>
        UV {uv}
      </td>
      <td className={`${CELL} px-2`}>
        {row.dark ? (
          <span className="text-[13px] text-text-muted">Dark</span>
        ) : (
          <ScoreBar fill={row.fill} now={row.now} intro={intro} delay={0} className={fade} />
        )}
      </td>
      <td className={`${CELL} pl-1`}>
        {verdict ? (
          <>
            <span
              aria-hidden="true"
              className={`flex items-center gap-1.5 text-[13px] font-medium ${hour.isPast ? 'text-text-muted' : VERDICT_TEXT_CLASS[verdict]}`}
            >
              <span
                data-verdict-dot=""
                className={`size-1.5 shrink-0 rounded-full ${VERDICT_FILL_CLASS[verdict]}${fade && ` ${fade}`}`}
              />
              {VERDICT_SHORT[verdict]}
            </span>
            <span className="sr-only">{verdictLabel(verdict)}</span>
          </>
        ) : (
          <>
            <span aria-hidden="true" className="text-[13px] text-text-muted">
              –
            </span>
            <span className="sr-only">Night</span>
          </>
        )}
      </td>
    </tr>
  );
}

export function FreeTimeCard({ hours, freeTime, best, nowHour, duration, activity, intro }: Props) {
  const rows = freeTimeRows(hours, freeTime, best, nowHour);
  return (
    <GlassCard
      title="Your free time"
      subtitle={`${formatHour(freeTime.start)}–${formatHour(freeTime.end)} · ${activityLabel(activity)} · ${durationLabel(duration)}`}
    >
      <table className="w-full table-fixed border-collapse">
        <caption className="sr-only">Your free time, hour by hour</caption>
        <colgroup>
          <col className="w-[52px]" />
          <col className="w-9" />
          <col className="w-11" />
          <col />
          <col className="w-[60px]" />
        </colgroup>
        <thead>
          <tr>
            {['Time', 'Weather', 'UV', 'Score', 'Verdict'].map((name) => (
              <th key={name} scope="col" className="sr-only">
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Row key={row.hour.hour} row={row} intro={intro} />
          ))}
        </tbody>
      </table>
    </GlassCard>
  );
}
