import type { APIRoute } from 'astro';
import { siteConfig } from '../site.config';
import { robotsTxt } from '../seo/robots';

export const GET: APIRoute = () =>
  new Response(robotsTxt(siteConfig.site), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
