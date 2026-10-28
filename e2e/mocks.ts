import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

const fixture = (name: string) =>
  readFileSync(new URL(`../src/data/__fixtures__/${name}.json`, import.meta.url), 'utf8');

const LISBON_FORECAST = fixture('lisbon');

const LISBON_GEOCODING = {
  results: [
    {
      id: 2267057,
      name: 'Lisbon',
      admin1: 'Lisbon',
      country: 'Portugal',
      latitude: 38.72,
      longitude: -9.14,
    },
  ],
};

/** 2026-10-27 10:00 in Lisbon (UTC+0), the day the fixture covers. */
export const FIXED_NOW = new Date('2026-10-27T10:00:00Z');

/** Mock "now" and both Open-Meteo APIs; nothing leaves the machine. */
export async function mockApis(page: Page): Promise<void> {
  await page.clock.setFixedTime(FIXED_NOW);
  await page.route('**/geocoding-api.open-meteo.com/**', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(LISBON_GEOCODING) }),
  );
  await page.route('**/api.open-meteo.com/**', (route) =>
    route.fulfill({ contentType: 'application/json', body: LISBON_FORECAST }),
  );
}

/**
 * Open the Cities sheet (the hero's "Find a city" on a first visit, else the toolbar's Cities),
 * search "Lis" and pick Lisbon.
 */
export async function searchLisbon(page: Page): Promise<void> {
  const cities = page.getByRole('button', { name: 'Cities' });
  // The toolbar comes with the app: once it is there, the hero shows its final buttons too.
  await cities.waitFor();
  const findCity = page.getByRole('button', { name: 'Find a city' });
  if (await findCity.isVisible()) await findCity.click();
  else await cities.click();
  await page.getByRole('combobox').fill('Lis');
  await page.getByRole('option', { name: 'Lisbon, Portugal' }).click();
}
