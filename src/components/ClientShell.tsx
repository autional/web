import { useState, useEffect } from 'react';
import { Menu, X, Search, ChevronUp } from 'lucide-react';
import '../i18n';
import { useTranslation } from 'react-i18next';
import { ThemeToggle } from '../components/ThemeToggle';
import SearchModal from '../components/SearchModal';

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
        <div className="brand-shell absolute left-3 right-3 top-[calc(100%+0.5rem)] border-primary-100/90 md:hidden">
          <div className="space-y-1 px-4 py-4">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setMobileOpen(false)}
                className="block rounded-2xl px-3 py-2.5 text-base font-medium text-neutral-700 transition-colors hover:bg-sky-50 hover:text-primary-700 dark:text-neutral-300 dark:hover:bg-white/10"
              >{t(link.labelKey)}</a>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 md:hidden">
        <button onClick={() => setSearchOpen(true)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary-100 bg-white/90 text-primary-700 shadow-soft transition hover:bg-sky-50 dark:border-white/10 dark:bg-white/5 dark:text-sky-100 dark:hover:bg-white/10" aria-label="Search">
          <Search className="h-5 w-5" />
        </button>
        <ThemeToggle labelLight="Light" labelDark="Dark" />
        <button className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary-100 bg-white/90 text-primary-700 shadow-soft transition hover:bg-sky-50 dark:border-white/10 dark:bg-white/5 dark:text-sky-100 dark:hover:bg-white/10" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      <div className="hidden md:flex items-center gap-2">
        <button onClick={() => setSearchOpen(true)} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-primary-100 bg-white/90 px-4 text-xs font-semibold uppercase tracking-[0.16em] text-primary-700 shadow-soft transition hover:-translate-y-0.5 hover:bg-sky-50 dark:border-white/10 dark:bg-white/5 dark:text-sky-100 dark:hover:bg-white/10">
          <Search className="h-3.5 w-3.5" /><span>Search</span>
          <kbd className="ml-1 hidden rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-semibold tracking-normal text-primary-500 dark:bg-white/10 dark:text-sky-100 lg:inline">Ctrl K</kbd>
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
    </>
  );
}
