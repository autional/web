import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// 博客 frontmatter 日期（T-01）：sitemap lastmod 用真实发布日期，而非构建时间
const blogDir = fileURLToPath(new URL('./src/content/blog/', import.meta.url));
const blogDates = {};
for (const file of readdirSync(blogDir)) {
  if (!file.endsWith('.md')) continue;
  const src = readFileSync(join(blogDir, file), 'utf8');
  const m = src.match(/^date:\s*"?(\d{4}-\d{2}-\d{2})"?/m);
  if (m) blogDates[file.replace(/\.md$/, '')] = m[1];
}

export default defineConfig({
  integrations: [
    tailwind(),
    react(),
    sitemap({
      serialize(item) {
        const url = item.url;
        // 博客文章：lastmod = 文章 frontmatter 发布日期（真实日期）
        const post = url.match(/^https:\/\/www\.autional\.cn\/blog\/([^/]+)\/?$/);
        if (post && blogDates[post[1]]) {
          return { ...item, changefreq: 'weekly', priority: 0.7, lastmod: blogDates[post[1]] };
        }
        // 博客索引：lastmod = 最新一篇文章的日期
        if (url === 'https://www.autional.cn/blog/') {
          const latest = Object.values(blogDates).sort().at(-1);
          return { ...item, changefreq: 'weekly', priority: 0.8, ...(latest ? { lastmod: latest } : {}) };
        }
        // 其余页面不写 lastmod（静态内容，构建时间无意义）
        if (url === 'https://www.autional.cn/') {
          return { ...item, changefreq: 'daily', priority: 1.0 };
        }
        if (url === 'https://www.autional.cn/changelog/') {
          return { ...item, changefreq: 'weekly', priority: 0.8 };
        }
        if (url === 'https://www.autional.cn/pricing/' || url === 'https://www.autional.cn/features/') {
          return { ...item, changefreq: 'monthly', priority: 0.9 };
        }
        return { ...item, changefreq: 'monthly', priority: 0.5 };
      },
    }),
  ],
  output: 'static',
  site: 'https://www.autional.cn',
  base: '/',
  markdown: { shikiConfig: { theme: 'github-dark' } },
});
