// 站内搜索索引 — 单一来源：静态路由表 + 博客内容集合（构建期生成，见 LandingLayout.astro）
// 反模式警示：历史实现为 SearchModal.tsx 内 17 路径硬编码（覆盖 25%），本文件取代之。

export interface SearchItem {
  path: string;
  title: string;
  category: string;
  excerpt: string;
}

export const BLOG_CATEGORY_LABELS: Record<string, string> = {
  Tech: '技术',
  Architecture: '架构',
  Compliance: '合规',
  Product: '产品',
  Security: '安全',
  Project: '项目',
};

/** 全部站内静态页面（新增页面时在此外登记，登记即被搜索覆盖） */
export const STATIC_PAGES: SearchItem[] = [
  { path: '/', title: '首页', category: '页面', excerpt: '面向 AI 生成应用的身份层' },
  { path: '/features', title: '功能', category: '页面', excerpt: 'SSO、MFA、通行密钥（Passkey）、多租户、审计与合规等核心能力' },
  { path: '/pricing', title: '定价方案', category: '页面', excerpt: '自托管开源免费；云服务档位在路线图中（即将推出）' },
  { path: '/compare', title: '方案对比', category: '页面', excerpt: '与 Auth0、Clerk、WorkOS 等身份平台的诚实对比' },
  { path: '/roadmap', title: '路线图', category: '页面', excerpt: '已交付成果与后续规划' },
  { path: '/showcase', title: '演示与展示', category: '页面', excerpt: '真实演示环境与产品能力一览' },
  { path: '/trust', title: '安全与合规', category: '页面', excerpt: '安全架构与合规建设进展' },
  { path: '/docs', title: '开发者文档', category: '页面', excerpt: '快速开始、API 参考与概念指南' },
  { path: '/sdk', title: 'SDK', category: '页面', excerpt: '已发布 npm 软件包与规划中的 SDK' },
  { path: '/ai', title: 'AI 接入', category: '页面', excerpt: '一句话让 AI 编程助手接入登录与多用户能力' },
  { path: '/blog', title: '博客', category: '页面', excerpt: '身份技术、安全与工程实践文章' },
  { path: '/changelog', title: '更新日志', category: '页面', excerpt: '产品版本更新与改进记录' },
  { path: '/faq', title: '常见问题', category: '页面', excerpt: '产品、开源、安全与开发者常见问题' },
  { path: '/about', title: '关于我们', category: '页面', excerpt: '使命、历程与路线图' },
  { path: '/contact', title: '联系我们', category: '页面', excerpt: '技术支持、商务合作与 GitHub Issues' },
  { path: '/privacy', title: '隐私政策', category: '页面', excerpt: '个人信息的收集、使用与保护' },
  { path: '/terms', title: '服务条款', category: '页面', excerpt: '使用 Autional 服务的法律协议与条款' },
];

interface BlogLike {
  id: string;
  data: { title: string; category: string; excerpt: string };
}

/** 静态页 + 全量博客文章（构建期调用；顺序稳定：页面在前，博文按传入顺序） */
export function buildSearchIndex(posts: BlogLike[]): SearchItem[] {
  return [
    ...STATIC_PAGES,
    ...posts.map((post) => ({
      path: `/blog/${post.id.replace(/\.md$/, '')}/`,
      title: post.data.title,
      category: BLOG_CATEGORY_LABELS[post.data.category] ?? post.data.category,
      excerpt: post.data.excerpt,
    })),
  ];
}
