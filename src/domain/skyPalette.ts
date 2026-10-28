import type { SkyPhase } from './sky';

/** Top and bottom of each phase's sky, iOS-Weather tones. The CSS backdrop and the glass derive from it. */
export const SKY_PALETTE: Record<SkyPhase, { top: string; bottom: string }> = {
  night: { top: '#0b1530', bottom: '#1d2c55' },
  dawn: { top: '#4a5a9c', bottom: '#cc7a8c' },
  morning: { top: '#3f78c8', bottom: '#c8825a' },
  day: { top: '#2f6fd0', bottom: '#5b97dc' },
  golden: { top: '#3b72c4', bottom: '#c9803a' },
  dusk: { top: '#2f3a7c', bottom: '#c4577f' },
};

/** No sky colour may be brighter than this relative luminance: the glass contrast is proven against it. */
export const MAX_SKY_LUMA = 0.3;

/** White at this alpha is the secondary text colour. */
export const TEXT_SECONDARY_ALPHA = 0.72;

export const GLASS = {
  /** Lowest glass opacity. */
  baseAlpha: 0.38,
  /** The sky's mean colour is multiplied by this to get the glass tint. */
  darken: 0.35,
};
