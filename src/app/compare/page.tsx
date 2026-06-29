import { useTranslation } from 'react-i18next';
import { usePageTitle, usePageMeta } from '@/lib/authms-shared';
import { Check, X, Minus, ArrowRight } from 'lucide-react';
;

const protocols = [
  'OAuth 2.1 + PKCE',
  'SAML 2.0',
  'OpenID Connect',
  'WebAuthn/Passkey',
  'LDAP/AD',
];

type CellValue = string | boolean | null;

function Cell({ value, highlight }: { value: CellValue; highlight?: boolean }) {
  if (value === null || value === '-') {
    return <Minus className="mx-auto h-5 w-5 text-neutral-300 dark:text-neutral-600" />;
  }
  if (typeof value === 'boolean') {
    if (value === true) {
      return <Check className={`mx-auto h-5 w-5 ${highlight ? 'text-primary-600' : 'text-success'}`} />;
    }
    return <X className="mx-auto h-5 w-5 text-neutral-300 dark:text-neutral-600" />;
  }
  return (
    <span className={`text-xs ${highlight ? 'font-semibold text-primary-700 dark:text-primary-300' : 'text-neutral-600 dark:text-neutral-400'}`}>
      {value}
    </span>
  );
}

export default function ComparePage() {
  const { t } = useTranslation();

  usePageTitle(t('compare.pageTitle'));
  usePageMeta(t('compare.pageDesc'));

  const rows: { feature: string; values: CellValue[] }[] = [
    {
      feature: t('compare.f1'),
      values: ['RFC 6749, RFC 7636', 'OASIS Standard', 'OpenID Spec', 'W3C, FIDO2', 'RFC 4510'],
    },
    {
      feature: t('compare.f2'),
      values: ['Auth Code + PKCE', 'Redirect / POST', 'Auth Code / Hybrid', 'Challenge-Response', 'Bind / Simple'],
    },
    {
      feature: t('compare.f3'),
      values: ['JWT (Access + Refresh)', 'SAML Assertion (XML)', 'JWT (ID Token)', 'Credential ID', '-'],
    },
    {
      feature: t('compare.f4'),
      values: ['High', 'High', 'High', 'Very High', 'Medium'],
    },
    {
      feature: t('compare.f5'),
      values: [true, true, true, false, true],
    },
    {
      feature: t('compare.f6'),
      values: [true, false, true, true, false],
    },
    {
      feature: t('compare.f7'),
      values: [false, false, false, true, false],
    },
    {
      feature: t('compare.f8'),
      values: ['Medium', 'High', 'Medium', 'Low', 'Medium'],
    },
    {
      feature: t('compare.f9'),
      values: ['High', 'Medium', 'High', 'High', 'Low'],
    },
    {
      feature: t('compare.f10'),
      values: ['IETF OAuth WG', 'OASIS SSTC', 'OpenID Foundation', 'W3C / FIDO Alliance', 'IETF LDAPbis'],
    },
  ];

  return (
    <div className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-5xl">
            {t('compare.title')}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-600 dark:text-neutral-300">
            {t('compare.subtitle')}
          </p>
        </div>

        {/* Comparison Table */}
        <div className="mt-12 overflow-x-auto rounded-xl border border-neutral-200 shadow-sm dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-slate-900">
                <th className="sticky left-0 z-10 min-w-[240px] px-6 py-4 text-left font-semibold text-neutral-900 dark:bg-slate-900 dark:text-white">
                  {t('compare.colFeature')}
                </th>
                {protocols.map((name) => (
                  <th
                    key={name}
                    className="min-w-[140px] px-4 py-4 text-center font-semibold text-neutral-700 dark:text-neutral-300"
                  >
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ridx) => (
                <tr
                  key={row.feature}
                  className={`border-b border-neutral-100 transition-colors hover:bg-neutral-50 dark:border-neutral-800/50 dark:hover:bg-slate-800/50 ${
                    ridx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-neutral-50/50 dark:bg-slate-900/50'
                  }`}
                >
                  <td className="sticky left-0 z-10 px-6 py-3 font-medium text-neutral-900 dark:bg-slate-900 dark:text-white">
                    {row.feature}
                  </td>
                  {row.values.map((val, cidx) => (
                    <td key={cidx} className="px-4 py-3 text-center">
                      <Cell value={val} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-sm text-neutral-500 dark:text-neutral-400">
          <span className="flex items-center gap-1.5">
            <Check className="h-4 w-4 text-success" />
            {t('compare.supported')}
          </span>
          <span className="flex items-center gap-1.5">
            <X className="h-4 w-4 text-neutral-300 dark:text-neutral-600" />
            {t('compare.notSupported')}
          </span>
          <span className="flex items-center gap-1.5">
            <Minus className="h-4 w-4 text-neutral-300 dark:text-neutral-600" />
            {t('compare.notApplicable')}
          </span>
        </div>

        {/* Advantages */}
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">{t('compare.advantage1Title')}</h3>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              {t('compare.advantage1Desc')}
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">{t('compare.advantage2Title')}</h3>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              {t('compare.advantage2Desc')}
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">{t('compare.advantage3Title')}</h3>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              {t('compare.advantage3Desc')}
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <a
            to="/contact"
            className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-6 py-3 text-base font-medium text-white shadow-sm transition-colors hover:bg-primary-700"
          >
            {t('compare.ctaBtn')}
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
