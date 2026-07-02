import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  integrations: [
    tailwind(),
    react(),
    sitemap({
      serialize(item) {
        const url = item.url;
        if (url === 'https://www.autional.com/') {
          return { ...item, changefreq: 'daily', priority: 1.0, lastmod: new Date().toISOString() };
        }
        if (url.includes('/blog/') && url !== 'https://www.autional.com/blog/') {
          return { ...item, changefreq: 'weekly', priority: 0.7, lastmod: new Date().toISOString() };
        }
        if (url === 'https://www.autional.com/blog/' || url === 'https://www.autional.com/changelog/') {
          return { ...item, changefreq: 'weekly', priority: 0.8, lastmod: new Date().toISOString() };
        }
        if (url === 'https://www.autional.com/pricing/' || url === 'https://www.autional.com/features/') {
          return { ...item, changefreq: 'monthly', priority: 0.9, lastmod: new Date().toISOString() };
        }
        return { ...item, changefreq: 'monthly', priority: 0.5, lastmod: new Date().toISOString() };
      },
    }),
  ],
  output: 'static',
  site: 'https://www.autional.com',
  base: '/',
  markdown: { shikiConfig: { theme: 'github-dark' } },
});
