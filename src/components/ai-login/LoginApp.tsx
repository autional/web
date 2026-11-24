'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  LogOut,
  Mail,
  QrCode,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
// 副作用导入：确保 i18next 实例在本 island hydrate 前完成初始化（否则首渲取不到实例 → React #418）。
import '../../i18n';
import {
  AI_TENANT_ID,
  IS_DIRECT_PREVIEW,
  IS_EMBEDDED,
  IS_OAUTH,
  authApi,
  fetchAuthConfig,
  oauthLoginUrl,
  portalLoginUrl,
  portalRegisterUrl,
  type AuthConfig,
  type SessionInfo,
} from '../../lib/ai-auth';
import { EmailCodeForm } from './EmailCodeForm';
import { QrPanel } from './QrPanel';

type Method = 'qr' | 'email';

/**
 * Autional AI 登录页。
 *
 * 设计目标（用户故事）：
 * - 桌面用户：扫码 2 秒登录，不记密码。
 * - 手机用户：邮箱验证码登录，不装 App。
 * - 首次用户：二维码旁给安装引导；邮箱码兜底。
 * - 租户只开密码时：不展示死路，给管理员指引与 Autional 登录出口。
 *
 * 安全：生产走 BFF（浏览器不持有身份令牌）；direct 仅本地预览。
 */
