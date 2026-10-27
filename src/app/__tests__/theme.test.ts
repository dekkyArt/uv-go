import { describe, it, expect } from 'vitest';
import { resolveTheme } from '../theme';

describe('resolveTheme', () => {
  it.each([
    [null, false, 'light'],
    [null, true, 'dark'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['garbage', true, 'dark'],
  ])('resolveTheme(%s, %s) → %s', (stored, systemDark, out) => {
    expect(resolveTheme(stored, systemDark)).toBe(out);
  });
});
