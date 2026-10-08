#!/usr/bin/env node
/**
 * og-blog-cards.mjs —— 构建期逐篇博客分享卡（1200×630 PNG）。
 *
 * 由 gen-static.mjs 调用（prebuild/predev 链），产物 public/og/blog/<slug>.png（gitignore）。
 * 消费方：[slug].astro 的 Layout image prop（meta og:image = /og/blog/<slug>.png）。
 *
 * 要点：
 * - 只处理本区语言目录 + status=verified（与 [slug].astro getStaticPaths 同判据，
 *   未核验文章既无页面也不得把标题泄进公开图片）；
 * - 断行用 fontkitten 逐字前进宽度度量，字体栈顺序与渲染回退一致（Latin→Inter，CJK→Noto）；
 * - 标题/分类含字体栈外字符（渲染为空字）时 fail loud —— 重子集流程见 scripts/fonts/README.md；
 * - 幂等：同输入重复执行输出一致。
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { create as createFont } from 'fontkitten';
import { renderAsync } from '@resvg/resvg-js';

const here = fileURLToPath(new URL('.', import.meta.url));
const FONT_FILES = ['Inter-Regular.ttf', 'Inter-ExtraBold.ttf', 'NotoSansSC-Regular.subset.ttf', 'NotoSansSC-Bold.subset.ttf'].map(
  (f) => join(here, 'fonts', f),
);
const TPL = readFileSync(join(here, 'templates', 'og-blog.svg'), 'utf8');

// 度量字体栈（与 resvg 的逐字回退顺序一致：先命中先得）
const [interRegular, interBold, notoRegular, notoBold] = FONT_FILES.map((f) => createFont(readFileSync(f)));
const STACKS = { 400: [interRegular, notoRegular], 700: [interBold, notoBold], 800: [interBold, notoBold] };

const measure = (text, size, stack) => {
  let width = 0;
  const missing = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    const font = stack.find((f) => f.hasGlyphForCodePoint(cp));
    if (!font) {
      missing.push(ch);
      continue;
    }
    width += (font.glyphForCodePoint(cp).advanceWidth * size) / font.unitsPerEm;
  }
  return { width, missing };
};

const CJK_IDEOGRAPH = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/;
// 行尾标点（贴前一单元，避免行首标点）
const CJK_PUNCT = /[、。〃々〈〉《》「」『』【】〔〕〖〗！？，．：；…—～｜＠＃＄％＾＆＊（）＋－＝｛｝［］＂＇·]/;

/** 断行单元：CJK 逐字、Latin/数字按词（空格随词前移）、中文标点贴前字。 */
const tokenize = (text) => {
  const units = [];
  let buf = '';
  let sp = false;
  const flush = () => {
    if (buf) {
      units.push((sp ? ' ' : '') + buf);
      sp = false;
      buf = '';
    }
  };
  for (const ch of text) {
    if (ch === ' ') {
      flush();
      sp = true;
    } else if (CJK_PUNCT.test(ch)) {
      // 贴到紧邻在前的字符：优先未 flush 的词缓冲，其次最后一个单元
      if (buf) buf += ch;
      else if (units.length) units[units.length - 1] += ch;
      else buf += ch;
    } else if (CJK_IDEOGRAPH.test(ch)) {
      flush();
      units.push((sp ? ' ' : '') + ch);
      sp = false;
    } else {
      buf += ch;
    }
  }
  flush();
  return units;
};

const wrap = (text, size, maxWidth) => {
  const lines = [];
  let line = '';
  for (const rawUnit of tokenize(text)) {
    const unit = line === '' ? rawUnit.trimStart() : rawUnit;
    const candidate = line + unit;
    if (line === '' || measure(candidate, size, STACKS[800]).width <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line.trimEnd());
      line = unit.trimStart();
    }
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines;
};

const truncateToFit = (text, size, maxWidth) => {
  const ell = measure('…', size, STACKS[800]).width;
  let out = '';
  for (const ch of text) {
    if (measure(out + ch, size, STACKS[800]).width + ell > maxWidth) break;
    out += ch;
  }
  return `${out}…`;
};

