import { useTranslation } from 'react-i18next';
import { usePageTitle, usePageMeta } from '@/lib/authms-shared';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
;
import { CheckCircle2, Circle, Clock, ArrowRight, Target, FlaskConical, Rocket } from 'lucide-react';

export default function RoadmapPage() {
  const { t } = useTranslation();

  usePageTitle(t('roadmap.pageTitle'));
  usePageMeta(t('roadmap.pageDesc'));

  const { ref, isVisible } = useScrollAnimation();

  const phases = [
    {
      status: 'completed',
      title: t('roadmap.phaseComplete'),
      icon: CheckCircle2,
      color: 'bg-success/10 text-success border-success/20',
      items: [
        t('roadmap.phases.completed.items.0'),
        t('roadmap.phases.completed.items.1'),
        t('roadmap.phases.completed.items.2'),
        t('roadmap.phases.completed.items.3'),
        t('roadmap.phases.completed.items.4'),
        t('roadmap.phases.completed.items.5'),
        t('roadmap.phases.completed.items.6'),
        t('roadmap.phases.completed.items.7'),
      ],
    },
    {
      status: 'in_progress',
      title: t('roadmap.phaseInProgress'),
      icon: Clock,
      color: 'bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-900/10 dark:text-primary-300 dark:border-primary-800',
      items: [
        t('roadmap.phases.inProgress.items.0'),
        t('roadmap.phases.inProgress.items.1'),
        t('roadmap.phases.inProgress.items.2'),
        t('roadmap.phases.inProgress.items.3'),
        t('roadmap.phases.inProgress.items.4'),
        t('roadmap.phases.inProgress.items.5'),
        t('roadmap.phases.inProgress.items.6'),
      ],
    },
    {
      status: 'planned',
      title: t('roadmap.phasePlanned'),
      icon: Circle,
      color: 'bg-neutral-50 text-neutral-600 border-neutral-200 dark:bg-slate-800 dark:text-neutral-400 dark:border-neutral-700',
      items: [
        t('roadmap.phases.planned.items.0'),
        t('roadmap.phases.planned.items.1'),
        t('roadmap.phases.planned.items.2'),
        t('roadmap.phases.planned.items.3'),
        t('roadmap.phases.planned.items.4'),
        t('roadmap.phases.planned.items.5'),
        t('roadmap.phases.planned.items.6'),
      ],
    },
    {
      status: 'research',
      title: t('roadmap.phaseExploring'),
      icon: FlaskConical,
      color: 'bg-warning/10 text-warning border-warning/20 dark:bg-warning/20',
      items: [
        t('roadmap.phases.exploring.items.0'),
        t('roadmap.phases.exploring.items.1'),
        t('roadmap.phases.exploring.items.2'),
        t('roadmap.phases.exploring.items.3'),
        t('roadmap.phases.exploring.items.4'),
      ],
    },
  ];

  const quarters = [
    { q: '2025 Q3', milestone: t('roadmap.quarters.q1_2025'), completed: true },
    { q: '2025 Q4', milestone: t('roadmap.quarters.q2_2025'), completed: true },
    { q: '2026 Q1', milestone: t('roadmap.quarters.q1_2026'), completed: false },
    { q: '2026 Q2', milestone: t('roadmap.quarters.q2_2026'), completed: false },
    { q: '2026 Q3', milestone: t('roadmap.quarters.q3_2026'), completed: false },
    { q: '2026 Q4', milestone: t('roadmap.quarters.q4_2026'), completed: false },
  ];

  return (
    <div className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-5xl">{t('roadmap.title')}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-600 dark:text-neutral-300">
            {t('roadmap.subtitle')}
          </p>
        </div>

        {/* Timeline */}
        <div className="mt-12 overflow-x-auto">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-2">
            {quarters.map((q, idx) => (
              <div key={q.q} className="flex flex-1 flex-col items-center">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${q.completed ? 'border-success bg-success/10 text-success' : 'border-neutral-300 bg-white text-neutral-400 dark:border-neutral-600 dark:bg-slate-900'}`}>
                  {q.completed ? <CheckCircle2 className="h-5 w-5" /> : <Target className="h-5 w-5" />}
                </div>
                <div className="mt-2 text-center">
                  <div className={`text-xs font-semibold ${q.completed ? 'text-success' : 'text-neutral-500 dark:text-neutral-400'}`}>{q.q}</div>
                  <div className="mt-0.5 text-[10px] text-neutral-400 dark:text-neutral-500">{q.milestone}</div>
                </div>
                {idx < quarters.length - 1 && (
                  <div className={`absolute hidden h-0.5 w-full lg:block ${q.completed ? 'bg-success' : 'bg-neutral-200 dark:bg-neutral-700'}`} style={{ top: '1.25rem', left: '50%', width: '100%' }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Phase Cards */}
        <div className="mt-16 grid gap-8 md:grid-cols-2" ref={ref}>
          {phases.map((phase, idx) => (
            <div
              key={phase.status}
              className={`rounded-2xl border bg-white p-6 shadow-sm transition-all duration-700 dark:bg-slate-900 ${phase.color.split(' ')[3] || 'border-neutral-200 dark:border-neutral-800'} ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
              style={{ animationDelay: `${idx * 0.15}s` }}
            >
              <div className="flex items-center gap-3">
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${phase.color.split(' ').slice(0, 2).join(' ')}`}>
                  <phase.icon className="h-5 w-5" />
                </div>
                <h2 className={`text-lg font-bold ${phase.color.split(' ')[1]}`}>{phase.title}</h2>
              </div>
              <ul className="mt-4 space-y-2.5">
                {phase.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                    {phase.status === 'completed' ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 shrink-0 text-neutral-300 dark:text-neutral-600" />
                    )}
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-2xl border border-neutral-200 bg-neutral-50 p-8 text-center dark:border-neutral-800 dark:bg-slate-800/50">
          <Rocket className="mx-auto h-10 w-10 text-primary-600" />
          <h2 className="mt-4 text-xl font-bold text-neutral-900 dark:text-white">{t('roadmap.ctaTitle')}</h2>
          <p className="mx-auto mt-2 max-w-lg text-neutral-600 dark:text-neutral-300">
            {t('roadmap.ctaDesc')}
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="/contact" className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700">
              {t('roadmap.ctaBtn')} <ArrowRight className="h-4 w-4" />
            </a>
            <a href="mailto:support@autional.com" className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-5 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-slate-800 dark:text-neutral-200 dark:hover:bg-slate-700">
              support@autional.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
