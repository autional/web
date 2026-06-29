import { useTranslation } from 'react-i18next';
import { usePageTitle, usePageMeta } from '@/lib/authms-shared';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
;
import { Calendar, Tag, ArrowRight, Sparkles, Bug, Shield, Zap, BookOpen } from 'lucide-react';

interface ReleaseItemData {
  type: 'feature' | 'improvement' | 'bugfix' | 'security' | 'docs';
  key: string;
}

interface ReleaseData {
  version: string;
  dateKey: string;
  tagKeys: string[];
  items: ReleaseItemData[];
}

const releasesData: ReleaseData[] = [
  {
    version: 'v1.0.0',
    dateKey: 'changelog.releases.v1_0_0.date',
    tagKeys: ['changelog.tagMajor'],
    items: [
      { type: 'feature', key: 'changelog.releases.v1_0_0.items.0' },
      { type: 'feature', key: 'changelog.releases.v1_0_0.items.1' },
      { type: 'feature', key: 'changelog.releases.v1_0_0.items.2' },
      { type: 'feature', key: 'changelog.releases.v1_0_0.items.3' },
    ],
  },
  {
    version: 'v0.9.0-rc.5',
    dateKey: 'changelog.releases.v0_9_0_rc5.date',
    tagKeys: ['changelog.tagPrerelease'],
    items: [
      { type: 'feature', key: 'changelog.releases.v0_9_0_rc5.items.0' },
      { type: 'feature', key: 'changelog.releases.v0_9_0_rc5.items.1' },
      { type: 'improvement', key: 'changelog.releases.v0_9_0_rc5.items.2' },
      { type: 'bugfix', key: 'changelog.releases.v0_9_0_rc5.items.3' },
    ],
  },
  {
    version: 'v0.9.0-rc.4',
    dateKey: 'changelog.releases.v0_9_0_rc4.date',
    tagKeys: ['changelog.tagPrerelease'],
    items: [
      { type: 'feature', key: 'changelog.releases.v0_9_0_rc4.items.0' },
      { type: 'feature', key: 'changelog.releases.v0_9_0_rc4.items.1' },
      { type: 'improvement', key: 'changelog.releases.v0_9_0_rc4.items.2' },
      { type: 'bugfix', key: 'changelog.releases.v0_9_0_rc4.items.3' },
    ],
  },
  {
    version: 'v0.9.0-rc.3',
    dateKey: 'changelog.releases.v0_9_0_rc3.date',
    tagKeys: ['changelog.tagPrerelease'],
    items: [
      { type: 'improvement', key: 'changelog.releases.v0_9_0_rc3.items.0' },
      { type: 'security', key: 'changelog.releases.v0_9_0_rc3.items.1' },
    ],
  },
  {
    version: 'v0.9.0-rc.2',
    dateKey: 'changelog.releases.v0_9_0_rc2.date',
    tagKeys: ['changelog.tagPrerelease'],
    items: [
      { type: 'feature', key: 'changelog.releases.v0_9_0_rc2.items.0' },
      { type: 'improvement', key: 'changelog.releases.v0_9_0_rc2.items.1' },
      { type: 'bugfix', key: 'changelog.releases.v0_9_0_rc2.items.2' },
    ],
  },
  {
    version: 'v0.9.0-rc.1',
    dateKey: 'changelog.releases.v0_9_0_rc1.date',
    tagKeys: ['changelog.tagPrerelease'],
    items: [
      { type: 'feature', key: 'changelog.releases.v0_9_0_rc1.items.0' },
      { type: 'feature', key: 'changelog.releases.v0_9_0_rc1.items.1' },
      { type: 'improvement', key: 'changelog.releases.v0_9_0_rc1.items.2' },
    ],
  },
];

export default function ChangelogPage() {
  const { t } = useTranslation();

  usePageTitle(t('changelog.pageTitle'));
  usePageMeta(t('changelog.pageDesc'));

  const { ref, isVisible } = useScrollAnimation();

  const typeConfig = {
    feature: { icon: Sparkles, label: t('changelog.typeFeature'), color: 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300' },
    improvement: { icon: Zap, label: t('changelog.typeImprovement'), color: 'bg-warning/10 text-warning dark:bg-warning/20' },
    bugfix: { icon: Bug, label: t('changelog.typeBugfix'), color: 'bg-danger/10 text-danger dark:bg-danger/20' },
    security: { icon: Shield, label: t('changelog.typeSecurity'), color: 'bg-success/10 text-success dark:bg-success/20' },
    docs: { icon: BookOpen, label: t('changelog.typeDocs'), color: 'bg-neutral-100 text-neutral-700 dark:bg-slate-800 dark:text-neutral-300' },
  };

  const releases = releasesData.map((r) => ({
    version: r.version,
    date: t(r.dateKey),
    tags: r.tagKeys.map((k) => t(k)),
    items: r.items.map((item) => ({
      type: item.type,
      text: t(item.key),
    })),
  }));

  return (
    <div className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-5xl">{t('changelog.title')}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-600 dark:text-neutral-300">
            {t('changelog.subtitle')}
          </p>
        </div>

        <div className="mt-12 space-y-12" ref={ref}>
          {releases.map((release, idx) => (
            <div
              key={release.version}
              className={`relative transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
              style={{ animationDelay: `${idx * 0.1}s` }}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="sm:w-40 shrink-0">
                  <div className="text-lg font-bold text-primary-600">{release.version}</div>
                  <div className="mt-1 flex items-center gap-1 text-sm text-neutral-500 dark:text-neutral-400">
                    <Calendar className="h-3.5 w-3.5" />
                    {release.date}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {release.tags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/20 dark:text-primary-300">
                        <Tag className="h-3 w-3" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex-1 space-y-3">
                  {release.items.map((item, iidx) => {
                    const cfg = typeConfig[item.type as keyof typeof typeConfig] || typeConfig.docs;
                    return (
                      <div
                        key={iidx}
                        className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-slate-900"
                      >
                        <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${cfg.color}`}>
                          <cfg.icon className="h-3.5 w-3.5" />
                        </span>
                        <div>
                          <span className={`text-xs font-medium ${cfg.color.split(' ')[1]}`}>{cfg.label}</span>
                          <p className="mt-0.5 text-sm text-neutral-700 dark:text-neutral-300">{item.text}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {idx < releases.length - 1 && (
                <div className="mt-12 border-b border-neutral-200 dark:border-neutral-800" />
              )}
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-neutral-600 dark:text-neutral-300">
            {t('changelog.footerText')}{' '}
            <a href="/roadmap" className="inline-flex items-center gap-1 font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400">
              {t('changelog.footerLink')} <ArrowRight className="h-4 w-4" />
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
