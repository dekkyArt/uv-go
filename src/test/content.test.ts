import { describe, expect, it } from 'vitest';
import { rules } from '../domain/rules.config';

const BANNED = /\b(safe|perfect)\b|AI-powered/i;

const articles = import.meta.glob('/src/content/articles/*.mdx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

// faq.ts arrives in Task 22; until then the glob is empty and the check is vacuous.
const faq = import.meta.glob('/src/content/faq.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Prose words of an article body: no frontmatter, no import lines, no JSX tags, no markdown marks. */
function bodyWords(source: string): number {
  const body = source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  return body
    .split(/\r?\n/)
    .filter((line) => !/^\s*(import|export)\s/.test(line))
    .join('\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\]\([^)]*\)/g, ' ')
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

describe('articles', () => {
  const entries = Object.entries(articles);

  it('ships the three articles', () => {
    expect(entries.map(([path]) => path.split('/').pop()).sort()).toEqual([
      'sun-protection.mdx',
      'uv-index.mdx',
      'uv-risks.mdx',
    ]);
  });

  it.each(entries)('%s has no banned words', (_path, source) => {
    expect(source).not.toMatch(BANNED);
  });

  it.each(entries)('%s body is 800 to 1500 words', (_path, source) => {
    const words = bodyWords(source);
    expect(words).toBeGreaterThanOrEqual(800);
    expect(words).toBeLessThanOrEqual(1500);
  });
});

describe('banned words elsewhere', () => {
  it('faq content has none', () => {
    for (const source of Object.values(faq)) expect(source).not.toMatch(BANNED);
  });

  it('reason templates have none', () => {
    expect(JSON.stringify(rules.reasonTemplates)).not.toMatch(BANNED);
  });
});
