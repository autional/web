;
import { BookOpen, Code, FileCode, Rocket, ArrowRight, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePageTitle, usePageMeta, useSEO } from '@/lib/authms-shared';
import { DEVELOPER_PORTAL_URL } from '@/lib/authms-shared';

const docCategoryDefs = [
  {
    icon: Rocket,
    titleKey: 'docs.quickStart',
    descKey: 'docs.quickStartDesc',
    links: [
      { labelKey: 'docs.linkReact', href: DEVELOPER_PORTAL_URL },
      { labelKey: 'docs.linkGo', href: DEVELOPER_PORTAL_URL },
    ],
  },
  {
    icon: Code,
    titleKey: 'docs.apiRef',
    descKey: 'docs.apiRefDesc',
    links: [
      { labelKey: 'docs.linkAuth', href: 'https://wiki.iam.tianv.com/api/identity-service/' },
      { labelKey: 'docs.linkMFA', href: 'https://wiki.iam.tianv.com/api/mfa-service/' },
    ],
  },
  {
    icon: FileCode,
    titleKey: 'docs.sdks',
    descKey: 'docs.sdksDesc',
    links: [
      { labelKey: 'docs.linkReact', href: DEVELOPER_PORTAL_URL },
      { labelKey: 'docs.linkGo', href: DEVELOPER_PORTAL_URL },
    ],
  },
  {
    icon: BookOpen,
    titleKey: 'docs.concepts',
    descKey: 'docs.conceptsDesc',
    links: [
      { labelKey: 'docs.linkQuickStart', href: DEVELOPER_PORTAL_URL },
      { labelKey: 'docs.linkSwagger', href: DEVELOPER_PORTAL_URL },
    ],
  },
];

export default function DocsPage() {
  const { t } = useTranslation();
  usePageTitle(t('docs.pageTitle'));
  usePageMeta(t('docs.pageDesc'));
  useSEO({ title: t('docs.pageTitle'), description: t('docs.pageDesc') }, { hreflang: true });

  return (
    <div className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-5xl">{t('docs.title')}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-600 dark:text-neutral-300">
            {t('docs.subtitle')}
          </p>
          <div className="mt-8">
            <a href={DEVELOPER_PORTAL_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-6 py-3 text-base font-medium text-white shadow-sm transition-colors hover:bg-primary-700">
              {t('docs.enterPortal')}
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {docCategoryDefs.map((cat) => (
            <div key={cat.titleKey} className="flex flex-col rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-slate-900">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-900/20">
                <cat.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-neutral-900 dark:text-white">{t(cat.titleKey)}</h3>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{t(cat.descKey)}</p>
              <ul className="mt-4 flex-1 space-y-2">
                {cat.links.map((link) => (
                  <li key={link.labelKey}>
                    <a href={link.href} target="_blank" rel="noreferrer" className="group flex items-center text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400">
                      {t(link.labelKey)}
                      <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-neutral-200 bg-neutral-50 p-8 text-center dark:border-neutral-800 dark:bg-slate-800/50">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">{t('docs.swaggerTitle')}</h2>
          <p className="mx-auto mt-2 max-w-xl text-neutral-600 dark:text-neutral-300">
            {t('docs.swaggerDesc')}
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a href="https://wiki.iam.tianv.com/api/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700">
              {t('docs.apiRefBtn')}
              <ExternalLink className="h-4 w-4" />
            </a>
            <a href={`${DEVELOPER_PORTAL_URL}/api-docs`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-5 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-slate-800 dark:text-neutral-200 dark:hover:bg-slate-700">
              {t('docs.scalarBtn')}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
