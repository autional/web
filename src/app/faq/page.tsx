import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePageTitle, usePageMeta } from '@/lib/authms-shared';
;
import { ChevronDown, ChevronUp, HelpCircle, MessageCircle, ArrowRight } from 'lucide-react';

const categoryQuestionKeys: number[][] = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  [14, 15, 16],
];

export default function FaqPage() {
  const { t } = useTranslation();
  usePageTitle(t('faq.pageTitle'));
  usePageMeta(t('faq.pageDesc'));
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const toggle = (key: string) => {
    setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const categoryKeys = ['faq.categoryProduct', 'faq.categorySecurity', 'faq.categoryDeveloper', 'faq.categorySupport'];

  return (
    <div className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-5xl">{t('faq.title')}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-600 dark:text-neutral-300">
            {t('faq.subtitleIntro')} <a href="/contact" className="text-primary-600 hover:underline dark:text-primary-400">{t('faq.subtitleLink')}</a> {t('faq.subtitleEnd')}
          </p>
        </div>

        <div className="mt-12 space-y-10">
          {categoryQuestionKeys.map((qKeys, catIdx) => (
            <div key={catIdx}>
              <h2 className="flex items-center gap-2 text-xl font-bold text-neutral-900 dark:text-white">
                <HelpCircle className="h-5 w-5 text-primary-600" />
                {t(categoryKeys[catIdx])}
              </h2>
              <div className="mt-4 space-y-3">
                {qKeys.map((n) => {
                  const key = `${catIdx}-${n}`;
                  const isOpen = openItems[key];
                  return (
                    <div key={key} className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-slate-900">
                      <button onClick={() => toggle(key)} className="flex w-full items-center justify-between px-6 py-4 text-left">
                        <span className="font-medium text-neutral-900 dark:text-white">{t(`faq.questions.q${n}`)}</span>
                        {isOpen ? <ChevronUp className="h-5 w-5 text-neutral-400" /> : <ChevronDown className="h-5 w-5 text-neutral-400" />}
                      </button>
                      {isOpen && (
                        <div className="px-6 pb-4 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                          <div dangerouslySetInnerHTML={{ __html: t(`faq.questions.a${n}`) }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 rounded-2xl bg-primary-600 p-8 text-center">
          <MessageCircle className="mx-auto h-10 w-10 text-primary-100" />
          <h2 className="mt-4 text-xl font-bold text-white">{t('faq.ctaTitle')}</h2>
          <p className="mx-auto mt-2 max-w-lg text-primary-100">
            {t('faq.ctaDesc')}
          </p>
          <a href="/contact" className="mt-6 inline-flex items-center gap-2 rounded-md bg-white px-6 py-3 text-base font-medium text-primary-700 shadow-sm transition-colors hover:bg-primary-50">
            {t('faq.ctaBtn')} <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
