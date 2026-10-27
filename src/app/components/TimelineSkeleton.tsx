import { HOUR_STRIP_MIN_H_CLASS } from '../ui';
import { ARC_ASPECT_RATIO } from './DayArcTimeline';

/** Placeholder with the day arc's aspect ratio and the hour strip's height: same size as the real thing. */
export function TimelineSkeleton() {
  return (
    <div data-timeline-skeleton="" aria-hidden="true" className="flex flex-col gap-3">
      <div
        style={{ aspectRatio: ARC_ASPECT_RATIO }}
        className="w-full rounded-md bg-surface-strong"
      />
      <div
        data-strip-skeleton=""
        className={`rounded-md bg-surface-strong ${HOUR_STRIP_MIN_H_CLASS}`}
      />
    </div>
  );
}
