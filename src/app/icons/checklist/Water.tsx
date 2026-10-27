import { Frame, Part } from './shared';
import type { IconProps } from './shared';

/** A drop falls into the bottle. */
export function Water(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M13 3h6v4l3 4v16a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V11l3-4z" />
      <Part
        from={{ y: -12, opacity: 0 }}
        to={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 16 }}
      >
        <path d="M16 15c2 2.6 3 4 3 5.5a3 3 0 0 1-6 0c0-1.5 1-2.9 3-5.5z" fill="currentColor" />
      </Part>
    </Frame>
  );
}
