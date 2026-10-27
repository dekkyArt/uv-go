import { Frame, Part } from './shared';
import type { IconProps } from './shared';

/** The tube is squeezed and a dab of cream comes out. */
export function Sunscreen(props: IconProps) {
  return (
    <Frame {...props}>
      <Part
        from={{ scaleY: 1 }}
        to={{ scaleY: [1, 0.8, 1] }}
        at="50% 100%"
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      >
        <path d="M10 12h12l-1 15a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2zM13 12V8h6v4" />
        <path d="M13 18h6" />
      </Part>
      <Part from={{ opacity: 0, scale: 0 }} to={{ opacity: 1, scale: 1 }} after={0.15}>
        <circle cx="16" cy="4.5" r="1.5" fill="currentColor" />
      </Part>
    </Frame>
  );
}
