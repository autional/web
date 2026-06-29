import { useTranslation } from 'react-i18next';
import { usePageTitle, usePageMeta, useSEO } from '@/lib/authms-shared';
import { Shield, Target, Heart, Zap } from 'lucide-react';

const icons = [Shield, Target, Heart, Zap];

export default function AboutPage() {
  const { t } = useTranslation();

  usePageTitle(t('about.pageTitle'));
  usePageMeta(t('about.pageDesc'));
  useSEO({ title: t('about.pageTitle'), description: t('about.pageDesc') }, { hreflang: true });

  const milestones = [
    { year: t('about.milestone1Year'), title: t('about.milestone1Title'), desc: t('about.milestone1Desc') },
    { year: t('about.milestone2Year'), title: t('about.milestone2Title'), desc: t('about.milestone2Desc') },
    { year: t('about.milestone3Year'), title: t('about.milestone3Title'), desc: t('about.milestone3Desc') },
    { year: t('about.milestone4Year'), title: t('about.milestone4Title'), desc: t('about.milestone4Desc') },
  ];

  const values = [
    { icon: icons[0], title: t('about.value1Title'), desc: t('about.value1Desc') },
    { icon: icons[1], title: t('about.value2Title'), desc: t('about.value2Desc') },
    { icon: icons[2], title: t('about.value3Title'), desc: t('about.value3Desc') },
    { icon: icons[3], title: t('about.value4Title'), desc: t('about.value4Desc') },
  ];

  const team = [
    { name: t('about.team1Name'), role: t('about.team1Role'), bio: t('about.team1Bio') },
    { name: t('about.team2Name'), role: t('about.team2Role'), bio: t('about.team2Bio') },
    { name: t('about.team3Name'), role: t('about.team3Role'), bio: t('about.team3Bio') },
    { name: t('about.team4Name'), role: t('about.team4Role'), bio: t('about.team4Bio') },
  ];

  return (
    <div className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Hero */}
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-5xl">
            {t('about.title')}
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-lg text-neutral-600 dark:text-neutral-300">
            {t('about.heroDesc')}
          </p>
        </div>

        {/* Mission */}
        <div className="mt-12 rounded-2xl border border-neutral-200 bg-primary-50 p-8 text-center dark:border-neutral-800 dark:bg-primary-900/10 sm:p-12">
          <h2 className="text-2xl font-bold text-primary-800 dark:text-primary-200">{t('about.missionTitle')}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-primary-700 dark:text-primary-300">
            {t('about.missionDesc')}
          </p>
        </div>

        {/* Values */}
        <div className="mt-16">
          <h2 className="text-center text-2xl font-bold text-neutral-900 dark:text-white">{t('about.valuesTitle')}</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((v) => (
              <div key={v.title} className="rounded-xl border border-neutral-200 bg-white p-6 text-center dark:border-neutral-800 dark:bg-slate-900">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/20">
                  <v.icon className="h-6 w-6 text-primary-600" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-neutral-900 dark:text-white">{v.title}</h3>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Milestones */}
        <div className="mt-16">
          <h2 className="text-center text-2xl font-bold text-neutral-900 dark:text-white">{t('about.milestonesTitle')}</h2>
          <div className="relative mx-auto mt-10 max-w-3xl">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-neutral-200 dark:bg-neutral-800 sm:left-1/2 sm:-ml-px" />
            <div className="space-y-8">
              {milestones.map((m, idx) => (
                <div key={m.year} className={`relative flex items-start sm:items-center ${idx % 2 === 0 ? 'sm:flex-row' : 'sm:flex-row-reverse'}`}>
                  <div className="hidden w-1/2 sm:block" />
                  <div className="absolute left-4 z-10 flex h-8 w-8 items-center justify-center rounded-full border-4 border-white bg-primary-600 dark:border-slate-900 sm:left-1/2 sm:-ml-4">
                    <span className="text-xs font-bold text-white">{m.year.slice(-2)}</span>
                  </div>
                  <div className="ml-12 w-full sm:ml-0 sm:w-1/2 sm:px-8">
                    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-slate-900">
                      <span className="text-xs font-bold text-primary-600">{m.year}</span>
                      <h3 className="mt-1 text-base font-semibold text-neutral-900 dark:text-white">{m.title}</h3>
                      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{m.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
