import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en/translation.json';
import ko from './locales/ko/translation.json';
import { getDeviceLanguage } from '@tools';

i18n.use(initReactI18next).init({
  lng: getDeviceLanguage(),
  fallbackLng: 'en',
  debug: true,
  ns: 'translation',
  resources: {
    en: { translation: en },
    ko: { translation: ko },
  },
});

export default i18n;
