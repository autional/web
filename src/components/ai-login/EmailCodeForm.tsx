'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Loader2, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  AiAuthError,
  authApi,
  isNotRegistered,
  type SessionInfo,
} from '../../lib/ai-auth';

interface Props {
  onSuccess: (session: SessionInfo) => void;
  registerUrl?: string;
}

/**
 * 邮箱验证码登录。
 *
 * 用户故事：
 * - 手机用户 / 没装认证器的用户：不装 App、不记密码，收一封 6 位验证码即可登录。
 * - 首次用户：未注册时给出“去注册”的明确出口，不把他困在错误里。
 *
 * 6 位是平台默认（NIST SP 800-63B 下限）；3 位熵太低，不做。
 */
export function EmailCodeForm({ onSuccess, registerUrl }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notRegistered, setNotRegistered] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const codeRef = useRef<HTMLInputElement>(null);
  const submittedRef = useRef(false);
  const submittingRef = useRef(false);
  const sendingRef = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => setCooldown((v) => Math.max(0, v - 1)), 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (code.length < 6) submittedRef.current = false;
  }, [code]);

  const describe = useCallback(
    (err: unknown): string => {
      if (err instanceof AiAuthError) {
        if (err.status === 429) return t('aiLogin.errorRateLimit');
        if (err.code === 'network') return t('aiLogin.errorNetwork');
        if (err.code === 'tenant_mismatch') return t('aiLogin.errorTenantMismatch');
        if (/disabled/i.test(err.message)) return t('aiLogin.errorMethodDisabled');
        if (isNotRegistered(err)) return t('aiLogin.emailNotRegistered');
      }
      return t('aiLogin.errorGeneric');
    },
    [t],
  );

  const send = useCallback(async () => {
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError(t('aiLogin.emailInvalid'));
      return;
    }
    if (busy || sendingRef.current) return;
    sendingRef.current = true;
    setBusy(true);
    setError('');
    setNotRegistered(false);
    try {
      await authApi.sendEmailCode(value);
      setEmail(value);
      setStep('code');
      setCode('');
      setCooldown(60);
    } catch (err) {
      setError(describe(err));
      setNotRegistered(isNotRegistered(err));
    } finally {
      sendingRef.current = false;
      setBusy(false);
    }
  }, [busy, describe, email, t]);

  const login = useCallback(async () => {
    const value = code.replace(/\D/g, '');
    if (value.length !== 6) {
      setError(t('aiLogin.emailCodeInvalid'));
      return;
    }
    if (busy || submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    setError('');
    setNotRegistered(false);
    try {
      const result = await authApi.loginEmailCode(email, value);
      const session = result.user ? { user: result.user } : await authApi.getSession();
      if (!session) throw new AiAuthError('session missing', 'no_session');
      onSuccess(session);
    } catch (err) {
      setError(describe(err));
      setNotRegistered(isNotRegistered(err));
      setCode('');
      submittedRef.current = false;
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }, [busy, code, describe, email, onSuccess, t]);

  // 输满 6 位自动提交；失败后允许重输。
  useEffect(() => {
    if (step !== 'code' || code.length !== 6 || busy || submittedRef.current) return;
    submittedRef.current = true;
    const timer = window.setTimeout(() => void login(), 120);
    return () => window.clearTimeout(timer);
  }, [busy, code, login, step]);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (step === 'email') void send();
        else void login();
      }}
    >
      {step === 'email' ? (
        <>
          <div className="space-y-1.5">
            <label htmlFor="ai-login-email" className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
              {t('aiLogin.emailLabel')}
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
              <input
                id="ai-login-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={t('aiLogin.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
                className="w-full rounded-xl border border-neutral-200 bg-white py-3 pl-10 pr-4 text-base text-neutral-900 placeholder:text-neutral-400 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-neutral-500"
              />
            </div>
          </div>
          <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">{t('aiLogin.emailDesc')}</p>
          <button type="submit" disabled={busy} className="brand-button-primary w-full justify-center disabled:opacity-60">
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                {t('aiLogin.emailSending')}
              </>
            ) : (
              t('aiLogin.emailSend')
            )}
          </button>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-sm text-neutral-600 dark:text-neutral-300">{email}</p>
            <button
              type="button"
              onClick={() => {
                setStep('email');
                setCode('');
                setError('');
                setNotRegistered(false);
              }}
              className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary-700 hover:underline dark:text-primary-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              {t('aiLogin.emailBack')}
            </button>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ai-login-code" className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
              {t('aiLogin.emailCodeLabel')}
            </label>
            <input
              id="ai-login-code"
              ref={codeRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              placeholder={t('aiLogin.emailCodePlaceholder')}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={busy}
              className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-center font-mono text-2xl font-semibold tracking-[0.35em] text-neutral-900 placeholder:text-neutral-300 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-neutral-600"
            />
          </div>

          <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">{t('aiLogin.emailHint')}</p>

          <button type="submit" disabled={busy} className="brand-button-primary w-full justify-center disabled:opacity-60">
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                {t('aiLogin.emailLoggingIn')}
              </>
            ) : (
              t('aiLogin.emailLogin')
            )}
          </button>

          <button
            type="button"
            onClick={() => void send()}
            disabled={busy || cooldown > 0}
            className="w-full text-center text-xs font-semibold text-primary-700 hover:underline disabled:text-neutral-400 disabled:no-underline dark:text-primary-300 dark:disabled:text-neutral-500"
          >
            {cooldown > 0 ? t('aiLogin.emailResend', { s: cooldown }) : t('aiLogin.emailSend')}
          </button>
        </>
      )}

      {error && (
        <div role="alert" aria-live="polite" className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger-text">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p>{error}</p>
            {notRegistered && registerUrl && (
              <a href={registerUrl} className="mt-1 inline-block font-semibold underline">
                {t('aiLogin.emailNotRegisteredAction')}
              </a>
            )}
          </div>
        </div>
      )}
    </form>
  );
}
