/**
 * 构建后断言（postbuild）—— 内容集合产出完整性。
 *
 * 背景（2026-10-22 /cases 事故）：Astro 7 默认跳过旧式 `type: 'content'` 集合
 * （`legacy.collectionsBackwardsCompat=false`）。失效不改退出码，只打一条
 * `[WARN] [content] The collection "x" does not exist or is empty`：
 * 构建"成功"，列表页空、`getStaticPaths` 0 条 ⇒ 详情页 404。线上照样发布。
 *
 * postbuild 读不到 astro build 的 stdout，所以不查告警文本，改为查三件硬事实：
 *   A. 根因守卫：`src/content.config.ts` 不得出现 `type: 'content'`（一律 glob() loader）；
 *   B. 条目守卫：本区 DEFAULT_LANG 目录下每个 status=verified 条目都必须有详情页，
 *      且被对应列表页链接（= 空列表与 404 的直接反证）；
 *   C. 页面守卫：sitemap 的每个 URL 都必须有对应产物文件（= 页面整体丢失的反证）。
 *
 * 任一条不满足即退出码 1 —— Vercel 构建立即失败，不再静默发布空页面。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBuildEnv } from './env.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const { defaultLang, siteUrl } = readBuildEnv();
const COLLECTIONS = ['blog', 'cases'];

const errors = [];
const notes = [];

/** 读取文件的首个 frontmatter 块。 */
function frontmatter(file) {
  const src = readFileSync(file, 'utf8');
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : '';
}

// ── A. 根因守卫：拒绝旧式集合定义 ────────────────────────────────────────────
const contentConfig = readFileSync(join(root, 'src', 'content.config.ts'), 'utf8');
if (/type:\s*['"]content['"]/.test(contentConfig)) {
  errors.push(
    "src/content.config.ts 含旧式 `type: 'content'`：Astro 7 会静默跳过该集合，" +
      '改 `glob() loader`（见 README「Content collections」）',
  );
}

// ── B. 条目守卫：verified 条目 → 详情页 + 列表页链接 ─────────────────────────
for (const name of COLLECTIONS) {
  const dir = join(root, 'src', 'content', name, defaultLang);
  if (!existsSync(dir)) {
    errors.push(`缺少内容目录 src/content/${name}/${defaultLang}`);
    continue;
  }
  const indexHtml = join(dist, name, 'index.html');
  const index = existsSync(indexHtml) ? readFileSync(indexHtml, 'utf8') : null;
  if (!index) errors.push(`缺少列表页 dist/${name}/index.html`);

  let verified = 0;
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    if (!/^status:\s*verified\s*$/m.test(frontmatter(join(dir, file)))) continue;
    verified += 1;
    const slug = file.replace(/\.md$/, '');
    if (!existsSync(join(dist, name, slug, 'index.html'))) {
      errors.push(`缺少详情页 dist/${name}/${slug}/index.html（${name} 条目 ${slug} 已 verified）`);
    }
    if (index && !index.includes(`/${name}/${slug}"`) && !index.includes(`/${name}/${slug}/"`)) {
      errors.push(`列表页 dist/${name}/index.html 未链接条目 ${slug}`);
    }
  }
  notes.push(`${name}: ${verified} 条 verified`);
}

// ── C. 页面守卫：sitemap URL → 产物文件 ───────────────────────────────────────
const sitemapPath = join(dist, 'sitemap-0.xml');
if (!existsSync(sitemapPath)) {
  errors.push('缺少 dist/sitemap-0.xml');
} else {
  const locs = [...readFileSync(sitemapPath, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (!locs.length) errors.push('sitemap 为空');
  for (const loc of locs) {
    const pathname = decodeURIComponent(new URL(loc).pathname);
    if (!pathname.startsWith('/')) continue;
    const file = pathname.endsWith('/')
      ? join(dist, ...pathname.split('/').filter(Boolean), 'index.html')
      : join(dist, ...pathname.split('/').filter(Boolean));
    if (!existsSync(file)) errors.push(`sitemap URL 无产物：${loc} → ${file.replace(root, '')}`);
  }
  notes.push(`sitemap: ${locs.length} 条`);
}

// ── 结果 ─────────────────────────────────────────────────────────────────────
const pageCount = (function count(dir) {
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) n += count(join(dir, entry.name));
    else if (entry.name.endsWith('.html')) n += 1;
  }
  return n;
})(dist);

if (errors.length) {
  console.error('\n[check-build] 构建产物不完整（' + siteUrl + ' / ' + defaultLang + '）：');
  for (const e of errors) console.error('  ✗ ' + e);
  console.error(`\n[check-build] ${notes.join('；')}；html=${pageCount}\n`);
  process.exit(1);
}

console.log(`[check-build] OK —— ${notes.join('；')}；html=${pageCount}（${siteUrl} / ${defaultLang}）`);
