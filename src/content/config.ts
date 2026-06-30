import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.string(),
    category: z.enum(['Tech','Architecture','Compliance','Product','Security','Project']),
    tags: z.array(z.string()).min(1),
    readTime: z.string(),
    excerpt: z.string().max(500),
    status: z.enum(['draft','verified','deprecated']),
    reviewed_by: z.string(),
    claims_reviewed: z.boolean(),
  }),
});

export const collections = { blog };
