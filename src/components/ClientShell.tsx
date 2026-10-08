import { useState, useEffect } from 'react';
import { Menu, X, Search, ChevronUp } from 'lucide-react';
import { i18nReady, restoreLang } from '../i18n';
import { useTranslation } from 'react-i18next';
import { ThemeToggle } from '../components/ThemeToggle';
import LangSwitch from '../components/LangSwitch';
import SearchModal from '../components/SearchModal';
import type { SearchItem } from '../lib/search-index';
import { brotherUrl, GITHUB_ORG_URL } from '../lib/site-env';

// 移动端首层菜单与桌面导航同序（2026-10-08 对齐：features/sdk/ai/pricing/docs/blog 六项与桌面同序；
// Contact 为移动端附加项，置于同段末尾——旧序 …docs/blog/contact/ai 与桌面不一致）
const navLinks = [
  { href: '/features', labelKey: 'nav.features' },
  { href: '/sdk', labelKey: 'nav.sdk' },
  { href: '/ai', labelKey: 'nav.ai' },
  { href: '/pricing', labelKey: 'nav.pricing' },
  { href: '/docs', labelKey: 'nav.docs' },
  { href: '/blog', labelKey: 'nav.blog' },
  { href: '/contact', labelKey: 'nav.contact' },
];

const externalLinks = [{ href: GITHUB_ORG_URL, label: 'GitHub' }];

// 移动菜单 CTA 落点与布局层头部 CTA 同源（developer 门户 quickstart）
const quickstartUrl = `${brotherUrl('developer')}/quickstart`;

export default function ClientShell({ searchIndex, currentPath }: { searchIndex: SearchItem[]; currentPath: string }) {
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.scrollY > 400;
  });
  const [searchOpen, setSearchOpen] = useState(false);

  // 已存语言偏好延后到 hydration 之后采纳（2026-10-08 #418 修复）：首渲与 SSR 区域默认语言一致；
  // 静态 chrome 的偏好交换已由 LandingLayout 脚本以 getFixedT 完成，此处只切 i18next 本体驱动 React 重渲
  useEffect(() => {
    void i18nReady.then(() => restoreLang());
  }, []);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const isCurrentPath = (href: string) => currentPath === href || currentPath.startsWith(`${href}/`);

  return (
    <>
      {/* 常驻 DOM + hidden 切换（2026-10-08）：菜单钮的 aria-controls 需要 id 始终在场；
          xl 以下显示（桌面导航自 xl 起，768–1279 并入本菜单） */}
      <div id="mobile-nav" className={`brand-shell absolute left-3 right-3 top-[calc(100%+var(--space-2))] border-primary-100/90 xl:hidden ${mobileOpen ? '' : 'hidden'}`}>
        <div className="space-y-1 px-4 py-4">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setMobileOpen(false)}
              aria-current={isCurrentPath(link.href) ? 'page' : undefined}
              className="block rounded-md px-3 py-2.5 text-base font-medium text-neutral-700 transition-colors hover:bg-sky-50 hover:text-primary-700 dark:text-neutral-300 dark:hover:bg-white/10"
            >{t(link.labelKey)}</a>
          ))}
          {externalLinks.map((link) => (
            <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" onClick={() => setMobileOpen(false)}
              className="block rounded-md px-3 py-2.5 text-base font-medium text-neutral-700 transition-colors hover:bg-sky-50 hover:text-primary-700 dark:text-neutral-300 dark:hover:bg-white/10"
            >{link.label} ↗</a>
          ))}
          <a href={quickstartUrl} onClick={() => setMobileOpen(false)}
            className="brand-button-primary mt-2 w-full"
          >{t('nav.getStarted')}</a>
        </div>
      </div>
      <div className="flex items-center gap-2 xl:hidden">
        <button onClick={() => setSearchOpen(true)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary-100 bg-white/90 text-primary-700 shadow-soft transition hover:bg-sky-50 dark:border-white/10 dark:bg-white/5 dark:text-sky-100 dark:hover:bg-white/10" aria-label={t('a11y.search')}>
          <Search className="h-5 w-5" />
        </button>
        <LangSwitch />
        <ThemeToggle />
        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary-100 bg-white/90 text-primary-700 shadow-soft transition hover:bg-sky-50 dark:border-white/10 dark:bg-white/5 dark:text-sky-100 dark:hover:bg-white/10"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={t('a11y.menu')}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      <div className="hidden xl:flex items-center gap-2">
        <button onClick={() => setSearchOpen(true)} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-primary-100 bg-white/90 px-4 text-xs font-semibold uppercase tracking-[0.16em] text-primary-700 shadow-soft transition hover:-translate-y-0.5 hover:bg-sky-50 dark:border-white/10 dark:bg-white/5 dark:text-sky-100 dark:hover:bg-white/10">
          <Search className="h-3.5 w-3.5" /><span>{t('nav.search')}</span>
          <kbd className="ml-1 hidden rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-semibold tracking-normal text-primary-500 dark:bg-white/10 dark:text-sky-100 lg:inline">Ctrl K</kbd>
        </button>
        <LangSwitch />
        <ThemeToggle />
      </div>
      {showScrollTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-white shadow-brand hover:scale-105 dark:bg-primary-700" aria-label={t('a11y.backToTop')}>
          <ChevronUp className="h-5 w-5" />
        </button>
      )}
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} items={searchIndex} />
    </>
  );
}
