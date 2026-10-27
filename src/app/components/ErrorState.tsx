import { BUTTON_CLASS, CARD_CLASS } from '../ui';

interface Props {
  onRetry(): void;
}

export function ErrorState({ onRetry }: Props) {
  return (
    <div role="alert" className={`${CARD_CLASS} flex flex-col items-start justify-center gap-4`}>
      <p className="text-lg font-medium">Couldn&apos;t load the forecast.</p>
      <button type="button" onClick={onRetry} className={BUTTON_CLASS}>
        Try again
      </button>
    </div>
  );
}
