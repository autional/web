#!/usr/bin/env node
/**
 * build-corpus.mjs —— 生成 Noto Sans SC 子集化语料（scripts/fonts/subset-corpus.txt）。
 *
 * 语料 = 站上可能出现的中文文本全集：两区博客全文（含 frontmatter）+ 双语 i18n 资源 +
 * ASCII 可打印 + 中英文标点。博客新增了语料外字符时，分享卡图会缺字形（渲染为空），
 * 修复流程：node scripts/fonts/build-corpus.mjs → 重跑 pyftsubset（命令见 README.md）。
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));
const root = join(dir, '..', '..');

const chars = new Set();

// ASCII 可打印
for (let c = 0x20; c <= 0x7e; c++) chars.add(String.fromCharCode(c));
// CJK 标点 + 常用符号
for (const c of '　、。〃々〈〉《》「」『』【】〔〕〖〗！？，．：；…—～·｜＼＠＃＄％＾＆＊（）＋－＝｛｝［］＂＇０１２３４５６７８９ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ·×→←↑↓↔≈≠≤≥±°') chars.add(c);

const collect = (p) => {
  let text;
  try { text = readFileSync(p, 'utf8'); } catch { return; }
  for (const ch of text) chars.add(ch);
};

const blogRoot = join(root, 'src', 'content', 'blog');
for (const lang of readdirSync(blogRoot)) {
  const langDir = join(blogRoot, lang);
  for (const f of readdirSync(langDir)) collect(join(langDir, f));
}
collect(join(root, 'src', 'i18n', 'zh-CN.json'));
collect(join(root, 'src', 'i18n', 'en-US.json'));

// emoji 区段排除：Noto Sans SC 无这些字形（浏览器/系统用彩色 emoji 字体渲染），
// 混入语料只会让覆盖检查永远报缺——正文里的 ✅❌ 不属于分享卡渲染范围
const isEmoji = (cp) => cp >= 0x1f000 || (cp >= 0x2600 && cp <= 0x27bf) || (cp >= 0xfe00 && cp <= 0xfe0f);
const sorted = [...chars]
  .filter((c) => c !== '\n' && c !== '\r' && !isEmoji(c.codePointAt(0)))
  .sort();
const out = sorted.join('');
writeFileSync(join(dir, 'subset-corpus.txt'), out);
const cjk = sorted.filter((c) => c.codePointAt(0) > 0x2e7f).length;
console.log(`[build-corpus] total=${sorted.length} cjk=${cjk} (含 ASCII ${95})`);
