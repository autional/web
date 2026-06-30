import { useState, useEffect } from 'react';
import '../i18n';
import { useTranslation } from 'react-i18next';
import { X, Cookie, Settings } from 'lucide-react';

const STORAGE_KEY = 'authms-cookie-consent';

interface ConsentState {
  necessary: boolean;
  analytics: boolean;
  decided: boolean;
}

function getInitialConsent(): ConsentState {
  if (typeof window === 'undefined') {
    return { necessary: true, analytics: false, decided: false };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return { necessary: true, analytics: false, decided: false };
}

export default function CookieConsent() {
  const { t } = useTranslation();
  const [consent, setConsent] = useState<ConsentState>(getInitialConsent);
  const [showSettings, setShowSettings] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!consent.decided) {
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [consent.decided]);

  const saveConsent = (newConsent: ConsentState) => {
    setConsent(newConsent);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConsent));
    setVisible(false);
    setShowSettings(false);
  };

  const acceptAll = () => {
    saveConsent({ necessary: true, analytics: true, decided: true });
  };

  const acceptNecessary = () => {
    saveConsent({ necessary: true, analytics: false, decided: true });
  };

  const saveCustom = () => {
    saveConsent({ ...consent, decided: true });
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:max-w-xl">
      {!showSettings ? (
        <div className="brand-card p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
            <div className="text-sm text-neutral-700 dark:text-neutral-300">
              <p className="font-medium text-neutral-900 dark:text-neutral-100">{t('cookie.title')}</p>
              <p className="mt-1">
                {t('cookie.description')}
              </p>
            </div>
          </div>
          <div className="mt-4 flex w-full flex-wrap items-center gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              <Settings className="h-4 w-4" />
              {t('cookie.preferences')}
            </button>
            <button
              onClick={acceptNecessary}
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              {t('cookie.necessaryOnly')}
            </button>
            <button
              onClick={acceptAll}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
            >
              {t('cookie.acceptAll')}
            </button>
          </div>
        </div>
      ) : (
        <div className="brand-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              {t('cookie.settingsTitle')}
            </h3>
            <button
              onClick={() => setShowSettings(false)}
              className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800">
              <div>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{t('cookie.necessary')}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('cookie.necessaryDesc')}</p>
              </div>
              <span className="text-xs font-medium text-neutral-400">{t('cookie.alwaysOn')}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
              <div>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{t('cookie.analytics')}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('cookie.analyticsDesc')}</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center" aria-label="分析 Cookie">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={consent.analytics}
                  onChange={(e) => setConsent((prev) => ({ ...prev, analytics: e.target.checked }))}
                />
                <div className="peer h-5 w-9 rounded-full bg-neutral-300 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-primary-600 peer-checked:after:translate-x-4 dark:bg-neutral-600" />
              </label>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setShowSettings(false)}
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              {t('cookie.cancel')}
            </button>
            <button
              onClick={saveCustom}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
            >
              {t('cookie.save')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
