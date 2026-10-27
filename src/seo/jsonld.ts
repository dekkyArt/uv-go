/** schema.org JSON-LD builders (spec 11.5). Pure functions; `serializeLd` makes them safe to inline. */
import type { FaqItem } from '../content/faq';

const CONTEXT = 'https://schema.org';

export interface ArticleLdInput {
  title: string;
  description: string;
  publishedAt: Date;
  updatedAt: Date;
}

export interface LdAuthor {
  name: string;
  url: string;
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function webApplicationLd(site: string): object {
  return {
    '@context': CONTEXT,
    '@type': 'WebApplication',
    name: 'UV GO',
    url: `${site}/`,
    description:
      'Find the best time to go outside today from the hourly UV index and weather forecast for your location.',
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript',
    inLanguage: 'en',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
}

export function faqPageLd(items: FaqItem[]): object {
  return {
    '@context': CONTEXT,
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

export function articleLd(
  a: ArticleLdInput,
  url: string,
  author: LdAuthor,
  image?: string,
): object {
  return {
    '@context': CONTEXT,
    '@type': 'Article',
    headline: a.title,
    description: a.description,
    datePublished: a.publishedAt.toISOString(),
    dateModified: a.updatedAt.toISOString(),
    author: { '@type': 'Person', name: author.name, url: author.url },
    ...(image ? { image } : {}),
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  };
}

export function breadcrumbLd(items: BreadcrumbItem[]): object {
  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** JSON for an inline ld+json script: `<` is escaped so content cannot close the element. */
export function serializeLd(data: object): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
