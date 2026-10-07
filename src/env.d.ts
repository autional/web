/// <reference types="astro/client" />

/** astro.config.mjs 经 vite.define 内联的构建期区域环境（见 src/lib/site-env.ts）。 */
interface ImportMetaEnv {
  readonly PUBLIC_REGION?: string;
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_DEFAULT_LANG?: string;
  readonly PUBLIC_FALLBACK_LANG?: string;
  readonly PUBLIC_CDN_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
