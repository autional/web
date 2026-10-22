import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
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

// 案例：与 blog 同构的 editorial 字段（status/reviewed_by/claims_reviewed），
// 速览字段 platform/framework/stack/repo/demo 与详情页清单一一对应（多平台可扩）。
const cases = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/cases' }),
  schema: z.object({
    title: z.string(),
    date: z.string(),
    platform: z.string(),
    framework: z.string(),
    stack: z.string(),
    repo: z.string().url(),
    demo: z.string().url(),
    tags: z.array(z.string()).min(1),
    readTime: z.string(),
    excerpt: z.string().max(500),
    status: z.enum(['draft','verified','deprecated']),
    reviewed_by: z.string(),
    claims_reviewed: z.boolean(),
  }),
});

export const collections = { blog, cases };
