/**
 * blog 内容集合分语言目录工具（B1 §6-B1 行 4 链式清单单点）：
 * 文章按 `src/content/blog/{en,zh}/` 一等化后，集合 id 形如 `<lang>/<slug>`；
 * 每区产物只消费本区 DEFAULT_LANG 目录（plan §7 期望差异 ⑤），slug 需去语言前缀。
 */
import { DEFAULT_LANG } from './site-env';

/** 本区语言目录前缀（cn 面 = `zh/`，com 面 = `en/`）。 */
const REGION_PREFIX = `${DEFAULT_LANG}/`;

/** 是否属于本区语言目录。 */
export const isRegionPost = (id: string): boolean => id.startsWith(REGION_PREFIX);

/** 集合 id → 路由 slug：`zh/foo.md` → `foo`（对侧语言目录的 id 也机械去前缀，仅用于兜底）。 */
export const postSlug = (id: string): string => id.replace(/\.md$/, '').replace(/^[^/]+\//, '');
