import { useState, useEffect } from 'react';
import { Menu, X, Search, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ThemeToggle } from '../components/ThemeToggle';
import SearchModal from '../components/SearchModal';
import CookieConsent from '../components/CookieConsent';

const navLinks = [
  { href: '/features', labelKey: 'nav.features' },
  { href: '/pricing', labelKey: 'nav.pricing' },
  { href: '/docs', labelKey: 'nav.docs' },
  { href: '/blog', labelKey: 'nav.blog' },
  { href: '/contact', labelKey: 'nav.contact' },
];

export default function ClientShell() {
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

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

  return (
    <>
      {mobileOpen && (
        <div className="border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-slate-900 md:hidden">
          <div className="space-y-1 px-4 py-3">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setMobileOpen(false)}
                className="block rounded-md px-3 py-2 text-base font-medium text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-slate-800"
              >{t(link.labelKey)}</a>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 md:hidden">
        <button onClick={() => setSearchOpen(true)} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-600 dark:text-neutral-300" aria-label="Search">
          <Search className="h-5 w-5" />
        </button>
        <ThemeToggle labelLight="Light" labelDark="Dark" />
        <button className="inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-600 dark:text-neutral-300" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      <div className="hidden md:flex items-center gap-2">
        <button onClick={() => setSearchOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-3 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:bg-slate-800 dark:text-neutral-400 dark:hover:bg-slate-700">
          <Search className="h-3.5 w-3.5" /><span>Search</span>
          <kbd className="ml-1 hidden rounded bg-neutral-200 px-1 py-0.5 text-[10px] font-medium text-neutral-500 dark:bg-slate-700 dark:text-neutral-400 lg:inline">Ctrl K</kbd>
        </button>
        <ThemeToggle labelLight="Light" labelDark="Dark" />
      </div>
      {showScrollTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg hover:scale-105 dark:bg-primary-700" aria-label="Back to top">
          <ChevronUp className="h-5 w-5" />
        </button>
      )}
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <CookieConsent />
    </>
  );
}
