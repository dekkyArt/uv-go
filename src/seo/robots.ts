/** Body of robots.txt. The sitemap URL is derived from the single `site` value (spec 11.5). */
export function robotsTxt(site: string): string {
  const sitemap = new URL('sitemap-index.xml', site).href;
  return `User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`;
}
