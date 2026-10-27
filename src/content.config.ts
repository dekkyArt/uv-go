import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const articles = defineCollection({
  loader: glob({ base: './src/content/articles', pattern: '*.mdx' }),
  schema: z.object({
    title: z.string(),
    description: z.string().min(140).max(160),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    sources: z
      .array(
        z.object({
          title: z.string(),
          url: z.url(),
          publisher: z.string(),
        }),
      )
      .min(2),
    /** Slugs of the two other articles. */
    related: z.array(z.string()).length(2),
    tldr: z.array(z.string()).min(3).max(4),
  }),
});

export const collections = { articles };
