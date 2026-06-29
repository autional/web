import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePageTitle, usePageMeta, useSEO } from '@/lib/authms-shared';
;
import { ArrowRight, Code2, Package, Cpu, Blocks, Building2 } from 'lucide-react';
import { getAllCustomerCases, type CustomerCase } from '@/lib/content';

const highlights = [
  { icon: Code2, key: 'api', label: '544+ REST API' },
  { icon: Package, key: 'services', label: '21 微服务' },
  { icon: Cpu, key: 'tech', label: 'Go / React / Vite' },
  { icon: Blocks, key: 'oss', label: 'Apache 2.0 开源' },
];

export default function ShowcasePage() {
  const { t } = useTranslation();
  usePageTitle(t('showcase.pageTitle'));
  usePageMeta(t('showcase.pageDesc'));
  useSEO({ title: t('showcase.pageTitle'), description: t('showcase.pageDesc') }, { hreflang: true });
  const [customerCases, setCustomerCases] = useState<CustomerCase[]>([]);

  useEffect(() => {
    getAllCustomerCases().then(setCustomerCases);
  }, []);

  return (
    <div className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-5xl">
            {t('showcase.title')}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-600 dark:text-neutral-300">
            {t('showcase.subtitle')}
          </p>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-8 md:grid-cols-4">
          {highlights.map((h) => (
            <div key={h.key} className="rounded-xl border border-neutral-200 bg-white p-6 text-center shadow-sm dark:border-neutral-800 dark:bg-slate-900">
              <h.icon className="mx-auto h-8 w-8 text-primary-600" />
              <div className="mt-3 text-2xl font-bold text-neutral-900 dark:text-white">{h.label}</div>
              <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{t(`showcase.${h.key}`)}</div>
            </div>
          ))}
        </div>

        {customerCases.length > 0 && (
          <div className="mt-16">
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white text-center">{t('home.customersTitle')}</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {customerCases.map((c) => (
                <div key={c.slug} className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow dark:border-neutral-800 dark:bg-slate-900">
                  <div className="flex items-center gap-2 text-sm text-primary-600 font-medium">
                    <Building2 className="h-4 w-4" />
                    {c.company}
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-neutral-900 dark:text-white line-clamp-2">{c.title}</h3>
                  <div className="mt-2 flex items-center gap-2 text-xs text-neutral-400">
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 dark:bg-slate-800">{c.industry}</span>
                    <span>{c.contact}</span>
                  </div>
                  <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400 line-clamp-3">
                    {c.content.slice(0, 200).replace(/^#+\s+.*\n/g, '').trim()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-16 grid gap-8 lg:grid-cols-2">
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-slate-900">
            <h3 className="text-xl font-bold text-neutral-900 dark:text-white">{t('showcase.cap1Title')}</h3>
            <p className="mt-3 text-neutral-600 dark:text-neutral-300">{t('showcase.cap1Desc')}</p>
            <a href="/docs" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700">
              {t('showcase.cap1Link')} <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-slate-900">
            <h3 className="text-xl font-bold text-neutral-900 dark:text-white">{t('showcase.cap2Title')}</h3>
            <p className="mt-3 text-neutral-600 dark:text-neutral-300">{t('showcase.cap2Desc')}</p>
            <a href="/features" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700">
              {t('showcase.cap2Link')} <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">{t('showcase.ctaTitle')}</h2>
          <p className="mx-auto mt-2 max-w-xl text-neutral-600 dark:text-neutral-300">{t('showcase.ctaDesc')}</p>
          <a href="/contact" className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary-600 px-6 py-3 text-base font-medium text-white shadow-sm transition-colors hover:bg-primary-700">
            {t('showcase.ctaBtn')}
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
