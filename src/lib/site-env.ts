/**
 * 构建期区域环境单点（B1 单源双区；落点表见 docs/positioning/22 §2 与 plan §6-B2）。
 *
 * 两区由**同一份源**构建：com（en）/ cn（zh）各自在 Vercel 项目侧注入
 * REGION / SITE_URL / DEFAULT_LANG / FALLBACK_LANG / CDN_HOST（doc 22 §4.1），
 * astro.config.mjs 读取 process.env 后经 vite.define 内联为 import.meta.env.PUBLIC_*，
 * 因此本模块在 .astro frontmatter（SSR/构建期）与 React island（客户端）读到的值一致，
 * 且不依赖任何运行时探测。本地 dev 无 env 时兜底 cn 值（与迁移前基线一致）。
 *
 * 禁止在本文件之外散落区域字面量（站点域名 / CDN / 兄弟站 / GitHub 口径）。
 */

export type Region = 'cn' | 'com';
export type Lang = 'zh' | 'en';

export const REGION: Region = (import.meta.env.PUBLIC_REGION as Region) ?? 'cn';
export const SITE_URL: string = import.meta.env.PUBLIC_SITE_URL ?? 'https://www.autional.cn';
export const DEFAULT_LANG: Lang = (import.meta.env.PUBLIC_DEFAULT_LANG as Lang) ?? 'zh';
export const FALLBACK_LANG: Lang = (import.meta.env.PUBLIC_FALLBACK_LANG as Lang) ?? DEFAULT_LANG;
export const CDN_HOST: string = import.meta.env.PUBLIC_CDN_HOST ?? 'https://cdn.autional.cn';

/** CDN 资产族 pin —— 与 @autional/tokens rc.15 / @autional/tailwind-preset rc.9 同波（D8 单家族收敛）。 */
export const CDN_PIN = 'v0.1.0-rc.5ee19b4f';

/** CDN 资产 URL 拼接：cdnAsset('icons/favicon.svg')。 */
export const cdnAsset = (path: string): string => `${CDN_HOST}/ui/${CDN_PIN}/${path}`;

/** 站点 host（www.autional.cn）与根域（autional.cn）——兄弟站链接由此派生（W7），不写死子域。 */
export const SITE_HOST: string = new URL(SITE_URL).host;
export const SITE_ROOT_DOMAIN: string = SITE_HOST.replace(/^www\./, '');

/** 兄弟站链接：brotherUrl('docs') → https://docs.autional.cn（随本区根域派生）。 */
export const brotherUrl = (sub: string): string => `https://${sub}.${SITE_ROOT_DOMAIN}`;

/** GitHub 口径（W6 用户裁定：统一组织页 github.com/autional，两侧同值）。 */
export const GITHUB_ORG_URL = 'https://github.com/autional';

/** 对侧区主站 URL（W3 ai 页跨区互链）：仅 TLD 互换（.cn ↔ .com），全站唯一定义处。 */
export const OTHER_REGION_SITE_URL: string = SITE_URL.endsWith('.cn')
  ? SITE_URL.replace(/\.cn$/, '.com')
  : SITE_URL.replace(/\.com$/, '.cn');

/** BCP-47 locale（zh→zh-CN / en→en-US）。 */
export const LOCALE: string = DEFAULT_LANG === 'zh' ? 'zh-CN' : 'en-US';
