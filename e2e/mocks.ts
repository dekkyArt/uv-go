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

/** Search "Lis" and pick Lisbon; resolves when the result card shows a verdict. */
export async function searchLisbon(page: Page): Promise<void> {
  await page.getByRole('combobox').fill('Lis');
  await page.getByRole('option', { name: 'Lisbon, Portugal' }).click();
}
