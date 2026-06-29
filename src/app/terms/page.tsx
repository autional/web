import { useTranslation } from 'react-i18next';
import { usePageTitle, usePageMeta } from '@/lib/authms-shared';

export default function TermsPage() {
  const { t } = useTranslation();

  usePageTitle(t('terms.pageTitle'));
  usePageMeta(t('terms.pageDesc'));

  return (
    <div className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-4xl">
          {t('terms.title')}
        </h1>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{t('terms.lastUpdated')}</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          <section>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{t('terms.section1Title')}</h2>
            <p className="mt-2">{t('terms.section1Desc')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{t('terms.section2Title')}</h2>
            <p className="mt-2">{t('terms.section2Desc')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{t('terms.section3Title')}</h2>
            <p className="mt-2">{t('terms.section3Desc')}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>{t('terms.section3Item1')}</li>
              <li>{t('terms.section3Item2')}</li>
              <li>{t('terms.section3Item3')}</li>
              <li>{t('terms.section3Item4')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{t('terms.section4Title')}</h2>
            <p className="mt-2">{t('terms.section4Desc')}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>{t('terms.section4Item1')}</li>
              <li>{t('terms.section4Item2')}</li>
              <li>{t('terms.section4Item3')}</li>
              <li>{t('terms.section4Item4')}</li>
              <li>{t('terms.section4Item5')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{t('terms.section5Title')}</h2>
            <p className="mt-2">{t('terms.section5Desc')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{t('terms.section6Title')}</h2>
            <p className="mt-2">{t('terms.section6Desc')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{t('terms.section7Title')}</h2>
            <p className="mt-2">{t('terms.section7Desc')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{t('terms.section8Title')}</h2>
            <p className="mt-2">{t('terms.section8Desc')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{t('terms.section9Title')}</h2>
            <p className="mt-2">{t('terms.section9Desc')}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
