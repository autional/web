// 站内搜索索引 — 单源双区（B1 §6-B1 行 3，W10 键化边界）：
// - 静态页条目只登记**文案键**（search.pages.*），客户端按当前语言解析 → 语言切换联动（B1-5）；
// - 博客条目携带区域语言内容原文（文章本体不随 chrome 切换翻译，分类走 blog.categories.* 键）；
// - 构建期由 LandingLayout 调用，入参已按本区语言目录过滤（见 lib/blog-lang.ts）。
// 反模式警示：历史实现为 SearchModal.tsx 内 17 路径硬编码（覆盖 25%），本文件取代之。

import { postSlug } from './blog-lang';

export interface SearchItem {
  path: string;
  /** 静态页：文案键（客户端解析）；博客条目缺省 */
  titleKey?: string;
  excerptKey?: string;
  /** 博客：区域语言原文；静态页缺省 */
  title?: string;
  excerpt?: string;
  /** 分类键（静态页 = search.category.page；博客 = blog.categories.<enum 小写>） */
  categoryKey: string;
}

/** 全部站内静态页面（新增页面时在此外登记，登记即被搜索覆盖）。 */
export const STATIC_PAGE_DEFS: readonly { path: string; key: string }[] = [
  { path: '/', key: 'home' },
  { path: '/features', key: 'features' },
  { path: '/pricing', key: 'pricing' },
  { path: '/compare', key: 'compare' },
  { path: '/roadmap', key: 'roadmap' },
  { path: '/showcase', key: 'showcase' },
  { path: '/trust', key: 'trust' },
  { path: '/docs', key: 'docs' },
  { path: '/sdk', key: 'sdk' },
  { path: '/ai', key: 'ai' },
  { path: '/blog', key: 'blog' },
  { path: '/changelog', key: 'changelog' },
  { path: '/faq', key: 'faq' },
  { path: '/about', key: 'about' },
  { path: '/contact', key: 'contact' },
  { path: '/privacy', key: 'privacy' },
  { path: '/terms', key: 'terms' },
];

interface BlogLike {
  id: string;
  data: { title: string; category: string; excerpt: string };
}

/** 静态页 + 本区全量博客文章（构建期调用；顺序稳定：页面在前，博文按传入顺序）。 */
export function buildSearchIndex(posts: BlogLike[]): SearchItem[] {
  return [
    ...STATIC_PAGE_DEFS.map(({ path, key }) => ({
      path,
      titleKey: `search.pages.${key}.title`,
      excerptKey: `search.pages.${key}.excerpt`,
      categoryKey: 'search.category.page',
    })),
    ...posts.map((post) => ({
      path: `/blog/${postSlug(post.id)}/`,
      title: post.data.title,
      excerpt: post.data.excerpt,
      categoryKey: `blog.categories.${post.data.category.toLowerCase()}`,
    })),
  ];
}
