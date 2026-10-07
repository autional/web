/**
 * 构建期区域环境读取单点（astro.config.mjs 与 scripts/gen-static.mjs 共用）。
 *
 * 变量名与值域见 docs/positioning/22 §4.1（Vercel 项目侧注入）：
 *   REGION=cn|com  SITE_URL  DEFAULT_LANG=zh|en  FALLBACK_LANG=zh|en  CDN_HOST
 * 本地 dev 无 env 时兜底 cn 值（与迁移前基线一致）。
 */
export function readBuildEnv(env = process.env) {
  const region = env.REGION === 'com' ? 'com' : 'cn';
  const siteUrl = (env.SITE_URL || 'https://www.autional.cn').replace(/\/+$/, '');
  const defaultLang = env.DEFAULT_LANG === 'en' || env.DEFAULT_LANG === 'zh' ? env.DEFAULT_LANG : region === 'com' ? 'en' : 'zh';
  const fallbackLang = env.FALLBACK_LANG === 'en' || env.FALLBACK_LANG === 'zh' ? env.FALLBACK_LANG : defaultLang;
  const cdnHost = (env.CDN_HOST || 'https://cdn.autional.cn').replace(/\/+$/, '');
  return { region, siteUrl, defaultLang, fallbackLang, cdnHost };
}
