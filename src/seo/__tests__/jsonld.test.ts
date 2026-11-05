import { describe, expect, it } from 'vitest';
import { faqItems } from '../../content/faq';
import { articleLd, breadcrumbLd, faqPageLd, serializeLd, webApplicationLd } from '../jsonld';

const SITE = 'https://uv-go.vercel.app';
const author = { name: 'Artem Bakulin', url: 'https://github.com/dekkyArt' };

describe('faqPageLd', () => {
  const ld = faqPageLd(faqItems) as {
    '@context': string;
    '@type': string;
    mainEntity: {
      '@type': string;
      name: string;
      acceptedAnswer: { '@type': string; text: string };
    }[];
  };

  it('has matching Question entries, each with an accepted answer text', () => {
    expect(ld['@type']).toBe('FAQPage');
    expect(ld.mainEntity).toHaveLength(faqItems.length);
    for (const [i, entity] of ld.mainEntity.entries()) {
      expect(entity['@type']).toBe('Question');
      expect(entity.name).toBe(faqItems[i].q);
      expect(entity.acceptedAnswer['@type']).toBe('Answer');
      expect(entity.acceptedAnswer.text).toBe(faqItems[i].a);
    }
  });
});

describe('webApplicationLd', () => {
  it('describes a free utilities web application', () => {
    const ld = webApplicationLd(SITE) as Record<string, unknown>;
    expect(ld['@type']).toBe('WebApplication');
    expect(ld.applicationCategory).toBe('UtilitiesApplication');
    expect(ld.url).toBe(`${SITE}/`);
    expect(ld.offers).toMatchObject({ '@type': 'Offer', price: '0', priceCurrency: 'USD' });
  });
});

describe('articleLd', () => {
  const ld = articleLd(
    {
      title: 'UV Index Explained',
      description: 'A description.',
      publishedAt: new Date('2026-10-27'),
      updatedAt: new Date('2026-11-02T10:00:00Z'),
    },
    `${SITE}/uv-index`,
    author,
    `${SITE}/og/uv-index.png`,
  ) as Record<string, unknown>;

  it('has ISO dates, author Person and mainEntityOfPage', () => {
    expect(ld['@type']).toBe('Article');
    expect(ld.headline).toBe('UV Index Explained');
    expect(ld.datePublished).toBe('2026-10-27T00:00:00.000Z');
    expect(ld.dateModified).toBe('2026-11-02T10:00:00.000Z');
    expect(ld.author).toEqual({ '@type': 'Person', name: author.name, url: author.url });
    expect(ld.image).toBe(`${SITE}/og/uv-index.png`);
    expect(ld.mainEntityOfPage).toMatchObject({ '@type': 'WebPage', '@id': `${SITE}/uv-index` });
  });
});

describe('breadcrumbLd', () => {
  it('numbers positions from 1', () => {
    const ld = breadcrumbLd([
      { name: 'Home', url: `${SITE}/` },
      { name: 'UV Index', url: `${SITE}/uv-index` },
    ]) as { '@type': string; itemListElement: { position: number; name: string; item: string }[] };
    expect(ld['@type']).toBe('BreadcrumbList');
    expect(ld.itemListElement.map((e) => e.position)).toEqual([1, 2]);
    expect(ld.itemListElement[1]).toMatchObject({
      '@type': 'ListItem',
      name: 'UV Index',
      item: `${SITE}/uv-index`,
    });
  });
});

describe('all objects', () => {
  it('carry the schema.org context', () => {
    const objects = [
      webApplicationLd(SITE),
      faqPageLd(faqItems),
      articleLd(
        { title: 't', description: 'd', publishedAt: new Date(), updatedAt: new Date() },
        SITE,
        author,
        `${SITE}/og/home.png`,
      ),
      breadcrumbLd([{ name: 'Home', url: SITE }]),
    ] as Record<string, unknown>[];
    for (const o of objects) expect(o['@context']).toBe('https://schema.org');
  });
});

describe('serializeLd', () => {
  it('escapes < so content cannot close the script element', () => {
    const out = serializeLd({ text: '</script><script>alert(1)</script>' });
    expect(out).not.toContain('<');
    expect(JSON.parse(out)).toEqual({ text: '</script><script>alert(1)</script>' });
  });
});
