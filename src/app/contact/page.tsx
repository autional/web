import { useState } from 'react';
;
import { Mail, Send, CheckCircle2, MessageSquare, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePageTitle, usePageMeta } from '@/lib/authms-shared';
import { extractApiError } from '@/lib/authms-shared';
import { statusSubscriptionsPost } from '@/lib/authms-shared';

export default function ContactPage() {
  const { t } = useTranslation();
  usePageTitle(t('contact.pageTitle'));
  usePageMeta(t('contact.pageDesc'));

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ name: '', email: '', company: '', phone: '', inquiry: 'technical', message: '' });

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = t('contact.validationName');
    if (!form.email.trim()) errs.email = t('contact.validationEmail');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = t('contact.validationEmailFormat');
    if (!form.message.trim()) errs.message = t('contact.validationMessage');
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors((prev) => { const next = { ...prev }; delete next[name]; return next; });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;

    setLoading(true);
    try {
      await statusSubscriptionsPost({
        email: form.email,
        name: form.name,
        message: `[${form.inquiry}] ${form.company ? `Company: ${form.company}. ` : ''}${form.phone ? `Phone: ${form.phone}. ` : ''}${form.message}`,
      } as any);
      setSubmitted(true);
      setFormErrors({});
    } catch (err: any) {
      setError(extractApiError(err, t('contact.errorTitle')).message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSubmitted(false);
    setError('');
    setFormErrors({});
    setForm({ name: '', email: '', company: '', phone: '', inquiry: 'technical', message: '' });
  };

  return (
    <div className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-5xl">{t('contact.title')}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-600 dark:text-neutral-300">
            {t('contact.subtitle')}
          </p>
        </div>

        <div className="mt-12 grid gap-12 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-1">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">{t('contact.infoTitle')}</h3>
              <div className="mt-4 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-900/20">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">{t('contact.community')}</p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400"></p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-900/20">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">{t('contact.support')}</p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">{t("contact.supportDesc")}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-slate-900">
              {submitted ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                    <CheckCircle2 className="h-8 w-8 text-success" />
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-neutral-900 dark:text-white">{t('contact.successTitle')}</h3>
                  <p className="mt-2 text-neutral-600 dark:text-neutral-300">{t('contact.successDesc')}</p>
                  <button onClick={resetForm} className="mt-6 rounded-md bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700">
                    {t('contact.successAgain')}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {error && (
                    <div className="flex items-start gap-3 rounded-md border border-danger/30 bg-danger/5 p-4">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-danger">{t('contact.errorTitle')}</p>
                        <p className="mt-1 text-sm text-danger/80">{error}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setError(''); handleSubmit({ preventDefault: () => {} } as any); }}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-danger hover:bg-danger/10 transition-colors"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        {t('contact.retry')}
                      </button>
                    </div>
                  )}
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">{t('contact.formName')} <span className="text-danger">*</span></label>
                      <input id="name" name="name" type="text" required value={form.name} onChange={handleChange} className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:bg-slate-800 dark:text-white dark:placeholder:text-neutral-500 ${formErrors.name ? 'border-danger' : 'border-neutral-300 dark:border-neutral-700'}`} placeholder={t('contact.placeholderName')} />
                      {formErrors.name && <p className="mt-1 text-xs text-danger">{formErrors.name}</p>}
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">{t('contact.formEmail')} <span className="text-danger">*</span></label>
                      <input id="email" name="email" type="email" required value={form.email} onChange={handleChange} className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:bg-slate-800 dark:text-white dark:placeholder:text-neutral-500 ${formErrors.email ? 'border-danger' : 'border-neutral-300 dark:border-neutral-700'}`} placeholder={t('contact.placeholderEmail')} />
                      {formErrors.email && <p className="mt-1 text-xs text-danger">{formErrors.email}</p>}
                    </div>
                  </div>
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <label htmlFor="company" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">{t('contact.formCompany')}</label>
                      <input id="company" name="company" type="text" value={form.company} onChange={handleChange} className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-neutral-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-neutral-500" placeholder={t('contact.placeholderCompany')} />
                    </div>
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">{t('contact.formPhone')}</label>
                      <input id="phone" name="phone" type="tel" value={form.phone} onChange={handleChange} className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-neutral-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-neutral-500" placeholder={t('contact.placeholderPhone')} />
                    </div>
                  </div>
                  <div className="grid gap-6 sm:grid-cols-2">
                    <select id="inquiry" name="inquiry" value={form.inquiry} onChange={handleChange} className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-neutral-700 dark:bg-slate-800 dark:text-white">
                      <option value="sales">{t('contact.inquirySales')}</option>
                      <option value="pricing">{t('contact.inquiryPricing')}</option>
                      <option value="technical">{t('contact.inquiryTechnical')}</option>
                      <option value="partnership">{t('contact.inquiryPartnership')}</option>
                      <option value="other">{t('contact.inquiryOther')}</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">{t('contact.formMessage')} <span className="text-danger">*</span></label>
                    <textarea id="message" name="message" rows={5} required value={form.message} onChange={handleChange} className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:bg-slate-800 dark:text-white dark:placeholder:text-neutral-500 ${formErrors.message ? 'border-danger' : 'border-neutral-300 dark:border-neutral-700'}`} placeholder={t('contact.placeholderMessage')} />
                    {formErrors.message && <p className="mt-1 text-xs text-danger">{formErrors.message}</p>}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('contact.consentText')} <a href="/privacy" className="text-primary-600 underline hover:text-primary-700">{t('contact.consentPrivacy')}</a> {t('contact.consentAnd')} <a href="/terms" className="text-primary-600 underline hover:text-primary-700">{t('contact.consentTerms')}</a>。</p>
                    <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed">
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t('contact.submitLoading')}
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          {t('contact.submitBtn')}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
