#!/usr/bin/env node
/**
 * gen-static.mjs —— B1 构建前生成物（plan §6-B2 行 6/9/10 + W1/W2/W12）。
 *
 * 生成（全部写进 public/，Astro 构建时随 public 拷进 dist/）：
 *   public/robots.txt          ← SITE_URL（行 6）
 *   public/llms.txt            ← scripts/templates/llms.txt + 区域变量 + 语言行（行 9 / W12）
 *   public/og-default.svg      ← scripts/templates/og-default.svg，{{HOST}} 按 SITE_URL 渲染（W2）
 *   public/og-default.png      ← 由上面的 svg 同步渲染（@resvg/resvg-js；替换原手跑脚本）
 *   public/og/blog/<slug>.png  ← 本区语言目录逐篇博客分享卡（scripts/og-blog-cards.mjs）
 *   public/ai/skill.md         ← 本区默认语言镜像文件拷贝（= skill.{zh|en}.md；行 10）
 *   public/ai/skill.md.sha256  ← 随生成关系重排（与 check-skills 门口径一致；W1）
 *
 * 纪律：
 * - 这些路径均为生成物：已 gitignore + `git rm --cached`（勿手改、勿入库）；
 * - skill.en.md / skill.zh.md 是**入仓镜像**（上游 SDK 生成物字节保真，W1），本脚本只读不写；
 *   内容内区域 URL 的问题归 skills 分发线（docs 10/11），不在站点侧改写；
 * - 幂等：同一 env 重复执行输出一致；env 缺省兜底 cn（scripts/env.mjs）。
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderAsync } from '@resvg/resvg-js';
import { readBuildEnv } from './env.mjs';
import { generateBlogCards } from './og-blog-cards.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const { siteUrl, defaultLang, cdnHost } = readBuildEnv();
const host = new URL(siteUrl).host;

const pub = (p) => join(root, 'public', p);
const tpl = (p) => readFileSync(join(root, 'scripts', 'templates', p), 'utf8');

// 分享卡字体（入仓 scripts/fonts/，resvg 专用）：Noto 为站内语料子集版本，
// 新字符不在子集内会渲染为空——重建方式见 scripts/fonts/README.md
const cardFontFiles = () =>
  ['Inter-Regular.ttf', 'Inter-ExtraBold.ttf', 'NotoSansSC-Regular.subset.ttf', 'NotoSansSC-Bold.subset.ttf'].map((f) =>
    join(root, 'scripts', 'fonts', f),
  );

// ── 1. robots.txt（落点表行 6）───────────────────────────────────────────────
writeFileSync(pub('robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap-index.xml\n`);

// ── 2. llms.txt（行 9 / W12：cn 基线模板 + 区域变量 + 语言行）─────────────────
const LLMS_STRINGS = {
  zh: {
    LANG_LABEL: '中文',
    AI_SECTION: '一句话为应用接入登录',
    AI_TUTORIAL_LABEL: '教程',
    SKILL_PRIMARY_LABEL: '中文',
    SKILL_PRIMARY_FILE: 'skill.md',
    SKILL_PRIMARY_CDN_FILE: 'SKILL.md',
    SKILL_SECONDARY_LABEL: 'EN',
    SKILL_SECONDARY_FILE: 'skill.en.md',
    SKILL_SECONDARY_CDN_FILE: 'SKILL.en.md',
    CDN_MIRROR_LABEL: '自有 CDN 镜像',
    COMPLIANCE_LABEL: '合规档',
    CONFIG_TEMPLATE_LABEL: '配置模板',
  },
  en: {
    LANG_LABEL: 'English',
    AI_SECTION: 'add login to any app with one prompt',
    AI_TUTORIAL_LABEL: 'Tutorial',
    SKILL_PRIMARY_LABEL: 'EN',
    SKILL_PRIMARY_FILE: 'skill.md',
    SKILL_PRIMARY_CDN_FILE: 'SKILL.md',
    SKILL_SECONDARY_LABEL: '中文',
    SKILL_SECONDARY_FILE: 'skill.zh.md',
    SKILL_SECONDARY_CDN_FILE: 'SKILL.zh.md',
    CDN_MIRROR_LABEL: 'CDN Mirror',
    COMPLIANCE_LABEL: 'Compliance matrix',
    CONFIG_TEMPLATE_LABEL: 'Config template',
  },
};
const blogCount = readdirSync(join(root, 'src', 'content', 'blog', defaultLang)).filter((f) => f.endsWith('.md')).length;
const llmsVars = { ...LLMS_STRINGS[defaultLang], SITE_URL: siteUrl, CDN_HOST: cdnHost, BLOG_COUNT: String(blogCount) };
let llms = tpl('llms.txt');
for (const [k, v] of Object.entries(llmsVars)) llms = llms.replaceAll(`{{${k}}}`, v);
if (/\{\{[A-Z_]+\}\}/.test(llms)) throw new Error(`llms.txt 模板存在未替换变量：${llms.match(/\{\{[A-Z_]+\}\}/g)}`);
writeFileSync(pub('llms.txt'), llms);

// ── 3. ai/skill.md + skill.md.sha256（行 10 / W1）───────────────────────────
const skillSrc = pub(join('ai', `skill.${defaultLang}.md`));
if (!existsSync(skillSrc)) throw new Error(`skill 镜像缺失：public/ai/skill.${defaultLang}.md（入仓镜像文件，勿删）`);
const skillBytes = readFileSync(skillSrc);
writeFileSync(pub(join('ai', 'skill.md')), skillBytes);
writeFileSync(pub(join('ai', 'skill.md.sha256')), `${createHash('sha256').update(skillBytes).digest('hex')}  skill.md\n`);

// ── 4. og-default.svg + .png（W2：模板化 + 同步重渲染）───────────────────────
const ogSvg = tpl('og-default.svg').replaceAll('{{HOST}}', host);
writeFileSync(pub('og-default.svg'), ogSvg);
// resvg 不加载系统字体（构建机字体不可控），字体全部来自入仓的 scripts/fonts/；
// 此前只有 loadSystemFonts:false 而没有 fontFiles —— 所有 <text> 渲染为空，线上分享卡长期无文字
const png = await renderAsync(ogSvg, {
  font: { fontFiles: cardFontFiles(), loadSystemFonts: false, defaultFontFamily: 'Inter' },
});
writeFileSync(pub('og-default.png'), png.asPng());

// ── 5. og/blog/<slug>.png（逐篇博客分享卡；本区语言目录 + status=verified）────
const blogCards = await generateBlogCards({ root, host, defaultLang });

console.log(
  `[gen-static] region=${readBuildEnv().region} defaultLang=${defaultLang} site=${siteUrl}\n` +
    `  robots.txt / llms.txt (blog=${blogCount}) / ai/skill.md(< skill.${defaultLang}.md) + .sha256 / og-default.svg+png (host=${host}) / og/blog/*.png (${blogCards} 篇)`,
);
