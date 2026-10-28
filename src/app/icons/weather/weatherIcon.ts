import { weatherGroup } from '../../../domain/sky';

export type WeatherIconName =
  | 'sun'
  | 'moon'
  | 'partly-sun'
  | 'partly-moon'
  | 'cloud'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'heavy-rain'
  | 'snow'
  | 'thunder'
  | 'sunrise'
  | 'sunset';

// WMO codes refining the 'rain' group: freezing/light drizzle and showers vs downpours.
const DRIZZLE = new Set([51, 53, 55, 56, 57]);
const HEAVY_RAIN = new Set([65, 67, 82]);

// sunrise/sunset are standalone glyphs for the Hourly sun-event cells, never a forecast result.
export function weatherIcon(
  code: number | null,
  cloudCover: number | null,
  isDay: boolean,
): WeatherIconName {
  switch (weatherGroup(code, cloudCover)) {
    case 'clear':
      return isDay ? 'sun' : 'moon';
    case 'partly':
      return isDay ? 'partly-sun' : 'partly-moon';
    case 'overcast':
      return 'cloud';
    case 'fog':
      return 'fog';
    case 'rain':
      if (code !== null && DRIZZLE.has(code)) return 'drizzle';
      if (code !== null && HEAVY_RAIN.has(code)) return 'heavy-rain';
      return 'rain';
    case 'snow':
      return 'snow';
    case 'thunder':
      return 'thunder';
  }
}
