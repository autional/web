import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, FileText, Tag, ArrowRight } from 'lucide-react';
;
import { useTranslation } from 'react-i18next';

interface SearchItem {
  title: string;
  path: string;
  category: string;
  excerpt: string;
}

const searchPaths = [
  '/',
  '/features',
  '/docs',
  '/blog',
  '/contact',
  '/trust',
  '/about',
  '/privacy',
  '/terms',
  '/changelog',
  '/roadmap',
  '/faq',
  '/blog/passkey-2026',
  '/blog/multi-tenant-architecture',
  '/blog/gdpr-dsar-automation',
  '/pricing',
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchModal({ isOpen, onClose }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const searchIndex = useMemo<SearchItem[]>(
    () =>
      searchPaths.map((path, i) => ({
        path,
        title: t(`search.index.${i}.title`),
        category: t(`search.index.${i}.category`),
        excerpt: t(`search.index.${i}.excerpt`),
      })),
    [t]
  );

  const hotTags = useMemo<string[]>(() => {
    const tags = t('search.hotTags', { returnObjects: true });
    return Array.isArray(tags) ? tags : [];
  }, [t]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        isOpen ? onClose() : undefined;
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return searchIndex.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.excerpt.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [query, searchIndex]);

  if (!isOpen) return null;

  const blogCategoryLabel = t('search.category.blog');

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 pt-[15vh] backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-2xl overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
          <Search className="h-5 w-5 text-neutral-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search.placeholder')}
            className="flex-1 bg-transparent text-base text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:text-white"
          />
          <button
            onClick={onClose}
            className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {query.trim() && results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
              {t('search.noResults', { query })}
            </div>
          )}

          {results.map((item) => (
            <a
              key={item.path}
              to={item.path}
              onClick={onClose}
              className="group flex items-start gap-3 rounded-lg px-4 py-3 transition-colors hover:bg-neutral-50 dark:hover:bg-slate-800"
            >
              <div className="mt-0.5 shrink-0">
                {item.category === blogCategoryLabel ? (
                  <Tag className="h-4 w-4 text-neutral-400 group-hover:text-primary-500" />
                ) : (
                  <FileText className="h-4 w-4 text-neutral-400 group-hover:text-primary-500" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-neutral-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
                    {item.title}
                  </span>
                  <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500 dark:bg-slate-800 dark:text-neutral-400">
                    {item.category}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">{item.excerpt}</p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-neutral-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-neutral-600" />
            </a>
          ))}

          {!query.trim() && (
            <div className="px-4 py-6">
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{t('search.hotSearches')}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {hotTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setQuery(tag)}
                    className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600 transition-colors hover:bg-neutral-200 dark:bg-slate-800 dark:text-neutral-300 dark:hover:bg-slate-700"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-2 text-xs text-neutral-400 dark:border-neutral-700 dark:text-neutral-500">
          <span>{t('search.resultCount', { count: results.length })}</span>
          <span>{t('search.closeHint')}</span>
        </div>
      </div>
    </div>
  );
}
