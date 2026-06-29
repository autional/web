;
import {
  ArrowRight,
  Shield,
  KeyRound,
  Users,
  ClipboardCheck,
  Code2,
  Server,
  CheckCircle2,
  Zap,
  Lock,
  Globe,
  BarChart3,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { useSEO } from '@/lib/authms-shared';
import { getOrganizationSchema, getProductSchema } from '@/lib/jsonld';

const featureKeys = ['sso', 'mfa', 'tenant', 'audit', 'dev', 'ha'] as const;
const featureIcons = [KeyRound, Shield, Users, ClipboardCheck, Code2, Server];

const statKeys = [
  { key: { value: 'home.stats.servicesValue', label: 'home.stats.services' } },
  { key: { value: 'home.stats.apiEndpointsValue', label: 'home.stats.apiEndpoints' } },
  { key: { value: 'home.stats.licenseValue', label: 'home.stats.license' } },
  { key: { value: 'home.stats.avgResponseValue', label: 'home.stats.avgResponse' } },
];

const securityItemKeys = ['home.securityItem1', 'home.securityItem2', 'home.securityItem3', 'home.securityItem4'];

export default function HomePage() {
  const { t } = useTranslation();
  useSEO({
    title: t('home.heroTitle1'),
    description: t('home.heroDesc'),
    jsonld: [getOrganizationSchema(), getProductSchema()],
  }, { hreflang: true });
  const { ref: featRef, isVisible: featVisible } = useScrollAnimation();
  const { ref: capRef, isVisible: capVisible } = useScrollAnimation();

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary-50 to-white px-4 py-20 dark:from-slate-900 dark:to-slate-900 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-sm font-medium text-primary-700 animate-fade-in dark:border-primary-800 dark:bg-primary-900/20 dark:text-primary-300">
            <Zap className="mr-1 h-4 w-4" />
            {t('home.badge')}
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-neutral-900 animate-slide-up dark:text-white sm:text-5xl lg:text-6xl">
            {t('home.heroTitle1')}
            <br className="hidden sm:block" />
            <span className="text-primary-600">{t('home.heroTitle2')}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-600 animate-slide-up dark:text-neutral-300" style={{ animationDelay: '0.1s' }}>
            {t('home.heroDesc')}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <a href="/docs" className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-6 py-3 text-base font-medium text-white shadow-sm transition-colors hover:bg-primary-700">
              {t('home.ctaStart')}
              <ArrowRight className="h-5 w-5" />
            </a>
            <a href="/features" className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-6 py-3 text-base font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-slate-800 dark:text-neutral-200 dark:hover:bg-slate-700">
              {t('home.ctaLearn')}
            </a>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-neutral-200 bg-white dark:border-neutral-800 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {statKeys.map((stat) => (
              <div key={stat.key.label} className="text-center">
                <div className="text-3xl font-bold text-primary-600">{t(stat.key.value)}</div>
                <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{t(stat.key.label)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-4 py-20 sm:px-6 lg:px-8" ref={featRef}>
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-4xl">{t('home.featuresTitle')}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-600 dark:text-neutral-300">
              {t('home.featuresSubtitle')}
            </p>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {featureKeys.map((fKey, idx) => {
              const Icon = featureIcons[idx];
              return (
                <div
                  key={fKey}
                  className={`group rounded-xl border border-neutral-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-primary-200 dark:border-neutral-800 dark:bg-slate-900 dark:hover:border-primary-700 ${
                    featVisible ? 'animate-in' : 'opacity-0'
                  }`}
                  style={{ animationDelay: `${idx * 0.1}s` }}
                >
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-900/20">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-neutral-900 dark:text-white">{t(`home.feature${fKey.charAt(0).toUpperCase()}${fKey.slice(1)}Title`)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{t(`home.feature${fKey.charAt(0).toUpperCase()}${fKey.slice(1)}Desc`)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Capabilities Detail */}
      <section className="bg-neutral-50 px-4 py-20 dark:bg-slate-800/50 sm:px-6 lg:px-8" ref={capRef}>
        <div className="mx-auto max-w-7xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-4xl">{t('home.securityTitle')}</h2>
              <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-300">
                {t('home.securityDesc')}
              </p>
              <ul className="mt-8 space-y-4">
                {securityItemKeys.map((key) => (
                  <li key={key} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                    <span className="text-neutral-700 dark:text-neutral-300">{t(key)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-white p-8 shadow-sm border border-neutral-200 dark:border-neutral-800 dark:bg-slate-900">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/20">
                    <Lock className="h-6 w-6 text-primary-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-neutral-900 dark:text-white">{t('home.securityZeroTitle')}</div>
                    <div className="text-sm text-neutral-500 dark:text-neutral-400">{t('home.securityZeroDesc')}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                    <Globe className="h-6 w-6 text-success" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-neutral-900 dark:text-white">{t('home.securityGlobalTitle')}</div>
                    <div className="text-sm text-neutral-500 dark:text-neutral-400">{t('home.securityGlobalDesc')}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
                    <BarChart3 className="h-6 w-6 text-warning" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-neutral-900 dark:text-white">{t('home.securityInsightTitle')}</div>
                    <div className="text-sm text-neutral-500 dark:text-neutral-400">{t('home.securityInsightDesc')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Metrics Bar */}
      <section className="border-y border-neutral-200 bg-white px-4 py-12 dark:border-neutral-800 dark:bg-slate-900 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-center text-sm font-medium text-neutral-400 dark:text-neutral-500 mb-6">
            {t('home.customersTitle')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
            <div className="flex items-center gap-3 rounded-md px-4 py-2">
              <span className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">Go {t('home.stats.servicesValue')} {t('home.stats.services')}</span>
            </div>
            <div className="flex items-center gap-3 rounded-md px-4 py-2">
              <span className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">{t('home.stats.apiEndpointsValue')} {t('home.stats.apiEndpoints')}</span>
            </div>
            <div className="flex items-center gap-3 rounded-md px-4 py-2">
              <span className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">{t('home.stats.licenseValue')} {t('home.stats.license')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl rounded-2xl bg-primary-600 px-6 py-16 text-center sm:px-12">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{t('home.ctaTitle')}</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-primary-100">
            {t('home.ctaDesc')}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a href="/contact" className="inline-flex items-center gap-2 rounded-md bg-white px-6 py-3 text-base font-medium text-primary-700 shadow-sm transition-colors hover:bg-primary-50">
              {t('home.ctaContact')}
            </a>
            <a href="/pricing" className="inline-flex items-center gap-2 rounded-md border border-primary-400 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-primary-700">
              {t('home.ctaPricing')}
            </a>
            <a href="/docs" className="inline-flex items-center gap-2 rounded-md border border-primary-400 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-primary-700">
              {t('home.ctaDocs')}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
