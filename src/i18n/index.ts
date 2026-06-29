import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import enUS from '../../../landing-site-astro/src/i18n/locales/en-US.json';

i18next.use(initReactI18next).init({
  resources: { 'en-US': { translation: enUS } },
  lng: 'en-US',
  fallbackLng: 'en-US',
  keySeparator: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18next;