const fitTitle = (title, maxWidth, maxLines) => {
  for (const size of [64, 57, 50, 44]) {
    const lines = wrap(title, size, maxWidth);
    const overflow = lines.some((l) => measure(l, size, STACKS[800]).width > maxWidth);
    if (lines.length <= maxLines && !overflow) return { size, lines };
  }
  const size = 44;
  const lines = wrap(title, size, maxWidth).slice(0, maxLines);
  lines[lines.length - 1] = truncateToFit(lines[lines.length - 1], size, maxWidth);
  return { size, lines };
};

const escapeXml = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const assertCovered = (text, what, slug) => {
  const { missing } = measure(text, 22, STACKS[800]);
  if (missing.length) {
    const detail = missing.map((c) => `${c}(U+${c.codePointAt(0).toString(16).toUpperCase()})`).join(' ');
    throw new Error(`[og-blog] ${slug} 的${what}含字体栈外字符：${detail} —— 分享卡渲染为空字；重子集流程见 scripts/fonts/README.md`);
  }
};

// 标题带（品牌行 160 之下 / accent 与底栏之上），最多 3 行、字号自适应
const MAX_W = 1000;
const ZONE_TOP = 196;
const ZONE_H = 316;
const LINE_HEIGHT = 1.32;

export async function generateBlogCards({ root, host, defaultLang }) {
  const blogDir = join(root, 'src', 'content', 'blog', defaultLang);
  const outDir = join(root, 'public', 'og', 'blog');
  mkdirSync(outDir, { recursive: true });
  // 先清空：双区构建共享 public/，上一区（另一语言）的卡片残留会被本区一起打包进 dist
  for (const f of readdirSync(outDir)) {
    if (f.endsWith('.png')) rmSync(join(outDir, f));
  }
  const locale = defaultLang === 'en' ? 'en-US' : 'zh-CN';
  const categories = JSON.parse(readFileSync(join(root, 'src', 'i18n', `${locale}.json`), 'utf8')).blog.categories;

  let count = 0;
  for (const file of readdirSync(blogDir).filter((f) => f.endsWith('.md'))) {
    const raw = readFileSync(join(blogDir, file), 'utf8');
    const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fmMatch) throw new Error(`[og-blog] ${file} 缺 frontmatter`);
    const fm = parseYaml(fmMatch[1]);
    if (fm.status !== 'verified') continue;
    const slug = file.replace(/\.md$/, '');
    const title = String(fm.title ?? '');
    const catLabel = String(categories[String(fm.category).toLowerCase()] ?? fm.category ?? '');
    if (!title) throw new Error(`[og-blog] ${file} 缺 title`);

    assertCovered(title, '标题', slug);
    assertCovered(catLabel, '分类', slug);

    const { size, lines } = fitTitle(title, MAX_W, 3);
    const lh = Math.round(size * LINE_HEIGHT);
    const blockH = lines.length * lh;
    const top = ZONE_TOP + Math.max(0, (ZONE_H - blockH) / 2);
    const firstBaseline = Math.round(top + (lh - size) / 2 + size * 0.82);
    const spans = lines
      .map((l, i) => `<tspan x="100" y="${Math.round(firstBaseline + i * lh)}">${escapeXml(l)}</tspan>`)
      .join('');
    const accentY = Math.round(firstBaseline + (lines.length - 1) * lh + size * 0.72);

    const pillW = Math.round(measure(catLabel, 22, STACKS[700]).width) + 36;
    const svg = TPL.replaceAll('{{HOST}}', escapeXml(host))
      .replaceAll('{{DATE}}', escapeXml(String(fm.date ?? '')))
      .replaceAll('{{CATEGORY}}', escapeXml(catLabel))
      .replaceAll('{{PILL_X}}', String(1100 - pillW))
      .replaceAll('{{PILL_W}}', String(pillW))
      .replaceAll('{{PILL_TEXT_X}}', String(1100 - pillW + 18))
      .replaceAll('{{TITLE_SIZE}}', String(size))
      .replaceAll('{{TITLE_SPANS}}', spans)
      .replaceAll('{{ACCENT_Y}}', String(accentY));
    if (/\{\{[A-Z_]+\}\}/.test(svg)) throw new Error(`[og-blog] 模板存在未替换变量：${svg.match(/\{\{[A-Z_]+\}\}/g)}`);

    const png = await renderAsync(svg, { font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: 'Inter' } });
    writeFileSync(join(outDir, `${slug}.png`), png.asPng());
    count++;
  }
  return count;
}
