import { Frame, Part } from './shared';
import type { IconProps } from './shared';

/** The jacket unfolds from a narrow fold to its full width. */
export function RainJacket(props: IconProps) {
  return (
    <Frame {...props}>
      <Part from={{ scaleX: 0.35 }} to={{ scaleX: 1 }}>
        <path d="M12 4l-8 6 3 6 3-2v14h12V14l3 2 3-6-8-6c0 3-2 4-4 4s-4-1-4-4zM16 10v20" />
      </Part>
    </Frame>
  );
}
