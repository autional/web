'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Smartphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AUTHENTICATOR_URL } from '../../lib/ai-auth';

type Platform = 'ios' | 'android' | 'desktop';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/i.test(ua)) return 'ios';
  if (/Macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

/**
 * 认证器安装引导。
 *
 * 用户故事：第一次看到二维码的用户不知道该装什么；没有这个卡片，扫码面板对他是死路。
 * 平台差异只影响“怎么安装”的提示文案，不影响能力判定。
 */
export function InstallGuide() {
  const { t } = useTranslation();
  const [platform, setPlatform] = useState<Platform>('desktop');

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  const installHint = useMemo(() => {
    if (platform === 'ios') return t('aiLogin.installIos');
    if (platform === 'android') return t('aiLogin.installAndroid');
    return t('aiLogin.installDesktop');
  }, [platform, t]);

  return (
    <aside className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 text-left dark:border-white/10 dark:bg-white/5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-200">
          <Smartphone className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900 dark:text-white">
            {t('aiLogin.installTitle')}
          </p>
          <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            {t('aiLogin.installDesc')}
          </p>
          <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
            {installHint}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <a
              href={AUTHENTICATOR_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline dark:text-primary-300"
            >
              {t('aiLogin.installOpen')}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {t('aiLogin.installFallback')}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
