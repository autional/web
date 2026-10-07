import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { t } from '../i18n';
import { isRegionPost, postSlug } from '../lib/blog-lang';
import { LOCALE } from '../lib/site-env';

export async function GET(context: { site: URL }) {
  const posts = await getCollection('blog', ({ data }) => data.status === 'verified');
  return rss({
    title: t('layout.rssTitle'),
    description: t('blog.rssDesc'),
    site: context.site,
    items: posts
      .filter((post) => isRegionPost(post.id))
      .sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime())
      .map((post) => ({
        title: post.data.title,
        pubDate: new Date(post.data.date),
        description: post.data.excerpt,
        link: `/blog/${postSlug(post.id)}/`,
      })),
    customData: `<language>${LOCALE}</language>`,
  });
}
