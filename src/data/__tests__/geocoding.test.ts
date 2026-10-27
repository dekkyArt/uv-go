import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatPlace, GeocodingError, searchCities } from '../geocoding';

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

describe('searchCities', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns [] without a request for queries shorter than 2 characters', async () => {
    await expect(searchCities('L')).resolves.toEqual([]);
    await expect(searchCities('  a ')).resolves.toEqual([]);
    await expect(searchCities('')).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requests the spec URL and maps latitude/longitude to lat/lon', async () => {
    fetchMock.mockResolvedValue(
      okResponse({
        results: [
          {
            id: 2267057,
            name: 'Lisbon',
            admin1: 'Lisbon',
            country: 'Portugal',
            latitude: 38.71667,
            longitude: -9.13333,
            elevation: 10,
          },
          { id: 5, name: 'Lisbon Falls', latitude: 44, longitude: -70 },
        ],
      }),
    );
    const places = await searchCities('Lisbon');
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://geocoding-api.open-meteo.com/v1/search?name=Lisbon&count=5&language=en&format=json',
    );
    expect(places).toEqual([
      {
        id: 2267057,
        name: 'Lisbon',
        admin1: 'Lisbon',
        country: 'Portugal',
        lat: 38.71667,
        lon: -9.13333,
      },
      { id: 5, name: 'Lisbon Falls', lat: 44, lon: -70 },
    ]);
  });

  it('encodes the query and passes the abort signal', async () => {
    fetchMock.mockResolvedValue(okResponse({}));
    const controller = new AbortController();
    await searchCities(' São Paulo & co ', controller.signal);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent('São Paulo & co')}&count=5&language=en&format=json`,
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ signal: controller.signal });
  });

  it('returns [] when the response has no results', async () => {
    fetchMock.mockResolvedValue(okResponse({ generationtime_ms: 0.5 }));
    await expect(searchCities('Zzzzzz')).resolves.toEqual([]);
  });

  it('drops results without a name or numeric coordinates', async () => {
    fetchMock.mockResolvedValue(
      okResponse({
        results: [
          { id: 1, name: 'Ok', latitude: 1, longitude: 2 },
          { id: 2, latitude: 1, longitude: 2 },
          { id: 3, name: '', latitude: 1, longitude: 2 },
          { id: 4, name: 'NoLat', longitude: 2 },
          { id: 5, name: 'StrLon', latitude: 1, longitude: '2' },
          { id: 6, name: 'NaN', latitude: Number.NaN, longitude: 2 },
          null,
        ],
      }),
    );
    const places = await searchCities('Ok');
    expect(places.map((p) => p.id)).toEqual([1]);
  });

  it('rejects with GeocodingError on a non-2xx response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(searchCities('Lisbon')).rejects.toBeInstanceOf(GeocodingError);
  });

  it('rejects with GeocodingError on a network failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(searchCities('Lisbon')).rejects.toBeInstanceOf(GeocodingError);
  });

  it('rejects with GeocodingError on invalid JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('bad json');
      },
    } as unknown as Response);
    await expect(searchCities('Lisbon')).rejects.toBeInstanceOf(GeocodingError);
  });

  it('rethrows AbortError untouched', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    fetchMock.mockRejectedValue(abort);
    await expect(searchCities('Lisbon')).rejects.toBe(abort);
  });
});

describe('formatPlace', () => {
  const base = { id: 1, lat: 0, lon: 0 };

  it('drops admin1 when it equals the name', () => {
    expect(formatPlace({ ...base, name: 'Lisbon', admin1: 'Lisbon', country: 'Portugal' })).toBe(
      'Lisbon, Portugal',
    );
  });

  it('joins name, admin1 and country', () => {
    expect(
      formatPlace({ ...base, name: 'Austin', admin1: 'Texas', country: 'United States' }),
    ).toBe('Austin, Texas, United States');
  });

  it('skips missing and empty parts', () => {
    expect(formatPlace({ ...base, name: 'Porto', country: 'Portugal' })).toBe('Porto, Portugal');
    expect(formatPlace({ ...base, name: 'Porto', admin1: '', country: 'Portugal' })).toBe(
      'Porto, Portugal',
    );
    expect(formatPlace({ ...base, name: 'Your location' })).toBe('Your location');
  });
});
