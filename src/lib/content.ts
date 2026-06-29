/*
  Content path layout:
    public/content/blog/   — Blog posts (.md + index.json), served as static files via nginx.
                             Loaded at runtime by fetch(). Supports live updates without rebuild.
    src/content/           — Localized marketing content (customers/, faq/, wiki/).
                             Imported at build time (TypeScript/Vite). Requires rebuild to update.
                             TODO(FE-076): Unify to runtime-loading model once i18n strategy settles.
*/
export interface BlogFrontmatter {
  title: string;
  date: string;
  category: string;
  tags: string[];
  readTime: string;
  excerpt: string;
  slug: string;
}

export interface BlogPost extends BlogFrontmatter {
  content: string;
}

let postsCache: BlogPost[] | null = null;

async function fetchIndex(): Promise<BlogFrontmatter[]> {
  const res = await fetch('/content/blog/index.json');
  if (!res.ok) throw new Error('Failed to load blog index');
  return res.json();
}

async function fetchContent(slug: string): Promise<string> {
  const res = await fetch(`/content/blog/${slug}.md`);
  if (!res.ok) throw new Error(`Failed to load blog post: ${slug}`);
  return res.text();
}

function stripFrontmatter(raw: string): string {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith('---')) return raw;
  const secondDelim = trimmed.indexOf('---', 3);
  if (secondDelim === -1) return raw;
  return trimmed.slice(secondDelim + 3).trimStart();
}

export async function getAllPosts(): Promise<BlogPost[]> {
  if (postsCache) return postsCache;
  const index = await fetchIndex();
  postsCache = index.map((item) => ({
    ...item,
    content: '', // content loaded on demand in getPostBySlug
  } as BlogPost));
  return postsCache;
}

export async function getPostBySlug(slug: string): Promise<BlogPost | undefined> {
  const index = await fetchIndex();
  const meta = index.find((p) => p.slug === slug);
  if (!meta) return undefined;
  const rawContent = await fetchContent(slug);
  const content = stripFrontmatter(rawContent);
  return { ...meta, content, slug };
}

export async function refetchPosts(): Promise<BlogPost[]> {
  postsCache = null;
  return getAllPosts();
}

export interface CustomerFrontmatter {
  title: string;
  company: string;
  industry: string;
  contact: string;
  slug: string;
}

export interface CustomerCase extends CustomerFrontmatter {
  content: string;
}

function parseFrontmatter(raw: string): { frontmatter: Record<string, string>; body: string } {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith('---')) return { frontmatter: {}, body: raw };
  const secondDelim = trimmed.indexOf('---', 3);
  if (secondDelim === -1) return { frontmatter: {}, body: raw };
  const fmBlock = trimmed.slice(3, secondDelim).trim();
  const body = trimmed.slice(secondDelim + 3).trimStart();
  const frontmatter: Record<string, string> = {};
  for (const line of fmBlock.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      let value = line.slice(colonIdx + 1).trim();
      value = value.replace(/^["']|["']$/g, '');
      frontmatter[key] = value;
    }
  }
  return { frontmatter, body };
}

const customerModules = import.meta.glob('../content/customers/*.md', { query: '?raw', import: 'default' });

export async function getAllCustomerCases(): Promise<CustomerCase[]> {
  const cases: CustomerCase[] = [];
  for (const [path, loader] of Object.entries(customerModules)) {
    const raw = await loader() as string;
    const { frontmatter, body } = parseFrontmatter(raw);
    const slug = path.split('/').pop()?.replace('.md', '') || '';
    cases.push({
      title: frontmatter.title || slug,
      company: frontmatter.company || '',
      industry: frontmatter.industry || '',
      contact: frontmatter.contact || '',
      slug,
      content: body,
    });
  }
  return cases;
}
