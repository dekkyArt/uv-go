import type { DayForecast } from '../domain/types';

export interface Place {
  id: number;
  name: string;
  admin1?: string;
  country?: string;
  lat: number;
  lon: number;
}

export interface Forecast {
  days: [DayForecast, DayForecast];
  utcOffsetSeconds: number;
  timezone: string;
}

export class ForecastError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ForecastError';
  }
}
