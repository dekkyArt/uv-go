import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WeatherIcon } from '../icons/weather/Icon';
import { type WeatherIconName, weatherIcon } from '../icons/weather/weatherIcon';

const ALL_ICONS: WeatherIconName[] = [
  'sun',
  'moon',
  'partly-sun',
  'partly-moon',
  'cloud',
  'fog',
  'drizzle',
  'rain',
  'heavy-rain',
  'snow',
  'thunder',
  'sunrise',
  'sunset',
];

describe('weatherIcon', () => {
  it.each([
    [0, true, 'sun'],
    [0, false, 'moon'],
    [2, true, 'partly-sun'],
    [2, false, 'partly-moon'],
    [3, true, 'cloud'],
    [3, false, 'cloud'],
    [45, true, 'fog'],
    [51, true, 'drizzle'],
    [53, true, 'drizzle'],
    [55, true, 'drizzle'],
    [56, true, 'drizzle'],
    [57, true, 'drizzle'],
    [61, true, 'rain'],
    [63, true, 'rain'],
    [80, true, 'rain'],
    [81, true, 'rain'],
    [65, true, 'heavy-rain'],
    [67, true, 'heavy-rain'],
    [82, true, 'heavy-rain'],
    [71, true, 'snow'],
    [85, false, 'snow'],
    [95, true, 'thunder'],
    [95, false, 'thunder'],
  ] as const)('maps WMO code %s (isDay %s) to %s', (code, isDay, expected) => {
    expect(weatherIcon(code, null, isDay)).toBe(expected);
  });

  it('falls back to cloud cover when the code is missing', () => {
    expect(weatherIcon(null, 10, true)).toBe('sun');
    expect(weatherIcon(null, 10, false)).toBe('moon');
    expect(weatherIcon(null, 50, true)).toBe('partly-sun');
    expect(weatherIcon(null, 90, true)).toBe('cloud');
    expect(weatherIcon(null, null, true)).toBe('sun');
  });
});

describe('WeatherIcon', () => {
  it.each(ALL_ICONS)('renders %s as a decorative svg', (name) => {
    const { container } = render(<WeatherIcon name={name} />);
    const svg = container.querySelector(`svg[data-icon="${name}"]`);
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('class')).toContain('size-7');
  });

  it('accepts a custom class name instead of the default size', () => {
    const { container } = render(<WeatherIcon name="sun" className="size-5" />);
    const cls = container.querySelector('svg')?.getAttribute('class');
    expect(cls).toContain('size-5');
    expect(cls).not.toContain('size-7');
  });
});
