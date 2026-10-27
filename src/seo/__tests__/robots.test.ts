import { describe, expect, it } from 'vitest';
import { robotsTxt } from '../robots';

describe('robotsTxt', () => {
  it('allows everything and points at the sitemap index under the given site', () => {
    expect(robotsTxt('https://uv-go.vercel.app')).toBe(
      'User-agent: *\nAllow: /\n\nSitemap: https://uv-go.vercel.app/sitemap-index.xml\n',
    );
  });

  it('follows the site value, with or without a trailing slash', () => {
    expect(robotsTxt('https://example.com')).toContain(
      'Sitemap: https://example.com/sitemap-index.xml',
    );
    expect(robotsTxt('https://example.com/')).toContain(
      'Sitemap: https://example.com/sitemap-index.xml',
    );
  });
});
