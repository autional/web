import { useTranslation } from 'react-i18next';
import { usePageTitle, usePageMeta } from '@/lib/authms-shared';

export default function PrivacyPage() {
  const { t } = useTranslation();

  usePageTitle(t('privacy.pageTitle'));
  usePageMeta(t('privacy.pageDesc'));

  return (
    <div className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-4xl">
          {t('privacy.title')}
        </h1>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{t('privacy.lastUpdated')}</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          <section>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{t('privacy.section1Title')}</h2>
            <p className="mt-2">{t('privacy.section1Desc')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{t('privacy.section2Title')}</h2>
            <p className="mt-2">{t('privacy.section2Desc')}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>{t('privacy.section2Item1')}</li>
              <li>{t('privacy.section2Item2')}</li>
              <li>{t('privacy.section2Item3')}</li>
              <li>{t('privacy.section2Item4')}</li>
              <li>{t('privacy.section2Item5')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{t('privacy.section3Title')}</h2>
            <p className="mt-2">{t('privacy.section3Desc')}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>{t('privacy.section3Item1')}</li>
              <li>{t('privacy.section3Item2')}</li>
              <li>{t('privacy.section3Item3')}</li>
              <li>{t('privacy.section3Item4')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{t('privacy.section4Title')}</h2>
            <p className="mt-2">{t('privacy.section4Desc')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{t('privacy.section5Title')}</h2>
            <p className="mt-2">{t('privacy.section5Desc')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{t('privacy.section6Title')}</h2>
            <p className="mt-2">{t('privacy.section6Desc')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{t('privacy.section7Title')}</h2>
            <p className="mt-2">{t('privacy.section7Desc')}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
