import type { DurationMin, EmptyReason } from '../../domain/types';
import { BUTTON_CLASS, CARD_CLASS, durationLabel } from '../ui';

interface Props {
  reason: EmptyReason;
  duration: DurationMin;
  onShowTomorrow(): void;
}

export function EmptyState({ reason, duration, onShowTomorrow }: Props) {
  return (
    <div className={`${CARD_CLASS} flex flex-col items-start justify-center gap-4`}>
      {reason === 'too-short' && (
        <p className="text-lg font-medium">
          Your free time is shorter than {durationLabel(duration)}. Extend it or pick a shorter
          outing.
        </p>
      )}
      {reason === 'dark' && (
        <p className="text-lg font-medium">
          It&apos;s dark during your free time. Try earlier hours.
        </p>
      )}
      {reason === 'past' && (
        <>
          <p className="text-lg font-medium">No time left today.</p>
          <button type="button" onClick={onShowTomorrow} className={BUTTON_CLASS}>
            Show tomorrow
          </button>
        </>
      )}
    </div>
  );
}
