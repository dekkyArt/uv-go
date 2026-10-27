import type { WeatherGroup } from './sky';

export const skyConfig = {
  minutesPerHour: 60,
  // Offsets in minutes (spec 9.3).
  offsets: {
    dawn: 45, // night -> dawn at sunrise - dawn; dawn -> morning at sunrise + dawn
    solarNoonDayStart: 120, // day starts at solarNoon - this
    golden: 90, // golden starts at sunset - this
    duskStart: 15, // dusk starts at sunset - this
    duskEnd: 45, // night starts at sunset + this
  },
  // WMO weather_code ranges (inclusive). Codes outside every range use cloud cover.
  weatherGroups: [
    { group: 'clear', from: 0, to: 1 },
    { group: 'partly', from: 2, to: 2 },
    { group: 'overcast', from: 3, to: 3 },
    { group: 'fog', from: 45, to: 48 },
    { group: 'rain', from: 51, to: 67 },
    { group: 'snow', from: 71, to: 77 },
    { group: 'rain', from: 80, to: 82 },
    { group: 'snow', from: 85, to: 86 },
    { group: 'thunder', from: 95, to: 99 },
  ] satisfies { group: WeatherGroup; from: number; to: number }[],
  // cloud_cover (%) used when weather_code is null: < clear -> clear, < partly -> partly.
  cloudCover: { clearBelow: 25, partlyBelow: 70 },
  uvGlowMax: 11,
  // Sun position when sunrise/sunset are unusable (polar day/night): by isDay.
  fallbackSunPosition: { day: 0.5, night: 0 },
  // Static article pages know no location: assumed sun times, HH:MM.
  articleFallback: { sunrise: '06:30', sunset: '19:30' },
} as const;
