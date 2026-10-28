/**
 * Runs before first paint and tells the pre-hydration placeholder what the app will show:
 * `<html data-has-place>` when a place is stored (the card skeletons are reserved only then), and
 * `--free-rows`, the number of rows of the Your free time table (6 when nothing valid is stored).
 *
 * It is inlined into the page with `Function#toString`, so it must stay self-contained (no
 * imports or outer names). The checks mirror loadPlace() and loadInputs() in src/data/storage.ts.
 */
export function reserveLayout(
  win: {
    localStorage: { getItem(key: string): string | null };
    document: {
      documentElement: {
        dataset: Record<string, string | undefined>;
        style: { setProperty(name: string, value: string): void };
      };
    };
  } = window,
): void {
  const root = win.document.documentElement;
  const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);
  const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

  let rows = 6;
  try {
    const inputs: unknown = JSON.parse(win.localStorage.getItem('uvgo:inputs') ?? 'null');
    const freeTime = isRecord(inputs) ? inputs.freeTime : null;
    if (isRecord(freeTime)) {
      const { start, end } = freeTime;
      if (
        Number.isInteger(start) &&
        Number.isInteger(end) &&
        (start as number) >= 0 &&
        (start as number) <= 23 &&
        (end as number) >= 1 &&
        (end as number) <= 24 &&
        (end as number) > (start as number)
      ) {
        rows = (end as number) - (start as number);
      }
    }
  } catch {
    // Storage unavailable or not JSON: the default free time.
  }
  root.style.setProperty('--free-rows', String(rows));

  try {
    const place: unknown = JSON.parse(win.localStorage.getItem('uvgo:location') ?? 'null');
    if (!isRecord(place)) return;
    const { name, lat, lon, id } = place;
    if (typeof name !== 'string' || name === '' || !finite(lat) || !finite(lon)) return;
    if (id !== undefined && !finite(id)) return;
    root.dataset.hasPlace = '';
  } catch {
    // Storage unavailable or not JSON: the first-visit layout stays.
  }
}
