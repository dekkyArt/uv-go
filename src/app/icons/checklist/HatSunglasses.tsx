import { Frame, Part } from './shared';
import type { IconProps } from './shared';

/** The hat lowers onto the head, the sunglasses slide down into place. */
export function HatSunglasses(props: IconProps) {
  return (
    <Frame {...props}>
      <Part from={{ y: -8, opacity: 0 }} to={{ y: 0, opacity: 1 }}>
        <path d="M8 13a8 8 0 0 1 16 0M3 13h26" />
      </Part>
      <Part from={{ y: -6, opacity: 0 }} to={{ y: 0, opacity: 1 }} after={0.12}>
        <circle cx="10" cy="23" r="4" />
        <circle cx="22" cy="23" r="4" />
        <path d="M14 22h4" />
      </Part>
    </Frame>
  );
}
