import '../i18n';
import { useTranslation } from 'react-i18next';
import { localeToLang, setLang, type Lang } from '../i18n';

/**
 * 语言切换（B1 §6-B1 行 5）：chrome + 列表经 LANG_EVENT 就地交换（见 LandingLayout 内脚本），
 * 页面正文保持区域默认语言；无 URL 变化，偏好存 localStorage（autional-lang）。
 * 按钮展示**目标语言**（当前 zh → 显示 EN；当前 en → 显示 中文）。
 */
export default function LangSwitch() {
  const { i18n, t } = useTranslation();
  const current: Lang = localeToLang(i18n.language ?? 'zh-CN');
  const target: Lang = current === 'zh' ? 'en' : 'zh';
  const label = target === 'en' ? t('lang.switchToEn') : t('lang.switchToZh');

  return (
    <button
      type="button"
      onClick={() => setLang(target)}
      title={label}
      aria-label={label}
      className="inline-flex h-10 items-center justify-center rounded-full border border-primary-100 bg-white/90 px-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary-700 shadow-soft transition hover:-translate-y-0.5 hover:bg-sky-50 dark:border-white/10 dark:bg-white/5 dark:text-sky-100 dark:hover:bg-white/10"
    >
      {target === 'en' ? 'EN' : '中文'}
    </button>
  );
}
