import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhCN from './zh-CN.json';

i18next.use(initReactI18next).init({
  resources: { 'zh-CN': { translation: zhCN } },
  lng: 'zh-CN',
  fallbackLng: 'zh-CN',
  keySeparator: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18next;
