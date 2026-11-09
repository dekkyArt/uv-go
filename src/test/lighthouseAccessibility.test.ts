import { afterEach, expect, it, vi } from 'vitest';
import Accessibility from 'lighthouse/core/gather/gatherers/accessibility.js';
import ColorContrast from 'lighthouse/core/audits/accessibility/color-contrast.js';
import SiteAccessibility from '../../scripts/lighthouse-accessibility.mjs';

afterEach(() => vi.restoreAllMocks());

const node = (selector: string) => ({
  node: { selector },
  target: [selector],
  relatedNodes: [],
  failureSummary: 'Insufficient contrast',
});

async function gather(selectors: string[]) {
  document.body.innerHTML = `
    <div data-page>
      <main><p id="main-text" class="shared">Main</p>
        <article><footer id="article-footer">Article metadata</footer></article>
      </main>
      <footer><span id="footer-text" class="shared">Site footer</span></footer>
    </div>`;
  const artifact = {
    violations: [
      { id: 'color-contrast', nodes: selectors.map(node) },
      { id: 'target-size', nodes: [node('#footer-text')] },
    ],
    incomplete: [],
    notApplicable: [],
    passes: [],
    version: 'test',
  };
  vi.spyOn(Accessibility.prototype, 'getArtifact').mockResolvedValue(artifact as never);
  const context = {
    driver: {
      executionContext: {
        evaluate: async (fn: (selectors: string[]) => boolean[], options: { args: [string[]] }) =>
          fn(...options.args),
      },
    },
  };
  return { artifact, result: await new SiteAccessibility().getArtifact(context) };
}

it('exempts only site footer contrast, preserving other rules and ambiguous or unresolved nodes', async () => {
  const { artifact, result } = await gather([
    '#footer-text',
    '#main-text',
    '#article-footer',
    '.shared',
    '#missing',
  ]);
  expect(
    result.violations[0].nodes.map((entry: ReturnType<typeof node>) => entry.node.selector),
  ).toEqual(['#main-text', '#article-footer', '.shared', '#missing']);
  expect(result.violations[1]).toBe(artifact.violations[1]);
  expect(artifact.violations[0].nodes).toHaveLength(5);
  expect(ColorContrast.audit({ Accessibility: result } as never).score).toBe(0);
});

it('passes the original contrast audit when only site footer contrast fails', async () => {
  const { result } = await gather(['#footer-text']);
  expect(result.violations.map((rule: { id: string }) => rule.id)).toEqual(['target-size']);
  expect(ColorContrast.audit({ Accessibility: result } as never).score).toBe(1);
});

it('retains violations with invalid diagnostic selectors instead of aborting the audit', async () => {
  const { result } = await gather(['span.text-[13px]']);
  expect(result.violations[0].nodes).toEqual([node('span.text-[13px]')]);
  expect(ColorContrast.audit({ Accessibility: result } as never).score).toBe(0);
});
