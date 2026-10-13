import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBuildEnv } from './scripts/env.mjs';

// ── 构建期区域环境（B1 单源双区；落点表 docs/positioning/22 §2）────────────────
// 两区同源构建，区域差异全部经 env 注入（Vercel 项目侧值见 doc 22 §4.1；读取单点 = scripts/env.mjs）。
// 此处经 vite.define 内联成 import.meta.env.PUBLIC_*，供 src/lib/site-env.ts 与客户端 island 使用。
const { region: ENV_REGION, siteUrl: ENV_SITE_URL, defaultLang: ENV_DEFAULT_LANG, fallbackLang: ENV_FALLBACK_LANG, cdnHost: ENV_CDN_HOST } =
  readBuildEnv();

// 博客 frontmatter 日期（T-01）：sitemap lastmod 用真实发布日期，而非构建时间。
// B1 §1.3：内容按语言分目录（blog/{en,zh}/），本区只读 DEFAULT_LANG 目录——
// 同名对（49 对）日期可能不同，必须按本区语言取，否则 lastmod 串区。
const blogLangDir = ENV_DEFAULT_LANG === 'en' ? 'en' : 'zh';
const blogDir = fileURLToPath(new URL(`./src/content/blog/${blogLangDir}/`, import.meta.url));
const blogDates = {};
for (const file of readdirSync(blogDir)) {
  if (!file.endsWith('.md')) continue;
  const src = readFileSync(join(blogDir, file), 'utf8');
  const m = src.match(/^date:\s*"?(\d{4}-\d{2}-\d{2})"?/m);
  if (m) blogDates[file.replace(/\.md$/, '')] = m[1];
}

// sitemap serialize 判定点全部由 SITE 派生（原 cn 版 5 处 / com 版 6 处字面量的参数化）。
const SITE = ENV_SITE_URL;
const SITE_RE = SITE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default defineConfig({
  integrations: [
    tailwind(),
    react(),
    sitemap({
      serialize(item) {
        const url = item.url;
        // 博客文章：lastmod = 文章 frontmatter 发布日期（真实日期）
        const post = url.match(new RegExp(`^${SITE_RE}/blog/([^/]+)/?$`));
        if (post && blogDates[post[1]]) {
          return { ...item, changefreq: 'weekly', priority: 0.7, lastmod: blogDates[post[1]] };
        }
        // 博客索引：lastmod = 最新一篇文章的日期
        if (url === `${SITE}/blog/`) {
          const latest = Object.values(blogDates).sort().at(-1);
          return { ...item, changefreq: 'weekly', priority: 0.8, ...(latest ? { lastmod: latest } : {}) };
        }
        // 其余页面不写 lastmod（静态内容，构建时间无意义）
        if (url === `${SITE}/`) {
          return { ...item, changefreq: 'daily', priority: 1.0 };
        }
        if (url === `${SITE}/changelog/`) {
          return { ...item, changefreq: 'weekly', priority: 0.8 };
        }
        if (url === `${SITE}/pricing/` || url === `${SITE}/features/`) {
          return { ...item, changefreq: 'monthly', priority: 0.9 };
        }
        return { ...item, changefreq: 'monthly', priority: 0.5 };
      },
    }),
  ],
  output: 'static',
  site: SITE,
  base: '/',
  markdown: { shikiConfig: { theme: 'github-dark' } },
  vite: {
    define: {
      'import.meta.env.PUBLIC_REGION': JSON.stringify(ENV_REGION),
      'import.meta.env.PUBLIC_SITE_URL': JSON.stringify(ENV_SITE_URL),
      'import.meta.env.PUBLIC_DEFAULT_LANG': JSON.stringify(ENV_DEFAULT_LANG),
      'import.meta.env.PUBLIC_FALLBACK_LANG': JSON.stringify(ENV_FALLBACK_LANG),
      'import.meta.env.PUBLIC_CDN_HOST': JSON.stringify(ENV_CDN_HOST),
    },
  },
});
