import { LazyMotion, MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';
import { markFeaturesFailed } from './featuresFailed';

// A failed chunk is marked for the app to render at rest; LazyMotion keeps waiting quietly.
const loadFeatures = () =>
  import('./features')
    .then((m) => m.default)
    .catch(() => {
      markFeaturesFailed();
      return new Promise<never>(() => {});
    });

/** Loads motion features lazily; `strict` makes any non-`m` component throw. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
