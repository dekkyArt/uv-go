import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/global.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Body of the first rule whose selector list is exactly `selector`. */
function rule(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(source);
  expect(m, `a rule for ${selector}`).not.toBeNull();
  return m![1];
}

describe('global.css page scale under a sheet', () => {
  it('the base [data-page] rule carries the transition, so closing animates too', () => {
    const body = rule(css, '[data-page]');
    const transition = /transition:\s*([^;]+);/.exec(body)?.[1] ?? '';
    expect(transition).toContain('transform');
    expect(transition).toContain('clip-path');
    expect(transition).not.toContain('border-radius');
  });

  it('the open state scales the page without touching border-radius or transition', () => {
    const body = rule(css, 'html[data-sheet-open] [data-page]');
    expect(body).toContain('scale(0.94)');
    expect(body).toContain('clip-path: inset(0 round 16px)');
    expect(body).not.toContain('border-radius');
    expect(body).not.toContain('transition');
  });

  it('reduced motion drops transform, clip-path and the transition', () => {
    const block =
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\[data-page\],\s*html\[data-sheet-open\] \[data-page\]\s*\{([^}]*)\}/.exec(
        css,
      );
    expect(block, 'a reduced-motion block for [data-page]').not.toBeNull();
    expect(block![1]).toMatch(/transform:\s*none/);
    expect(block![1]).toMatch(/clip-path:\s*none/);
    expect(block![1]).toMatch(/transition:\s*none/);
  });
});
