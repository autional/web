'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  QrCode,
  RefreshCw,
  ScanLine,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  AUTH_MODE,
  adoptDirectTokens,
  authApi,
  qrApprovalUrl,
  type QrSession,
  type SessionInfo,
} from '../../lib/ai-auth';
import { InstallGuide } from './InstallGuide';

type QrState =
  | 'idle'
  | 'loading'
  | 'pending'
  | 'scanned'
  | 'success'
  | 'expired'
  | 'cancelled'
  | 'superseded'
  | 'no-token'
  | 'error';

interface Props {
  onSuccess: (session: SessionInfo) => void;
  onSwitchToEmail?: () => void;
}

/**
 * 扫码登录面板。
 *
 * 用户故事：
 * - 桌面用户：手机在手边 → 扫码，2 秒登录，不记密码。
 * - 首次用户：不知道认证器 → 二维码下方给安装引导与邮箱码兜底。
 * - 手机用户：自己扫自己没有意义 → 直接引导到邮箱验证码。
 *
 * 安全不变量（与站内 auth 门户一致）：
 * - 二维码只含一次性 session token + 6 位数字，不含密码/长期令牌；
 * - 扫码只进入 scanned，必须手机端确认；
 * - 令牌只交付一次；`confirmed` 无令牌是终态，不能继续轮询；
 * - 取消时撤销会话；页面离开交给 5 分钟 TTL。
 */
