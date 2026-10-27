import { describe, expect, it } from 'vitest';
import { siteConfig } from '../site.config';

describe('siteConfig', () => {
  it('has the product name', () => {
    expect(siteConfig.name).toBe('UV GO');
  });
});
