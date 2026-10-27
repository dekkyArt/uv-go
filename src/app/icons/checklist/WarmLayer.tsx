import { Frame, Part } from './shared';
import type { IconProps } from './shared';

const FOLD = { from: { scaleY: 0.15 }, to: { scaleY: 1 } };

/** The folds of the sweater straighten out, one band after another. */
export function WarmLayer(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M11 4l-7 5 3 6 4-2v15h12V13l4 2 3-6-7-5c0 3-2 4-5 4s-5-1-5-4z" />
      {[0, 1, 2].map((i) => (
        <Part key={i} {...FOLD} after={i * 0.08}>
          <rect
            x="11"
            y={16 + i * 5}
            width="10"
            height="2.5"
            rx="1.25"
            fill="currentColor"
            stroke="none"
          />
        </Part>
      ))}
    </Frame>
  );
}
