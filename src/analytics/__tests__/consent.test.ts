import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { initConsent, measurementId, CONSENT_KEY, CONSENT_MAX_AGE } from '../consent';

const ID = 'G-TEST123';
let dispose: (() => void) | undefined;
const reload = vi.fn();
function mount(id = ID) {
  document.body.innerHTML = `<button data-analytics-settings>Cookie settings</button>
    <section data-analytics-consent data-measurement-id="${id}" hidden>
    <button data-consent="granted">Accept analytics</button>
    <button data-consent="denied">Reject analytics</button></section>`;
  dispose = initConsent(document.querySelector<HTMLElement>('[data-analytics-consent]')!, reload);
}
const banner = () => document.querySelector<HTMLElement>('[data-analytics-consent]')!;
const tag = () => document.querySelector('script[src*="googletagmanager.com"]');
const click = (choice: string) =>
  document.querySelector<HTMLButtonElement>(`[data-consent="${choice}"]`)!.click();
function saved(choice: string, time = Date.now()) {
  localStorage.setItem(CONSENT_KEY, JSON.stringify({ version: 1, id: ID, choice, time }));
}

beforeEach(() => {
  localStorage.clear();
  reload.mockClear();
  delete window.dataLayer;
  delete window.gtag;
});
afterEach(() => {
  dispose?.();
  document.head.querySelectorAll('script').forEach((s) => s.remove());
  vi.restoreAllMocks();
});

describe('optional GA4 configuration', () => {
  it.each([undefined, '', '   ', 'UA-123', 'G-<script>'])(
    'disables invalid or empty ID %s',
    (id) => {
      expect(measurementId(id)).toBeNull();
    },
  );
  it('trims the measurement ID', () => expect(measurementId(' G-TEST123 ')).toBe(ID));
  it('does nothing without configuration', () => {
    mount('');
    expect(banner()).not.toBeVisible();
    expect(tag()).toBeNull();
    expect(localStorage.length).toBe(0);
  });
});

describe('consent before any Google connection', () => {
  it('shows the choice without creating a tag or data layer', () => {
    mount();
    expect(banner()).toBeVisible();
    expect(tag()).toBeNull();
    expect(window.dataLayer).toBeUndefined();
  });
  it('remembers rejection without loading Google, including on the next page', () => {
    mount();
    click('denied');
    expect(banner()).not.toBeVisible();
    expect(tag()).toBeNull();
    dispose?.();
    mount();
    expect(banner()).not.toBeVisible();
    expect(tag()).toBeNull();
  });
  it('loads once after explicit consent with advertising disabled and sanitized page URLs', () => {
    history.replaceState({}, '', '/?city=private#private');
    mount();
    click('granted');
    expect(tag()?.getAttribute('src')).toBe(`https://www.googletagmanager.com/gtag/js?id=${ID}`);
    const commands = window.dataLayer!.map((args) => Array.from(args as ArrayLike<unknown>));
    expect(commands[0]).toEqual([
      'consent',
      'default',
      expect.objectContaining({
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      }),
    ]);
    expect(commands).toContainEqual(['consent', 'update', { analytics_storage: 'granted' }]);
    expect(commands).toContainEqual([
      'config',
      ID,
      expect.objectContaining({
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        page_location: `${location.origin}/`,
        cookie_expires: CONSENT_MAX_AGE / 1000,
        cookie_update: false,
      }),
    ]);
    document.querySelector<HTMLButtonElement>('[data-analytics-settings]')!.click();
    click('granted');
    expect(document.querySelectorAll('script[src*="googletagmanager.com"]')).toHaveLength(1);
    history.replaceState({}, '', '/');
  });
  it('restores a valid acceptance', () => {
    saved('granted');
    mount();
    expect(tag()).not.toBeNull();
    expect(banner()).not.toBeVisible();
  });
  it.each([
    'broken',
    JSON.stringify({
      version: 1,
      id: ID,
      choice: 'granted',
      time: Date.now() - CONSENT_MAX_AGE - 1,
    }),
    JSON.stringify({ version: 0, id: ID, choice: 'granted', time: Date.now() }),
    JSON.stringify({ version: 1, id: 'G-OTHER', choice: 'granted', time: Date.now() }),
    JSON.stringify({ version: 1, id: ID, choice: 'granted', time: Date.now() + 86400000 }),
  ])('asks again for invalid or expired choice', (record) => {
    localStorage.setItem(CONSENT_KEY, record);
    mount();
    expect(banner()).toBeVisible();
    expect(tag()).toBeNull();
  });
  it('keeps the site usable when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    mount();
    click('denied');
    expect(banner()).not.toBeVisible();
    expect(tag()).toBeNull();
  });
  it('withdraws consent, deletes GA cookies without touching app storage and reloads to unload Google', () => {
    mount();
    click('granted');
    document.cookie = '_ga=123; path=/';
    document.cookie = '_ga_TEST123=456; path=/';
    localStorage.setItem('uvgo:place', 'Lisbon');
    document.querySelector<HTMLButtonElement>('[data-analytics-settings]')!.click();
    expect(banner()).toBeVisible();
    click('denied');
    expect((window as unknown as Record<string, unknown>)[`ga-disable-${ID}`]).toBe(true);
    expect(document.cookie).not.toContain('_ga');
    expect(localStorage.getItem('uvgo:place')).toBe('Lisbon');
    expect(JSON.parse(localStorage.getItem(CONSENT_KEY)!).choice).toBe('denied');
    expect(reload).toHaveBeenCalledOnce();
  });
  it('stops an active tag if consent is withdrawn in another tab', () => {
    saved('granted');
    mount();
    saved('denied');
    window.dispatchEvent(new StorageEvent('storage', { key: CONSENT_KEY }));
    expect(reload).toHaveBeenCalledOnce();
  });
});

it('does not restore stale acceptance when persisting withdrawal fails', () => {
  saved('granted');
  mount();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('write failed');
  });
  click('denied');
  dispose?.();
  document.head.querySelectorAll('script').forEach((s) => s.remove());
  mount();
  expect(tag()).toBeNull();
});
