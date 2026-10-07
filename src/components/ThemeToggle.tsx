import { useState, useEffect } from 'react';
import '../i18n';
import { useTranslation } from 'react-i18next';

/** 主题切换（文案走 i18n theme.*，语言切换联动自动重渲染）。 */
export function ThemeToggle() {
  const { t } = useTranslation();
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem('autional-theme', dark ? 'dark' : 'light');
    } catch {
      /* 隐私模式等场景忽略 */
    }
  }, [dark, mounted]);

  return (
    <button
      onClick={() => setDark(!dark)}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary-100 bg-white/90 text-primary-700 shadow-soft transition hover:-translate-y-0.5 hover:bg-sky-50 dark:border-white/10 dark:bg-white/5 dark:text-sky-100 dark:hover:bg-white/10"
      title={dark ? t('theme.light') : t('theme.dark')}
      aria-label={dark ? t('theme.light') : t('theme.dark')}
    >
      {!mounted ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2"/><path d="M12 21v2"/><path d="M4.22 4.22l1.42 1.42"/><path d="M18.36 18.36l1.42 1.42"/><path d="M1 12h2"/><path d="M21 12h2"/><path d="M4.22 19.78l1.42-1.42"/><path d="M18.36 5.64l1.42-1.42"/></svg>
      ) : dark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2"/><path d="M12 21v2"/><path d="M4.22 4.22l1.42 1.42"/><path d="M18.36 18.36l1.42 1.42"/><path d="M1 12h2"/><path d="M21 12h2"/><path d="M4.22 19.78l1.42-1.42"/><path d="M18.36 5.64l1.42-1.42"/></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
      )}
    </button>
  );
}
