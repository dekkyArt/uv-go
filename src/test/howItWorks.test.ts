// @vitest-environment node
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// A mutable copy of the real config. The mock lets a test change a value and prove that the
// How it works tables are generated from `rules`, not hardcoded.
const mock = vi.hoisted(() => ({ rules: undefined as unknown }));

vi.mock('../domain/rules.config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../domain/rules.config')>();
  mock.rules = structuredClone(actual.rules);
  return { rules: mock.rules };
});

import Faq from '../components/Faq.astro';
import HowItWorks from '../components/HowItWorks.astro';
import { faqItems } from '../content/faq';

const rules = () =>
  mock.rules as {
    uv: { multiplier: Record<string, number>; bands: { min: number; points: number }[] };
    wind: { min: number };
    verdictLabels: Record<string, string>;
  };

async function render(component: Parameters<AstroContainer['renderToString']>[0]) {
  const container = await AstroContainer.create();
  return container.renderToString(component);
}

describe('HowItWorks', () => {
  let original: string;

  beforeEach(async () => {
    original = JSON.stringify(mock.rules);
    return () => {
      Object.assign(mock.rules as object, JSON.parse(original));
    };
  });

  it('renders the rule tables from the config', async () => {
    const html = await render(HowItWorks);
    for (const text of ['8+', '× 1.5', '60%+', '40 km/h', 'Not recommended']) {
      expect(html).toContain(text);
    }
  });

  it('has the three steps and the verdict and checklist explanation', async () => {
    const html = await render(HowItWorks);
    expect(html).toMatch(/Pick a place/);
    expect(html).toMatch(/Set your time/);
    expect(html).toMatch(/Get one answer/);
    expect(html).toContain('What to take');
    expect(html).toContain('Sunscreen');
    expect(html).toContain('Warm layer');
  });

  it('changes when the config changes', async () => {
    const before = await render(HowItWorks);
    rules().uv.multiplier['long-sun'] = 2.5;
    rules().wind.min = 55;
    rules().verdictLabels.red = 'Skip it';
    const after = await render(HowItWorks);
    expect(after).not.toBe(before);
    expect(after).toContain('× 2.5');
    expect(after).toContain('55 km/h');
    expect(after).toContain('Skip it');
    expect(after).not.toContain('× 1.5');
    expect(after).not.toContain('40 km/h');
  });
});

describe('Faq', () => {
  it('renders each FAQ as a details element', async () => {
    const html = await render(Faq);
    expect(html.match(/<details/g)).toHaveLength(faqItems.length);
    expect(faqItems).toHaveLength(11);
    const escape = (text: string) => text.replaceAll('"', '&quot;');
    for (const item of faqItems) expect(html).toContain(escape(item.q));
  });
});
