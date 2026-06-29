import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePageTitle, usePageMeta } from '@/lib/authms-shared';
import { TRUST_CENTER_URL } from '@/lib/authms-shared';
import {
  Shield,
  Lock,
  FileCheck,
  Globe,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

export default function TrustPage() {
  const { t } = useTranslation();

  usePageTitle(t('trust.pageTitle'));
  usePageMeta(t('trust.pageDesc'));

  const certifications = [
    { icon: FileCheck, name: t('trust.cert1Name'), status: t('trust.cert1Status') },
    { icon: Shield, name: t('trust.cert2Name'), status: t('trust.cert2Status') },
    { icon: Lock, name: t('trust.cert3Name'), status: t('trust.cert3Status') },
    { icon: Globe, name: t('trust.cert4Name'), status: t('trust.cert4Status') },
  ];

  const highlights = [
    { title: t('trust.highlight1Title'), desc: t('trust.highlight1Desc') },
    { title: t('trust.highlight2Title'), desc: t('trust.highlight2Desc') },
    { title: t('trust.highlight3Title'), desc: t('trust.highlight3Desc') },
    { title: t('trust.highlight4Title'), desc: t('trust.highlight4Desc') },
  ];

  // Canonical link to Trust Center
  useEffect(() => {
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const previous = link?.href;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = TRUST_CENTER_URL;
    return () => {
      if (link && previous !== undefined) {
        link.href = previous;
      }
    };
  }, []);

  return (
    <div className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-sm font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
            <Shield className="h-4 w-4" />
            Trust Center
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-5xl">
            {t('trust.title')}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-600 dark:text-neutral-300">
            {t('trust.subtitle')}
          </p>
        </div>

        {/* Certifications */}
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {certifications.map((cert) => (
            <div
              key={cert.name}
              className="rounded-xl border border-neutral-200 bg-white p-6 text-center shadow-sm dark:border-neutral-800 dark:bg-slate-900"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/20">
                <cert.icon className="h-6 w-6 text-primary-600" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-neutral-900 dark:text-white">{cert.name}</h3>
              <span className="mt-1 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                {cert.status}
              </span>
            </div>
          ))}
        </div>

        {/* Highlights + CTA */}
        <div className="mt-16 rounded-2xl border border-neutral-200 bg-neutral-50 p-8 dark:border-neutral-800 dark:bg-slate-900/50">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">{t('trust.exploreTitle')}</h2>
            <p className="mt-2 text-neutral-600 dark:text-neutral-300">
              {t('trust.exploreDesc')}
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {highlights.map((item) => (
                <div key={item.title} className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-slate-900">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">{item.title}</span>
                </div>
              ))}
            </div>
            <a
              href={TRUST_CENTER_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-flex items-center gap-2 rounded-md bg-primary-600 px-6 py-3 text-base font-medium text-white shadow-sm transition-colors hover:bg-primary-700"
            >
              {t('trust.exploreBtn')}
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Report Request */}
        <div className="mt-12 text-center">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">{t('trust.reportTitle')}</h2>
          <p className="mx-auto mt-2 max-w-xl text-neutral-600 dark:text-neutral-300">
            {t('trust.reportDesc')}
          </p>
          <a
            href="#"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary-600 px-6 py-3 text-base font-medium text-white shadow-sm transition-colors hover:bg-primary-700"
          >
            {t('trust.reportBtn')}
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
