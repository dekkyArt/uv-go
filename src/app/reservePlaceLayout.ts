/**
 * Marks <html data-has-place> before first paint when a place is stored, so the pre-hydration
 * placeholder can reserve the one-row location layout instead of the first-visit search layout.
 *
 * It is inlined into the page with `Function#toString`, so it must stay self-contained (no
 * imports or outer names). The checks mirror loadPlace() in src/data/storage.ts.
 */
export function reservePlaceLayout(
  win: {
    localStorage: { getItem(key: string): string | null };
    document: { documentElement: { dataset: Record<string, string | undefined> } };
  } = window,
): void {
  try {
    const place: unknown = JSON.parse(win.localStorage.getItem('uvgo:location') ?? 'null');
    if (typeof place !== 'object' || place === null || Array.isArray(place)) return;
    const { name, lat, lon, id } = place as Record<string, unknown>;
    const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
    if (typeof name !== 'string' || name === '' || !finite(lat) || !finite(lon)) return;
    if (id !== undefined && !finite(id)) return;
    win.document.documentElement.dataset.hasPlace = '';
  } catch {
    // Storage unavailable or not JSON: the first-visit layout stays.
  }
}