export default function LoginApp() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [booting, setBooting] = useState(true);
  const [configError, setConfigError] = useState(false);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [method, setMethod] = useState<Method>('qr');
  const [next, setNext] = useState('/ai/');
  const [logoutBusy, setLogoutBusy] = useState(false);

  const load = useCallback(async () => {
    setConfigError(false);
    setBooting(true);
    const current = await authApi.getSession().catch(() => null);
    setSession(current);
    if (IS_OAUTH) {
      // 生产 OAuth 模式不需要租户登录方式探测：平台登录页自行提供扫码/邮箱/通行密钥。
      setBooting(false);
      return;
    }
    try {
      setConfig(await fetchAuthConfig());
    } catch {
      setConfigError(true);
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('next');
    if (raw && /^\/(?!\/)/.test(raw) && !raw.startsWith('/ai/login')) setNext(raw);
  }, []);

  useEffect(() => {
    if (!config) return;
    const qr = config.methods.includes('qr');
    const email = config.methods.includes('email_code');
    if (!qr && email) setMethod('email');
    else if (qr && !email) setMethod('qr');
    else if (qr && email && window.matchMedia('(max-width: 639px)').matches) setMethod('email');
  }, [config]);

  const [oauthError, setOauthError] = useState('');
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('error');
    if (code) setOauthError(code);
  }, []);

  const OAUTH_ERROR_KEYS: Record<string, string> = {
    access_denied: 'aiLogin.oauthErrorAccessDenied',
    login_failed: 'aiLogin.oauthErrorLoginFailed',
    state_invalid: 'aiLogin.oauthErrorStateInvalid',
    state_expired: 'aiLogin.oauthErrorStateExpired',
    email_required: 'aiLogin.oauthErrorEmailRequired',
    consent_revoked: 'aiLogin.oauthErrorConsentRevoked',
    login_unavailable: 'aiLogin.oauthErrorLoginUnavailable',
  };
  const oauthErrorText = oauthError
    ? t(OAUTH_ERROR_KEYS[oauthError] ?? 'aiLogin.oauthErrorGeneric')
    : '';

  const qrEnabled = config?.methods.includes('qr') ?? false;
  const emailEnabled = config?.methods.includes('email_code') ?? false;
  const onlyPassword = !!config && !qrEnabled && !emailEnabled;
  // 避免首帧 method 默认 qr 但租户只开邮箱时闪错表单。
  const activeMethod: Method = qrEnabled && (method === 'qr' || !emailEnabled) ? 'qr' : 'email';
  const loginUrl = portalLoginUrl(config?.tenantSlug);
  const registerUrl = portalRegisterUrl(config?.tenantSlug);

  const onSuccess = useCallback((result: SessionInfo) => {
    setSession(result);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const logout = useCallback(async () => {
    setLogoutBusy(true);
    try {
      await authApi.logout();
      setSession(null);
    } finally {
      setLogoutBusy(false);
    }
  }, []);

  const benefits = [
    { icon: ShieldCheck, title: t('aiLogin.benefit1Title'), desc: t('aiLogin.benefit1Desc') },
    { icon: QrCode, title: t('aiLogin.benefit2Title'), desc: t('aiLogin.benefit2Desc') },
    { icon: Mail, title: t('aiLogin.benefit3Title'), desc: t('aiLogin.benefit3Desc') },
    { icon: Sparkles, title: t('aiLogin.benefit4Title'), desc: t('aiLogin.benefit4Desc') },
  ];

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <div className="mx-auto max-w-3xl text-center">
        <p className="brand-kicker">{t('aiLogin.kicker')}</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl lg:text-[2.75rem] dark:text-white">
          {t('aiLogin.title')}
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-neutral-500 sm:text-lg dark:text-neutral-400">
          {t('aiLogin.lead')}
        </p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-start lg:gap-12">
        <div className="order-2 space-y-3 lg:order-1">
          {benefits.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="brand-card flex items-start gap-4 p-4 sm:p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-200">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-neutral-500 dark:text-neutral-400">{item.desc}</p>
                </div>
              </div>
            );
          })}

          <p className="flex items-center gap-2 pt-2 text-xs text-neutral-500 dark:text-neutral-400">
            <ShieldCheck className="h-4 w-4 text-success-text" aria-hidden="true" />
            {t('aiLogin.passwordNever')}
          </p>
        </div>

        <div className="order-1 lg:order-2">
          <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-xl shadow-primary-900/5 sm:p-7 dark:border-white/10 dark:bg-surface">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-900 text-sm font-extrabold text-white">
                A
              </span>
              <div>
                <p className="text-sm font-semibold text-neutral-900 dark:text-white">{t('aiLogin.cardTitle')}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('aiLogin.cardSubtitle')}</p>
              </div>
            </div>

            {IS_DIRECT_PREVIEW && (
              <p className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs leading-5 text-warning-text">
                {t('aiLogin.directWarning')}
              </p>
            )}

            {IS_DIRECT_PREVIEW && !AI_TENANT_ID && (
              <p className="mt-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs leading-5 text-warning-text">
                {t('aiLogin.tenantConfigPreview')}
              </p>
            )}

            <div className="mt-5 min-h-[300px]">
              {booting && (
                <div className="flex flex-col items-center gap-3 py-16 text-sm text-neutral-500 dark:text-neutral-400" role="status">
                  <Loader2 className="h-6 w-6 animate-spin text-primary-600 dark:text-primary-300" aria-hidden="true" />
                  {t('aiLogin.configLoading')}
                </div>
              )}

              {!booting && configError && (
                <div className="space-y-4 text-center">
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">{t('aiLogin.configError')}</p>
                  <button type="button" onClick={() => void load()} className="brand-button-primary w-full justify-center">
                    {t('aiLogin.configRetry')}
                  </button>
                  <a href={loginUrl} className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:underline dark:text-primary-300">
                    {t('aiLogin.portalLogin')}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                </div>
              )}

              {!booting && !configError && session && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-success/30 bg-success/10 p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold text-success-text">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      {t('aiLogin.sessionTitle')}
                    </p>
                    <p className="mt-1 break-all text-sm text-neutral-700 dark:text-neutral-200">
                      {session.user.email || session.user.id}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{t('aiLogin.sessionDesc')}</p>
                  </div>
                  <a href={next} className="brand-button-primary w-full justify-center">
                    {t('aiLogin.sessionEnter')}
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </a>
                  <button
                    type="button"
                    onClick={() => void logout()}
                    disabled={logoutBusy}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60 dark:border-white/10 dark:text-neutral-200 dark:hover:bg-white/5"
                  >
                    {logoutBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                    )}
                    {logoutBusy ? t('aiLogin.sessionLogoutBusy') : t('aiLogin.sessionLogout')}
                  </button>
                </div>
              )}

              {!booting && IS_OAUTH && !session && (
                <div className="space-y-4">
                  {oauthErrorText && (
                    <p
                      role="alert"
                      className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm leading-6 text-warning-text"
                    >
                      {oauthErrorText}
                    </p>
                  )}
                  <p className="text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                    {t('aiLogin.oauthLead')}
                  </p>
                  <a href={oauthLoginUrl(next)} className="brand-button-primary w-full justify-center">
                    {t('aiLogin.oauthButton')}
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </a>
                  <p className="text-center text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                    {t('aiLogin.oauthHint')}
                  </p>
                  <p className="text-center text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                    {t('aiLogin.oauthRegisterHint')}
                  </p>
                </div>
              )}

              {!booting && !configError && !session && !IS_OAUTH && onlyPassword && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4">
                    <p className="text-sm font-semibold text-warning-text">{t('aiLogin.tenantMissing')}</p>
                    <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                      {t('aiLogin.tenantMissingDesc')}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                      {t('aiLogin.tenantMissingAdmin')}
                    </p>
                  </div>
                  <a href={loginUrl} className="brand-button-primary w-full justify-center">
                    {t('aiLogin.portalLogin')}
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </a>
                  <a href={registerUrl} className="block text-center text-sm font-semibold text-primary-700 hover:underline dark:text-primary-300">
                    {t('aiLogin.portalRegister')}
                  </a>
                </div>
              )}

              {!booting && !configError && !session && !IS_OAUTH && !onlyPassword && (
                <div className="space-y-4">
                  {qrEnabled && emailEnabled ? (
                    <div
                      role="tablist"
                      aria-label={t('aiLogin.cardSubtitle')}
                      className="grid grid-cols-2 gap-1 rounded-2xl bg-neutral-100 p-1 dark:bg-white/5"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={activeMethod === 'qr'}
                        onClick={() => setMethod('qr')}
                        className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                          activeMethod === 'qr'
                            ? 'bg-white text-neutral-900 shadow-sm dark:bg-white/10 dark:text-white'
                            : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
                        }`}
                      >
                        <QrCode className="h-4 w-4" aria-hidden="true" />
                        {t('aiLogin.methodQr')}
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={activeMethod === 'email'}
                        onClick={() => setMethod('email')}
                        className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                          activeMethod === 'email'
                            ? 'bg-white text-neutral-900 shadow-sm dark:bg-white/10 dark:text-white'
                            : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
                        }`}
                      >
                        <Mail className="h-4 w-4" aria-hidden="true" />
                        {t('aiLogin.methodEmail')}
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                      {qrEnabled ? t('aiLogin.methodQr') : t('aiLogin.methodEmail')}
                    </p>
                  )}

                  {activeMethod === 'qr' && qrEnabled ? (
                    <QrPanel onSuccess={onSuccess} onSwitchToEmail={emailEnabled ? () => setMethod('email') : undefined} />
                  ) : (
                    <EmailCodeForm onSuccess={onSuccess} registerUrl={registerUrl} />
                  )}

                  {IS_EMBEDDED && (
                    <p className="text-center text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                      {t('aiLogin.embedConsent')}
                    </p>
                  )}
                </div>
              )}
            </div>

            {!session && (
              <div className="mt-5 border-t border-neutral-200 pt-4 dark:border-white/10">
                {!IS_OAUTH && !IS_EMBEDDED && (
                  <>
                    <a
                      href={loginUrl}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:underline dark:text-primary-300"
                    >
                      {t('aiLogin.methodOther')}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </a>
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{t('aiLogin.otherWaysHint')}</p>
                  </>
                )}
                <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                  {t('aiLogin.termsPrefix')}{' '}
                  <a href="/terms" className="underline hover:text-neutral-800 dark:hover:text-neutral-200">
                    {t('aiLogin.terms')}
                  </a>{' '}
                  {t('aiLogin.and')}{' '}
                  <a href="/privacy" className="underline hover:text-neutral-800 dark:hover:text-neutral-200">
                    {t('aiLogin.privacy')}
                  </a>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
