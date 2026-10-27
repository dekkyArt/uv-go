export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'uvgo:theme';

// Keep in sync with the inline copy in src/components/ThemeScript.astro
// (an `is:inline` script cannot import this module).
export function resolveTheme(stored: string | null, systemDark: boolean): Theme {
  if (stored === 'light' || stored === 'dark') return stored;
  return systemDark ? 'dark' : 'light';
}
