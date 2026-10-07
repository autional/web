/**
 * i18n 单键空间（B1 §1.1；契约见 plan §6-B1）：
 * - 双资源 en-US / zh-CN，嵌套键空间（i18next 默认 keySeparator '.'，不再扁平化）；
 * - 初始语言由构建期 env 注入（DEFAULT_LANG / FALLBACK_LANG，见 astro.config.mjs 的 vite.define）；
 *   不做 navigator 探测——区域即语言（doc 22 §1.4）；
 * - 手动切换（chrome + 列表）为客户端行为：LangSwitch island 调 setLang()，无 URL 变化；
 *   偏好存 localStorage，刷新后由 restoreLang() 采纳（SSR 首帧仍为区域默认语言，属已接受代价）。
 */
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import enUS from './en-US.json';
import zhCN from './zh-CN.json';

export const langs = ['zh', 'en'] as const;
export type Lang = (typeof langs)[number];

/** 语言偏好存储键（与主题键 autional-theme 并列）。 */
export const LANG_STORAGE_KEY = 'autional-lang';

/** 语言切换事件名：LandingLayout 的 chrome DOM 交换脚本监听此事件（B1-5）。 */
export const LANG_EVENT = 'autional:lang';

/** lang 短码 ↔ BCP-47 locale（i18next 资源键用 locale 全码）。 */
export const langToLocale = (lang: Lang): string => (lang === 'en' ? 'en-US' : 'zh-CN');
export const localeToLang = (locale: string): Lang => (locale.startsWith('en') ? 'en' : 'zh');

/** 区域 → 默认语言（doc 22 §4.1：com=en / cn=zh）。region 缺省取构建期 REGION。 */
export const defaultLang = (region?: string): Lang =>
  (region ?? import.meta.env.PUBLIC_REGION ?? 'cn') === 'com' ? 'en' : 'zh';

const envDefaultLang = defaultLang();
const envFallbackLang = (import.meta.env.PUBLIC_FALLBACK_LANG as Lang) ?? envDefaultLang;

/** 初始化 Promise：浏览器侧 init 默认延后（initImmediate），DOM 交换脚本等首个渲染点需等待它。 */
export const i18nReady = i18next.use(initReactI18next).init({
  resources: {
    'en-US': { translation: enUS },
    'zh-CN': { translation: zhCN },
  },
  lng: langToLocale(envDefaultLang),
  fallbackLng: langToLocale(envFallbackLang),
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

/** 取词单点：.astro frontmatter（构建期）与 React 组件（客户端）共用。 */
export function t(key: string, options: { returnObjects: true }): unknown;
export function t(key: string, options?: Record<string, unknown>): string;
export function t(key: string, options?: Record<string, unknown>): unknown {
  return i18next.t(key, options);
}

/**
 * 客户端切换（LangSwitch island 调用）：i18next 变更 + localStorage 持久化 + <html lang> 同步 +
 * LANG_EVENT 广播（chrome DOM 交换脚本与自定义监听方共用）。
 */
export const setLang = (lang: Lang): void => {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    /* 隐私模式等场景忽略 */
  }
  void i18next.changeLanguage(langToLocale(lang)).then(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = langToLocale(lang);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(LANG_EVENT, { detail: { lang, locale: langToLocale(lang) } }));
    }
  });
};

/** 客户端采纳已存偏好（卫语句；仅在浏览器可用时生效）。 */
export const restoreLang = (): void => {
  if (typeof window === 'undefined') return;
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY) as Lang | null;
    if (saved && langs.includes(saved) && langToLocale(saved) !== i18next.language) setLang(saved);
  } catch {
    /* 忽略 */
  }
};

export default i18next;
