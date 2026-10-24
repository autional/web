/**
 * 构建后断言（postbuild）—— 死链守卫。
 *
 * 背景（2026-10-24 SEO 404 收口）：页面上残留过两类死链 ——
 *   A. 指向已下线域名的绝对链接（`demo.autional.com` / `demo.autional.cn`，演示环境已下线）；
 *   B. 站内相对链接指向从未存在的路径（如 4 篇博客里的 `/developer/docs*`）。
 * 两者都只靠人眼发现，构建不报错、线上照样发布。
 *
 * 校验两条硬规则：
 *   1. 退役域名：dist 全部文本产物（html/xml/txt/json）不得出现退役主机名；
 *   2. 站内相对链接：每个 `href|src="/..."` 都必须有对应产物文件
 *      （`dist/<path>` 或 `dist/<path>/index.html`），或在 vercel.json 的 redirects 里。
 *
 * 外部绝对链接不校验（跨站可达性不在构建期判定）。
 * 任一条不满足即退出码 1 —— Vercel 构建立即失败。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBuildEnv } from './env.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const { siteUrl, defaultLang } = readBuildEnv();

/** 已下线的站点主机名：命中即失败。新增退役站点时在此追加。 */
const RETIRED_HOSTS = ['demo.autional.com', 'demo.autional.cn'];

const TEXT_EXT = ['.html', '.xml', '.txt', '.json'];

/** 递归列出 dist 下所有文件（相对路径，posix 分隔符）。 */
function walk(dir, base = '') {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out;
}

/** vercel.json 里 redirects 的 source 路径：站内链接命中它们不算死链。 */
function redirectSources() {
  const file = join(root, 'vercel.json');
  if (!existsSync(file)) return new Set();
  const { redirects = [] } = JSON.parse(readFileSync(file, 'utf8'));
  const set = new Set();
  for (const r of redirects) {
    if (typeof r.source !== 'string' || r.source.includes('(')) continue; // 跳过正则源
    set.add(r.source);
    set.add(r.source.endsWith('/') ? r.source.slice(0, -1) : `${r.source}/`);
  }
  return set;
}

/** 站内路径是否可解析到产物（文件或目录 index.html）。 */
function resolves(pathname) {
  const clean = decodeURIComponent(pathname).replace(/^\/+/, '');
  const parts = clean.split('/').filter(Boolean);
  const asFile = join(dist, ...parts);
  if (parts.length && existsSync(asFile) && statSync(asFile).isFile()) return true;
  const asIndex = join(dist, ...parts, 'index.html');
  return existsSync(asIndex);
}

const files = walk(dist).filter((f) => TEXT_EXT.includes(f.slice(f.lastIndexOf('.'))));
const allowedRedirects = redirectSources();
const errors = [];
const seen = new Set();
let linkCount = 0;

for (const rel of files) {
  const file = join(dist, ...rel.split('/'));
  const text = readFileSync(file, 'utf8');

  // ── 1. 退役域名（全文扫描，覆盖 html/xml/txt）─────────────────────────────
  for (const host of RETIRED_HOSTS) {
    if (text.includes(host)) {
      const key = `host:${host}:${rel}`;
      if (!seen.has(key)) {
        seen.add(key);
        errors.push(`dist/${rel} 引用已退役域名 ${host}`);
      }
    }
  }

  if (!rel.endsWith('.html')) continue;

  // ── 2. 站内相对链接必须可解析 ────────────────────────────────────────────
  for (const m of text.matchAll(/(?:href|src)="([^"]*)"/g)) {
    const raw = m[1].trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('//')) continue;
    if (/^(mailto:|tel:|javascript:|data:)/i.test(raw)) continue;
    if (/^https?:\/\//i.test(raw)) continue; // 外部绝对链接不校验
    if (!raw.startsWith('/')) continue; // 相对当前页的链接由 Astro 正常生成，跳过

    const pathname = raw.split(/[?#]/)[0] || '/';
    linkCount += 1;
    if (allowedRedirects.has(pathname)) continue;
    if (resolves(pathname)) continue;
    const key = `${pathname}:${rel}`;
    if (seen.has(key)) continue;
    seen.add(key);
    errors.push(`dist/${rel} 站内链接无产物：${pathname}`);
  }
}

if (errors.length) {
  console.error('\n[check-links] 发现死链（' + siteUrl + ' / ' + defaultLang + '）：');
  for (const e of errors) console.error('  ✗ ' + e);
  console.error('');
  process.exit(1);
}

console.log(
  `[check-links] OK —— 扫描 ${files.length} 个产物、${linkCount} 条站内链接；退役域名 ${RETIRED_HOSTS.length} 个零命中（${siteUrl} / ${defaultLang}）`,
);