export function QrPanel({ onSuccess, onSwitchToEmail }: Props) {
  const { t } = useTranslation();
  const [state, setState] = useState<QrState>('idle');
  const [qrSrc, setQrSrc] = useState('');
  const [session, setSession] = useState<QrSession | null>(null);
  const [seconds, setSeconds] = useState(300);
  const [error, setError] = useState('');
  const [network, setNetwork] = useState(false);
  const [mobile, setMobile] = useState(false);

  const pollRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const failuresRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (countdownRef.current !== null) {
      window.clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    setMobile(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => {
      mq.removeEventListener?.('change', onChange);
      stopPolling();
    };
  }, [stopPolling]);

  const finish = useCallback(
    (result: SessionInfo) => {
      stopPolling();
      setState('success');
      onSuccess(result);
    },
    [onSuccess, stopPolling],
  );

  const pollOnce = useCallback(
    async (s: QrSession) => {
      try {
        const r = await authApi.status(s.sessionToken);
        failuresRef.current = 0;
        setNetwork(false);

        if (r.status === 'scanned') {
          setState('scanned');
          return;
        }
        if (r.status === 'expired') {
          stopPolling();
          setState('expired');
          return;
        }
        if (r.status === 'cancelled') {
          stopPolling();
          setState(r.superseded ? 'superseded' : 'cancelled');
          return;
        }
        if (r.status !== 'confirmed') return;

        if (r.user) {
          finish({ user: r.user });
          return;
        }
        if (r.accessToken) {
          const user = adoptDirectTokens({
            accessToken: r.accessToken,
            refreshToken: r.refreshToken,
            expiresIn: r.expiresIn,
          });
          finish({ user });
          return;
        }
        if (AUTH_MODE === 'bff') {
          // BFF 在 confirmed 时写好会话 Cookie。极短让位后重读一次，避免竞态。
          const first = await authApi.getSession();
          if (first) {
            finish(first);
            return;
          }
          await new Promise((resolve) => window.setTimeout(resolve, 250));
          const second = await authApi.getSession();
          if (second) {
            finish(second);
            return;
          }
        }
        // 令牌一次性交付：confirmed 但没有凭据 = 终态，不能继续等。
        stopPolling();
        setState('no-token');
      } catch {
        failuresRef.current += 1;
        if (failuresRef.current >= 3) setNetwork(true);
      }
    },
    [finish, stopPolling],
  );

  const begin = useCallback(async () => {
    stopPolling();
    setState('loading');
    setError('');
    setNetwork(false);
    setQrSrc('');
    setSession(null);
    failuresRef.current = 0;
    try {
      const s = await authApi.initiate();
      if (!s.sessionToken) throw new Error('missing session token');
      const QRCode = (await import('qrcode')).default;
      const dataUrl = await QRCode.toDataURL(qrApprovalUrl(s), {
        width: 260,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#0b1220', light: '#ffffff' },
      });
      setSession(s);
      setQrSrc(dataUrl);
      setSeconds(s.expiresIn || 300);
      setState('pending');

      pollRef.current = window.setInterval(() => {
        void pollOnce(s);
      }, 2000);
      countdownRef.current = window.setInterval(() => {
        setSeconds((v) => {
          if (v <= 1) {
            stopPolling();
            setState((cur) => (cur === 'pending' || cur === 'scanned' ? 'expired' : cur));
            return 0;
          }
          return v - 1;
        });
      }, 1000);
    } catch {
      setState('error');
      setError(t('aiLogin.errorGeneric'));
    }
  }, [pollOnce, stopPolling, t]);

  const cancel = useCallback(() => {
    if (session) void authApi.revoke(session.sessionToken).catch(() => {});
    stopPolling();
    setSession(null);
    setQrSrc('');
    setSeconds(300);
    setState('idle');
    setError('');
    setNetwork(false);
  }, [session, stopPolling]);

  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const retry = state === 'expired' || state === 'cancelled' || state === 'superseded' || state === 'no-token' || state === 'error';

  if (mobile) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4">
          <p className="flex items-start gap-2 text-sm font-medium text-warning-text">
            <ScanLine className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {t('aiLogin.qrMobileHint')}
          </p>
          {onSwitchToEmail && (
            <button
              type="button"
              onClick={onSwitchToEmail}
              className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-white/70 px-4 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
            >
              {t('aiLogin.qrMobileSwitch')}
            </button>
          )}
        </div>
        <InstallGuide />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {state === 'idle' && (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-200">
            <QrCode className="h-7 w-7" aria-hidden="true" />
          </div>
          <p className="text-sm leading-6 text-neutral-600 dark:text-neutral-300">
            {t('aiLogin.qrInstruction')}
          </p>
          <button
            type="button"
            onClick={() => void begin()}
            className="brand-button-primary w-full justify-center"
          >
            {t('aiLogin.qrGet')}
          </button>
        </div>
      )}

      {state === 'loading' && (
        <div className="flex flex-col items-center gap-3 py-10 text-sm text-neutral-500 dark:text-neutral-400" role="status">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600 dark:text-primary-300" aria-hidden="true" />
          {t('aiLogin.qrLoading')}
        </div>
      )}

      {(state === 'pending' || state === 'scanned') && qrSrc && (
        <>
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-center shadow-sm dark:border-white/10">
            <img
              src={qrSrc}
              alt={t('aiLogin.qrAlt')}
              width={260}
              height={260}
              className="mx-auto h-[200px] w-[200px] rounded-xl sm:h-[210px] sm:w-[210px]"
            />
            <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
              {t('aiLogin.qrCountdown', { time })}
            </p>
          </div>

          {session?.numberMatching && (
            <div
              className="rounded-2xl border border-primary-200 bg-primary-50/70 p-3 text-center dark:border-primary-500/25 dark:bg-primary-500/10"
              aria-label={t('aiLogin.qrMatch')}
            >
              <p className="text-[11px] font-medium uppercase tracking-wider text-primary-700/75 dark:text-primary-200/75">
                {t('aiLogin.qrMatch')}
              </p>
              <p className="mt-1 font-mono text-3xl font-bold tracking-[0.35em] text-primary-800 dark:text-primary-100">
                {session.numberMatching}
              </p>
            </div>
          )}

          {state === 'scanned' && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-xl border border-success/30 bg-success/10 p-3 text-sm text-success-text"
            >
              <p className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                {t('aiLogin.qrScanned')}
              </p>
              <p className="mt-1 text-xs">{t('aiLogin.qrScannedHint')}</p>
            </div>
          )}

          <p className="text-center text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            {t('aiLogin.qrSteps')}
          </p>

          <button
            type="button"
            onClick={cancel}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 dark:border-white/10 dark:text-neutral-200 dark:hover:bg-white/5"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            {t('aiLogin.qrCancel')}
          </button>

          {network && (
            <p className="flex items-center gap-2 text-xs text-warning-text" role="status" aria-live="polite">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
              {t('aiLogin.qrNetwork')}
            </p>
          )}

          <InstallGuide />
        </>
      )}

      {state === 'success' && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-success/30 bg-success/10 p-6 text-center text-success-text"
        >
          <CheckCircle2 className="mx-auto h-8 w-8" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold">{t('aiLogin.qrSuccess')}</p>
        </div>
      )}

      {retry && (
        <div className="space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-center dark:border-white/10 dark:bg-white/5">
          <p className="text-sm font-medium text-neutral-900 dark:text-white">
            {state === 'expired' && t('aiLogin.qrExpired')}
            {state === 'cancelled' && t('aiLogin.qrCancelled')}
            {state === 'superseded' && t('aiLogin.qrSuperseded')}
            {state === 'no-token' && t('aiLogin.qrNoToken')}
            {state === 'error' && (error || t('aiLogin.errorGeneric'))}
          </p>
          {state === 'superseded' && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('aiLogin.qrSupersededHint')}</p>
          )}
          {state === 'no-token' && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('aiLogin.qrNoTokenHint')}</p>
          )}
          <button
            type="button"
            onClick={() => void begin()}
            className="brand-button-primary w-full justify-center"
          >
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            {t('aiLogin.qrRetry')}
          </button>
        </div>
      )}
    </div>
  );
}
