import { useEffect, useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { SkyPhase, SkyState, WeatherGroup } from '../../domain/sky';
import { durations } from '../../motion/tokens';
import { useIsDesktop } from '../hooks/useIsDesktop';

interface Props {
  sky: SkyState;
  reducedMotion: boolean;
}

/** Stacking order of the phase layers; the CSS gradients live in global.css (.sky-phase-*). */
const PHASES: readonly SkyPhase[] = ['night', 'dawn', 'morning', 'day', 'golden', 'dusk'];

/** Particle caps (spec 9.3): rain, snow and wind lines together. */
const MAX_PARTICLES = { mobile: 40, desktop: 80 } as const;
const WIND_LINES = 6;

/** Phase crossfade: unhurried, but 150 ms with reduced motion (spec 10.10). */
const FADE_MS = Math.round(durations.slow * 2000);
const FADE_REDUCED_MS = Math.round(durations.fast * 1000);

/** Overcast and fog dim the phase with a veil; other weather leaves it clear. */
const VEIL_OPACITY: Record<WeatherGroup, number> = {
  clear: 0,
  partly: 0,
  overcast: 0.55,
  fog: 0.75,
  rain: 0.3,
  snow: 0.2,
  thunder: 0.5,
};

export const VEIL_MAX_OPACITY = Math.max(...Object.values(VEIL_OPACITY));

/** The sun travels an arc across the viewport: x from 10% to 90%, y from 80% (horizon) up to 20%. */
const SUN_X = { from: 0.1, span: 0.8 } as const;
const SUN_Y = { horizon: 0.8, rise: 0.6 } as const;
const VIEWPORT_CENTER = 0.5;

/** A golden-ratio sequence spreads particles evenly without Math.random (stable renders). */
const GOLDEN = 0.618033988749895;
const fraction = (i: number, salt: number) => (i * GOLDEN + salt) % 1;

interface Particle {
  x: number;
  delay: number;
  duration: number;
}

function makeParticles(count: number, duration: [min: number, max: number]): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    const d = duration[0] + fraction(i, 0.31) * (duration[1] - duration[0]);
    return { x: fraction(i, 0) * 100, delay: -fraction(i, 0.57) * d, duration: d };
  });
}

function particleStyle(p: Particle, extra: Record<string, string> = {}): CSSProperties {
  return {
    '--x': `${p.x.toFixed(1)}%`,
    '--delay': `${p.delay.toFixed(2)}s`,
    '--dur': `${p.duration.toFixed(2)}s`,
    ...extra,
  } as CSSProperties;
}

const RAIN_DURATION: [number, number] = [0.7, 1.2];
const SNOW_DURATION: [number, number] = [6, 11];
const WIND_DURATION: [number, number] = [3, 6];

function sunTransform(position: number): string {
  const x = (SUN_X.from + SUN_X.span * position - VIEWPORT_CENTER) * 100;
  const y = (SUN_Y.horizon - SUN_Y.rise * Math.sin(Math.PI * position) - VIEWPORT_CENTER) * 100;
  return `translate(${x.toFixed(1)}%, ${y.toFixed(1)}%)`;
}

/**
 * The live sky: a fixed, decorative backdrop (spec 9.3). The six phase layers are stacked and the
 * current one fades in over the previous (opacity only, gradients are never interpolated). Weather
 * adds a veil, falling particles, a thunder flash and heat shimmer; all motion is CSS transform or
 * opacity. The root is the page's z-index -1 layer; content sits on translucent surfaces.
 */
export default function SkyLayer({ sky, reducedMotion }: Props) {
  const desktop = useIsDesktop();
  const budget = desktop ? MAX_PARTICLES.desktop : MAX_PARTICLES.mobile;
  const animate = !reducedMotion;

  // The static sky of SkyScript steps aside once this layer is painted (same phase, no jump).
  useEffect(() => {
    document.documentElement.dataset.skyLive = '';
    return () => {
      delete document.documentElement.dataset.skyLive;
    };
  }, []);

  const wind = animate && sky.wind;
  const fallCount = budget - (wind ? WIND_LINES : 0);
  const falling =
    animate && (sky.weather === 'rain' || sky.weather === 'thunder')
      ? 'rain'
      : animate && sky.weather === 'snow'
        ? 'snow'
        : null;

  const drops = useMemo(
    () => (falling === 'rain' ? makeParticles(fallCount, RAIN_DURATION) : []),
    [falling, fallCount],
  );
  const flakes = useMemo(
    () => (falling === 'snow' ? makeParticles(fallCount, SNOW_DURATION) : []),
    [falling, fallCount],
  );
  const windLines = useMemo(() => (wind ? makeParticles(WIND_LINES, WIND_DURATION) : []), [wind]);

  const night = sky.phase === 'night';
  const rootStyle = {
    '--sky-fade': `${reducedMotion ? FADE_REDUCED_MS : FADE_MS}ms`,
  } as CSSProperties;

  return (
    <div aria-hidden="true" className="sky-layer" style={rootStyle}>
      {PHASES.map((phase) => (
        <div
          key={phase}
          className={`sky-phase sky-phase-${phase}`}
          data-active={phase === sky.phase ? '' : undefined}
        />
      ))}
      <div
        className="sky-glow"
        style={{ opacity: night ? 0 : sky.uvGlow, transform: sunTransform(sky.sunPosition) }}
      />
      <div className="sky-moon" style={{ opacity: night ? 1 : 0 }} />
      <div className="sky-veil" style={{ opacity: VEIL_OPACITY[sky.weather] }} />
      {animate && sky.heat && <div className="sky-heat" />}
      {drops.map((p, i) => (
        <span key={`d${i}`} data-particle="" className="sky-drop" style={particleStyle(p)} />
      ))}
      {flakes.map((p, i) => (
        <span key={`s${i}`} data-particle="" className="sky-flake" style={particleStyle(p)} />
      ))}
      {windLines.map((p, i) => (
        <span
          key={`w${i}`}
          data-particle=""
          className="sky-wind"
          style={particleStyle(p, { '--y': `${(8 + fraction(i, 0.2) * 70).toFixed(1)}%` })}
        />
      ))}
      {animate && sky.weather === 'thunder' && <div className="sky-flash" />}
    </div>
  );
}
