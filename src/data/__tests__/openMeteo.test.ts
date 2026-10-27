import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeForecastJson } from '../../test/forecastJson';
import dst from '../__fixtures__/dst.json';
import lisbon from '../__fixtures__/lisbon.json';
import newYork from '../__fixtures__/new-york.json';
import nulls from '../__fixtures__/nulls.json';
import { buildForecastUrl, clearForecastCache, getForecast, mapForecast } from '../openMeteo';
import { ForecastError } from '../types';

describe('buildForecastUrl', () => {
  it('builds the spec URL', () => {
    expect(buildForecastUrl(38.72, -9.14)).toBe(
      'https://api.open-meteo.com/v1/forecast?latitude=38.72&longitude=-9.14&hourly=uv_index,precipitation_probability,apparent_temperature,wind_speed_10m,is_day,weather_code,cloud_cover&daily=sunrise,sunset&timezone=auto&forecast_days=2',
    );
  });
});

describe('mapForecast', () => {
  it.each([
    ['lisbon', lisbon],
    ['new-york', newYork],
  ])('maps the %s fixture to two 24-hour days', (_name, json) => {
    const f = mapForecast(json);
    expect(f.days[0].hours).toHaveLength(24);
    expect(f.days[1].hours).toHaveLength(24);
    expect(f.days[0].date).toBe(json.daily.time[0]);
    expect(f.days[1].date).toBe(json.daily.time[1]);
    expect(f.utcOffsetSeconds).toBe(json.utc_offset_seconds);
    expect(f.timezone).toBe(json.timezone);
    for (const day of f.days) {
      day.hours.forEach((h, i) => {
        expect(h.hour).toBe(i);
        expect(typeof h.isDay).toBe('boolean');
        expect(h.time).toBe(`${day.date}T${String(i).padStart(2, '0')}:00`);
      });
      expect(typeof day.sunrise).toBe('string');
      expect(typeof day.sunset).toBe('string');
    }
  });

  it('maps metric values from the response', () => {
    const h = mapForecast(lisbon).days[0].hours[13];
    expect(h.uv).toBe(lisbon.hourly.uv_index[13]);
    expect(h.rainProb).toBe(lisbon.hourly.precipitation_probability[13]);
    expect(h.feelsLike).toBe(lisbon.hourly.apparent_temperature[13]);
    expect(h.windKmh).toBe(lisbon.hourly.wind_speed_10m[13]);
    expect(h.weatherCode).toBe(lisbon.hourly.weather_code[13]);
    expect(h.cloudCover).toBe(lisbon.hourly.cloud_cover[13]);
  });

  it('keeps null metrics as null and null is_day as false', () => {
    const hours = mapForecast(nulls).days[0].hours;
    expect(hours[13].uv).toBeNull();
    expect(hours[14].rainProb).toBeNull();
    expect(hours[15].isDay).toBe(false);
  });

  it('maps DST day by hour, filling gaps', () => {
    const f = mapForecast(dst);
    expect(f.days[0].hours).toHaveLength(24);
    expect(f.days[1].hours).toHaveLength(24);
    const gap = f.days[0].hours[3];
    expect(gap).toEqual({
      time: `${f.days[0].date}T03:00`,
      hour: 3,
      uv: null,
      rainProb: null,
      feelsLike: null,
      windKmh: null,
      isDay: false,
      weatherCode: null,
      cloudCover: null,
    });
    expect(f.days[0].hours[4].uv).toBe(4);
    expect(f.days[1].hours[2].uv).toBe(12); // duplicate 02:00 (uv 99) is ignored
    expect(f.days[1].hours[3].uv).toBe(13);
  });

  it('reads sunrise and sunset per day', () => {
    const f = mapForecast(makeForecastJson({ date: '2026-12-31' }));
    expect(f.days[1].date).toBe('2027-01-01');
    expect(f.days[0].sunrise).toBe('2026-12-31T06:30');
    expect(f.days[1].sunset).toBe('2027-01-01T19:30');
  });

  it('applies hourly overrides of makeForecastJson', () => {
    const uv = Array.from({ length: 48 }, (_, i) => i);
    const f = mapForecast(makeForecastJson({ hourly: { uv_index: uv }, offsetSeconds: 3600 }));
    expect(f.days[1].hours[5].uv).toBe(29);
    expect(f.utcOffsetSeconds).toBe(3600);
    expect(f.days[0].hours[12].isDay).toBe(true);
    expect(f.days[0].hours[3].isDay).toBe(false);
  });

  it('throws ForecastError when only one day is present', () => {
    const json = makeForecastJson() as { hourly: Record<string, unknown[]> };
    for (const key of Object.keys(json.hourly)) json.hourly[key] = json.hourly[key].slice(0, 24);
    expect(() => mapForecast(json)).toThrow(ForecastError);
  });

  it('throws ForecastError when daily data for a day is missing', () => {
    const json = makeForecastJson() as {
      daily: { time: string[]; sunrise: string[]; sunset: string[] };
    };
    json.daily = {
      time: [json.daily.time[0]],
      sunrise: [json.daily.sunrise[0]],
      sunset: [json.daily.sunset[0]],
    };
    expect(() => mapForecast(json)).toThrow(ForecastError);
  });

  it.each([
    ['empty object', {}],
    ['null', null],
    ['string', 'nope'],
    ['array', []],
    [
      'missing hourly arrays',
      { utc_offset_seconds: 0, timezone: 'x', hourly: { time: ['2026-10-27T00:00'] } },
    ],
  ])('throws ForecastError for %s', (_name, json) => {
    expect(() => mapForecast(json)).toThrow(ForecastError);
  });

  it('exposes ForecastError with its name', () => {
    const err = new ForecastError('boom');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ForecastError');
  });
});

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe('getForecast', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    clearForecastCache();
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => okResponse(lisbon));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests the built URL and returns the mapped forecast', async () => {
    const f = await getForecast(38.72, -9.14);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(buildForecastUrl(38.72, -9.14));
    expect(f.days[0].hours).toHaveLength(24);
  });

  it('caches by coordinates rounded to 2 decimals', async () => {
    await getForecast(38.721, -9.139);
    await getForecast(38.72, -9.14);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refetches for a different location', async () => {
    await getForecast(38.72, -9.14);
    await getForecast(40.71, -74.01);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('bypasses and refreshes the cache with force', async () => {
    await getForecast(38.72, -9.14);
    fetchMock.mockImplementation(async () => okResponse(newYork));
    const forced = await getForecast(38.72, -9.14, { force: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(forced.timezone).toBe('America/New_York');
    const cached = await getForecast(38.72, -9.14);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cached.timezone).toBe('America/New_York');
  });

  it('passes the abort signal to fetch', async () => {
    const controller = new AbortController();
    await getForecast(38.72, -9.14, { signal: controller.signal });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ signal: controller.signal });
  });

  it('rejects with ForecastError on HTTP 500 and does not cache it', async () => {
    fetchMock.mockImplementationOnce(async () => new Response('oops', { status: 500 }));
    await expect(getForecast(38.72, -9.14)).rejects.toBeInstanceOf(ForecastError);
    await expect(getForecast(38.72, -9.14)).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects with ForecastError on a network error', async () => {
    fetchMock.mockImplementationOnce(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(getForecast(38.72, -9.14)).rejects.toBeInstanceOf(ForecastError);
  });

  it('rejects with ForecastError on invalid JSON', async () => {
    fetchMock.mockImplementationOnce(async () => new Response('<html>', { status: 200 }));
    await expect(getForecast(38.72, -9.14)).rejects.toBeInstanceOf(ForecastError);
  });

  it('rejects with ForecastError when the response has too few hours', async () => {
    const json = makeForecastJson() as { hourly: Record<string, unknown[]> };
    for (const key of Object.keys(json.hourly)) json.hourly[key] = json.hourly[key].slice(0, 24);
    fetchMock.mockImplementationOnce(async () => okResponse(json));
    await expect(getForecast(38.72, -9.14)).rejects.toBeInstanceOf(ForecastError);
  });

  it('rethrows an AbortError untouched', async () => {
    const abort = new DOMException('Aborted', 'AbortError');
    fetchMock.mockImplementationOnce(async () => {
      throw abort;
    });
    await expect(getForecast(38.72, -9.14)).rejects.toBe(abort);
  });
});
