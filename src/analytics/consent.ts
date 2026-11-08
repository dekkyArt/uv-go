/** Bump the version/key when the purposes or provider change, requiring a fresh choice. */
export const CONSENT_KEY = 'uvgo:analytics-consent:v1';
export const CONSENT_MAX_AGE = 180 * 24 * 60 * 60 * 1000;

type Choice = 'granted' | 'denied';
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function measurementId(value: string | undefined): string | null {
  const id = value?.trim();
  return id && /^G-[A-Z0-9]+$/.test(id) ? id : null;
}

function readChoice(id: string): Choice | null {
  try {
    const record = JSON.parse(localStorage.getItem(CONSENT_KEY) ?? 'null');
    const age = Date.now() - record?.time;
    return record?.version === 1 &&
      record.id === id &&
      Number.isFinite(record.time) &&
      age >= 0 &&
      age < CONSENT_MAX_AGE &&
      (record.choice === 'granted' || record.choice === 'denied')
      ? record.choice
      : null;
  } catch {
    return null;
  }
}

function clearAnalyticsCookies() {
  // GA uses path=/ and may set cookies on a parent domain. Delete both host-only and
  // domain variants; leave forecast preferences and the consent record untouched.
  const domains = location.hostname.split('.');
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.trim().split('=')[0];
    if (name !== '_ga' && !name.startsWith('_ga_')) continue;
    const expired = `${name}=; Max-Age=0; path=/`;
    document.cookie = expired;
    for (let i = 0; i < domains.length - 1; i++) {
      document.cookie = `${expired}; domain=${domains.slice(i).join('.')}`;
    }
  }
}

export function initConsent(root: HTMLElement, reload = () => location.reload()): () => void {
  const id = measurementId(root.dataset.measurementId);
  if (!id) return () => {};
  const settings = document.querySelector<HTMLButtonElement>('[data-analytics-settings]');
  let loaded = false;
  let previousFocus: HTMLElement | null = null;
  const disable = (value: boolean) => {
    (window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = value;
  };
  const start = () => {
    if (loaded) return;
    loaded = true;
    disable(false);
    window.dataLayer = window.dataLayer || [];
    // gtag.js expects arguments objects in the data layer, rather than plain arrays.
    window.gtag = function () {
      // eslint-disable-next-line prefer-rest-params -- Match the official gtag queue contract.
      window.dataLayer!.push(arguments);
    };
    const gtag = window.gtag;
    gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    gtag('consent', 'update', { analytics_storage: 'granted' });
    gtag('js', new Date());
    gtag('config', id, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      // Never include city/search query parameters, fragments or cross-site referrers.
      page_location: location.origin + location.pathname,
      page_referrer: '',
      cookie_expires: CONSENT_MAX_AGE / 1000,
      cookie_update: false,
    });
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
    document.head.append(script);
  };
  const stop = () => {
    disable(true);
    clearAnalyticsCookies();
    // A loaded third-party script cannot be unloaded by removing its element. A fresh
    // document also stops enhanced-measurement listeners and any pending tag startup.
    if (loaded && readChoice(id) !== 'granted') reload();
  };
  const open = () => {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    root.hidden = false;
    root.querySelector<HTMLButtonElement>('[data-consent]')?.focus();
  };
  const choose = (event: Event) => {
    const choice = (event.target as HTMLElement).closest<HTMLElement>('[data-consent]')?.dataset
      .consent;
    if (choice !== 'granted' && choice !== 'denied') return;
    try {
      localStorage.setItem(
        CONSENT_KEY,
        JSON.stringify({ version: 1, id, choice, time: Date.now() }),
      );
    } catch {
      // A failed rejection must not leave an old grant that would restart GA on reload.
      if (choice === 'denied') {
        try {
          localStorage.removeItem(CONSENT_KEY);
        } catch {
          /* Storage is read-only. */
        }
      }
    }
    root.hidden = true;
    previousFocus?.focus();
    if (choice === 'granted') start();
    else stop();
  };
  const sync = () => {
    const choice = readChoice(id);
    root.hidden = choice !== null;
    if (choice === 'granted') start();
    else stop();
  };
  const storage = (event: StorageEvent) => {
    if (event.key === CONSENT_KEY || event.key === null) sync();
  };
  const revisit = () => {
    if (document.visibilityState === 'visible') sync();
  };
  root.addEventListener('click', choose);
  settings?.addEventListener('click', open);
  window.addEventListener('storage', storage);
  window.addEventListener('pageshow', sync);
  document.addEventListener('visibilitychange', revisit);
  sync();
  return () => {
    root.removeEventListener('click', choose);
    settings?.removeEventListener('click', open);
    window.removeEventListener('storage', storage);
    window.removeEventListener('pageshow', sync);
    document.removeEventListener('visibilitychange', revisit);
  };
}
