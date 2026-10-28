import type { ReactNode } from 'react';
import type { WeatherIconName } from './weatherIcon';

const SUN = '#ffd60a';
const MOON = '#f2f2f7';
const CLOUD = '#ffffff';
const DROP = '#64d2ff';
const FLAKE = '#ffffff';

const CLOUD_PATH = 'M8 22a5 5 0 0 1-.4-10 7 7 0 0 1 13.4 1.8A4.1 4.1 0 0 1 20.5 22z';
const MOON_PATH = 'M20 19.5A9.5 9.5 0 0 1 10 5 8.4 8.4 0 1 0 20 19.5z';
const RAYS =
  'M14 2.5v3M14 22.5v3M2.5 14h3M22.5 14h3M5.9 5.9l2.1 2.1M20 20l2.1 2.1M5.9 22.1 8 20M20 8l2.1-2.1';
const BOLT = 'M15 14l-4 6h3l-1 5 5-7h-3.2z';

const stroke = { fill: 'none', strokeLinecap: 'round', strokeWidth: 2 } as const;

// Cloud pulled up to make room for precipitation underneath.
const RaisedCloud = () => (
  <path d={CLOUD_PATH} fill={CLOUD} transform="translate(0 -4)" />
);

function Precip({ children }: { children: ReactNode }) {
  return (
    <>
      <RaisedCloud />
      {children}
    </>
  );
}

function Flake({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r="1.5" fill={FLAKE} />;
}

function PartlyCloud({ celestial }: { celestial: ReactNode }) {
  return (
    <>
      <g transform="scale(.65)">
        {celestial}
      </g>
      <path d={CLOUD_PATH} fill={CLOUD} transform="translate(4 2)" />
    </>
  );
}

const SunDisc = () => (
  <>
    <circle cx="14" cy="14" r="5.5" fill={SUN} />
    <path d={RAYS} stroke={SUN} {...stroke} />
  </>
);

const MoonShape = () => <path d={MOON_PATH} fill={MOON} />;

function HorizonSun({ arrow }: { arrow: 'up' | 'down' }) {
  return (
    <>
      <path d="M8.5 20a5.5 5.5 0 0 1 11 0z" fill={SUN} />
      <path d="M3 20h22M7 14l1.6 1.6M21 14l-1.6 1.6" stroke={SUN} {...stroke} />
      <path
        d={arrow === 'up' ? 'M14 12V5M11 8l3-3 3 3' : 'M14 5v7M11 9l3 3 3-3'}
        stroke={CLOUD}
        {...stroke}
      />
    </>
  );
}

export function Glyph({ name }: { name: WeatherIconName }) {
  switch (name) {
    case 'sun':
      return <SunDisc />;
    case 'moon':
      return <MoonShape />;
    case 'partly-sun':
      return <PartlyCloud celestial={<SunDisc />} />;
    case 'partly-moon':
      return <PartlyCloud celestial={<MoonShape />} />;
    case 'cloud':
      return <path d={CLOUD_PATH} fill={CLOUD} />;
    case 'fog':
      return (
        <>
          <RaisedCloud />
          <path d="M6 20h16M9 24h13" stroke={CLOUD} {...stroke} opacity=".7" />
        </>
      );
    case 'drizzle':
      return (
        <Precip>
          <path d="M10 21.5v.01M14 24v.01M18 21.5v.01" stroke={DROP} {...stroke} strokeWidth={2.6} />
        </Precip>
      );
    case 'rain':
      return (
        <Precip>
          <path d="M10.5 20l-1 3M14.5 20l-1 3M18.5 20l-1 3" stroke={DROP} {...stroke} />
        </Precip>
      );
    case 'heavy-rain':
      return (
        <Precip>
          <path
            d="M9.5 19l-1.5 4M13 19l-1.5 4M16.5 19 15 23M20 19l-1.5 4M11 24.5l-.8 2M17 24.5l-.8 2"
            stroke={DROP}
            {...stroke}
          />
        </Precip>
      );
    case 'snow':
      return (
        <Precip>
          <Flake x={10} y={21} />
          <Flake x={14} y={24.5} />
          <Flake x={18} y={21} />
        </Precip>
      );
    case 'thunder':
      return (
        <>
          <RaisedCloud />
          <path d={BOLT} fill={SUN} transform="translate(0 .5)" />
        </>
      );
    case 'sunrise':
      return <HorizonSun arrow="up" />;
    case 'sunset':
      return <HorizonSun arrow="down" />;
  }
}
