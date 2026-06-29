import { useState } from 'react';
;
import { Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePageTitle, usePageMeta, useSEO } from '@/lib/authms-shared';
import { AUTH_PAGES_URL } from '@/lib/authms-shared';

const planFeatureKeys: { key: string; included: boolean }[][] = [
  [
    { key: 'freeFeature1', included: true },
    { key: 'freeFeature2', included: true },
    { key: 'freeFeature3', included: true },
    { key: 'freeFeature4', included: true },
    { key: 'freeFeature5', included: true },
    { key: 'freeFeature6', included: false },
    { key: 'freeFeature7', included: false },
    { key: 'freeFeature8', included: false },
    { key: 'freeFeature9', included: false },
  ],
  [
    { key: 'proFeature1', included: true },
    { key: 'proFeature2', included: true },
    { key: 'proFeature3', included: true },
    { key: 'proFeature4', included: true },
    { key: 'proFeature5', included: true },
    { key: 'proFeature6', included: true },
    { key: 'proFeature7', included: true },
    { key: 'proFeature8', included: true },
    { key: 'proFeature9', included: false },
  ],
  [
    { key: 'enterpriseFeature1', included: true },
    { key: 'enterpriseFeature2', included: true },
    { key: 'enterpriseFeature3', included: true },
    { key: 'enterpriseFeature4', included: true },
    { key: 'enterpriseFeature5', included: true },
    { key: 'enterpriseFeature6', included: true },
    { key: 'enterpriseFeature7', included: true },
    { key: 'enterpriseFeature8', included: true },
    { key: 'enterpriseFeature9', included: true },
  ],
];

const faqKeys = [1, 2, 3, 4, 5, 6] as const;

export default function PricingPage() {
  const { t } = useTranslation();
  usePageTitle(t('pricing.pageTitle'));
  usePageMeta(t('pricing.pageDesc'));
  useSEO({ title: t('pricing.pageTitle'), description: t('pricing.pageDesc') }, { hreflang: true });
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const plans = [
    {
      nameKey: 'freeName', price: t('pricing.freePrice'), period: t('pricing.freePeriod'),
      descKey: 'freeDesc', features: planFeatureKeys[0], ctaKey: 'freeCta', ctaPrimary: false, href: `${AUTH_PAGES_URL}/register`,
    },
    {
      nameKey: 'proName', price: t('pricing.proPrice'), period: t('pricing.proPeriod'),
      descKey: 'proDesc', features: planFeatureKeys[1], ctaKey: 'proCta', ctaPrimary: true, href: `${AUTH_PAGES_URL}/register`, badgeKey: 'proBadge',
    },
    {
      nameKey: 'enterpriseName', price: t('pricing.enterprisePrice'), period: t('pricing.enterprisePeriod'),
      descKey: 'enterpriseDesc', features: planFeatureKeys[2], ctaKey: 'enterpriseCta', ctaPrimary: false, href: '/contact',
    },
  ];

  return (
    <div className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-5xl">{t('pricing.title')}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-600 dark:text-neutral-300">
            {t('pricing.subtitle')}
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.nameKey} className={`relative flex flex-col rounded-2xl border bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-slate-900 ${plan.ctaPrimary ? 'border-primary-200 ring-1 ring-primary-200 dark:border-primary-700 dark:ring-primary-700' : 'border-neutral-200'}`}>
              {plan.badgeKey && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary-600 px-3 py-1 text-xs font-semibold text-white">{t(`pricing.${plan.badgeKey}`)}</span>
              )}
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">{t(`pricing.${plan.nameKey}`)}</h3>
              <div className="mt-4 flex items-baseline">
                <span className="text-4xl font-bold tracking-tight text-neutral-900 dark:text-white">{plan.price}</span>
                <span className="ml-1 text-sm text-neutral-500 dark:text-neutral-400">{plan.period}</span>
              </div>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{t(`pricing.${plan.descKey}`)}</p>
              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f.key} className="flex items-start gap-3 text-sm">
                    {f.included ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <X className="mt-0.5 h-4 w-4 shrink-0 text-neutral-300 dark:text-neutral-600" />}
                    <span className={f.included ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-400 dark:text-neutral-500'}>{t(`pricing.${f.key}`)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                {plan.href.startsWith('http') ? (
                  <a href={plan.href} className={`block w-full rounded-md px-4 py-2.5 text-center text-sm font-medium transition-colors ${plan.ctaPrimary ? 'bg-primary-600 text-white hover:bg-primary-700' : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-slate-800 dark:text-neutral-200 dark:hover:bg-slate-700'}`}>{t(`pricing.${plan.ctaKey}`)}</a>
                ) : (
                  <a href={plan.href} className={`block w-full rounded-md px-4 py-2.5 text-center text-sm font-medium transition-colors ${plan.ctaPrimary ? 'bg-primary-600 text-white hover:bg-primary-700' : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-slate-800 dark:text-neutral-200 dark:hover:bg-slate-700'}`}>{t(`pricing.${plan.ctaKey}`)}</a>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-20 max-w-3xl">
          <h2 className="text-center text-2xl font-bold text-neutral-900 dark:text-white">{t('pricing.faqTitle')}</h2>
          <div className="mt-8 space-y-4">
            {faqKeys.map((n) => (
              <div key={n} className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-slate-900">
                <button onClick={() => setOpenFaq(openFaq === n ? null : n)} className="flex w-full items-center justify-between px-6 py-4 text-left">
                  <span className="font-medium text-neutral-900 dark:text-white">{t(`pricing.faqQ${n}`)}</span>
                  {openFaq === n ? <ChevronUp className="h-5 w-5 text-neutral-400" /> : <ChevronDown className="h-5 w-5 text-neutral-400" />}
                </button>
                {openFaq === n && <div className="px-6 pb-4 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">{t(`pricing.faqA${n}`)}</div>}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 text-center">
          <p className="text-neutral-600 dark:text-neutral-300">{t('pricing.faqMore')} <a href="/contact" className="font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400">{t('pricing.faqContact')}</a></p>
        </div>
      </div>
    </div>
  );
}
