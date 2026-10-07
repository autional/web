import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context: { site: URL }) {
  const posts = await getCollection('blog', ({ data }) => data.status === 'verified');
  return rss({
    title: 'Autional 博客',
    description: '关于身份、安全、合规与架构的技术文章，面向 AI 生成的应用。',
    site: context.site,
    items: posts
      .sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime())
      .map((post) => ({
        title: post.data.title,
        pubDate: new Date(post.data.date),
        description: post.data.excerpt,
        link: `/blog/${post.id.replace(/\.md$/, '')}/`,
      })),
    customData: '<language>zh-CN</language>',
  });
}
