/**
 * The boot splash on the home page (src/components/BootSplash.astro). With a stored place the
 * page waits for the forecast, and on the way it passes through the pre-hydration placeholder, the
 * loading hero and the first result, each with its own layout. Instead of showing those steps the
 * page stays hidden over the sky and the splash (the sun crossing its arc) holds the screen until
 * the app has its first settled state; then the splash leaves and the page comes in.
 *
 * `<html data-boot>`: "on" while the page is hidden, "out" while the splash leaves and the page
 * comes in (BOOT_OUT_MS), then removed. A first visit has nothing to load and gets no splash.
 */

/** How long the hand-over runs: the splash out and the last staggered element in (global.css). */
export const BOOT_OUT_MS = 700;

/** The page is shown by then whatever the app is doing (a hung request, a failed island). */
export const BOOT_MAX_MS = 8000;

/**
 * Runs before first paint, after reserveLayout(): `<html data-boot="on">` when a place is stored,
 * with the place's name written into the splash, and a timer that shows the page after `maxMs`
 * even if the app never says it is ready.
 *
 * It is inlined into the page with `Function#toString`, so it must stay self-contained (no
 * imports or outer names); the delays come in as arguments.
 */
export function startBoot(
  maxMs: number,
  outMs: number,
  win: {
    localStorage: { getItem(key: string): string | null };
    document: {
      documentElement: { dataset: Record<string, string | undefined> };
      querySelector(selector: string): { textContent: string | null } | null;
    };
    setTimeout(fn: () => void, ms: number): unknown;
  } = window,
): void {
  const root = win.document.documentElement;
  // reserveLayout() has validated the stored place.
  if (root.dataset.hasPlace === undefined) return;
  root.dataset.boot = 'on';

  try {
    const place = JSON.parse(win.localStorage.getItem('uvgo:location') ?? 'null') as {
      name?: unknown;
    } | null;
    const label = win.document.querySelector('[data-boot-place]');
    if (label && typeof place?.name === 'string') label.textContent = place.name;
  } catch {
    // The splash shows the sun alone.
  }

  win.setTimeout(() => {
    if (root.dataset.boot !== 'on') return;
    root.dataset.boot = 'out';
    win.setTimeout(() => {
      if (root.dataset.boot === 'out') delete root.dataset.boot;
    }, outMs);
  }, maxMs);
}

/**
 * The app has its first settled state on the page: hand over from the splash. Waits two frames so
 * that state (its layout, the intro's starting values) is painted, still hidden, before the page
 * is shown. Does nothing when there is no splash, or it is already leaving.
 */
export function endBoot(doc: Document = document): void {
  const root = doc.documentElement;
  if (root.dataset.boot !== 'on') return;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (root.dataset.boot !== 'on') return;
      root.dataset.boot = 'out';
      setTimeout(() => {
        if (root.dataset.boot === 'out') delete root.dataset.boot;
      }, BOOT_OUT_MS);
    }),
  );
}
