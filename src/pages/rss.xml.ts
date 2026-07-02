import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context: { site: URL }) {
  const posts = await getCollection('blog', ({ data }) => data.status === 'verified');
  return rss({
    title: 'Autional Blog',
    description: 'Technical articles on identity, security, compliance, and architecture for AI-generated applications.',
    site: context.site,
    items: posts
      .sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime())
      .map((post) => ({
        title: post.data.title,
        pubDate: new Date(post.data.date),
        description: post.data.excerpt,
        link: `/blog/${post.id.replace(/\.md$/, '')}/`,
      })),
    customData: '<language>en-us</language>',
  });
}
