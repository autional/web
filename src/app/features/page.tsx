import { useTranslation } from 'react-i18next';
// NHI (Non-Human Identity) section planned — Agent & Device identity management features
import { usePageTitle, usePageMeta, useSEO } from '@/lib/authms-shared';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import {
  KeyRound, Shield, Users, ClipboardCheck, Code2, Server, Lock, Fingerprint, Clock, Bell, FileText, Cpu, CreditCard, Globe,
} from 'lucide-react';

const capabilityDefs = [
  { icon: KeyRound, key: 'sso', highlights: ['', '', '', ''] },
  { icon: Shield, key: 'mfa', highlights: ['', '', '', ''] },
  { icon: Fingerprint, key: 'passkey', highlights: ['', '', '', ''] },
  { icon: Users, key: 'tenant', highlights: ['', '', '', ''] },
  { icon: ClipboardCheck, key: 'audit', highlights: ['', '', '', ''] },
  { icon: Lock, key: 'session', highlights: ['', '', '', ''] },
  { icon: Code2, key: 'developer', highlights: ['', '', '', ''] },
  { icon: CreditCard, key: 'billing', highlights: ['', '', '', ''] },
  { icon: Bell, key: 'notification', highlights: ['', '', '', ''] },
  { icon: FileText, key: 'storage', highlights: ['', '', '', ''] },
  { icon: Globe, key: 'wallet', highlights: ['', '', '', ''] },
  { icon: Cpu, key: 'ha', highlights: ['', '', '', ''] },
];

export default function FeaturesPage() {
  const { t } = useTranslation();
  usePageTitle(t('features.pageTitle'));
  usePageMeta(t('features.pageDesc'));
  useSEO({ title: t('features.pageTitle'), description: t('features.pageDesc') }, { hreflang: true });

  return (
    <div className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-5xl">{t('features.title')}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-600 dark:text-neutral-300">
            {t('features.subtitle')}
          </p>
        </div>

        <div className="mt-16 space-y-16">
          {capabilityDefs.map((cap, idx) => {
            const { ref, isVisible } = useScrollAnimation();
            return (
              <div
                key={cap.key}
                ref={ref}
                className={`grid items-start gap-8 lg:grid-cols-2 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              >
                <div className={idx % 2 === 1 ? 'lg:order-2' : ''}>
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-900/20">
                    <cap.icon className="h-6 w-6" />
                  </div>
                  <h2 className="mt-4 text-2xl font-bold text-neutral-900 dark:text-white">{t(`features.${cap.key}Title`)}</h2>
                  <p className="mt-1 text-sm font-medium text-primary-600">{t(`features.${cap.key}Subtitle`)}</p>
                  <p className="mt-4 text-neutral-600 leading-relaxed dark:text-neutral-300">{t(`features.${cap.key}Desc`)}</p>
                  <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {cap.highlights.map((_, idx) => (
                      <li key={`${cap.key}-${idx}`} className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary-500" />
                        {t(`features.${cap.key}.highlights.${idx}`)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={`flex items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50 p-10 dark:border-neutral-800 dark:bg-slate-800 ${idx % 2 === 1 ? 'lg:order-1' : ''}`}>
                  <div className="text-center">
                    <cap.icon className="mx-auto h-16 w-16 text-neutral-300 dark:text-neutral-600" />
                    <p className="mt-4 text-sm text-neutral-400 dark:text-neutral-500">{t('features.placeholder')}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
