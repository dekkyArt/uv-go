import { Glyph } from './glyphs';
import type { WeatherIconName } from './weatherIcon';

interface Props {
  name: WeatherIconName;
  className?: string;
}

/** Decorative coloured glyph: the surrounding text carries the meaning. */
export function WeatherIcon({ name, className = 'size-7' }: Props) {
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden="true" data-icon={name}>
      <Glyph name={name} />
    </svg>
  );
}
