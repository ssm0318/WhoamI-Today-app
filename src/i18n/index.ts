import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en/translation.json';
import ko from './locales/ko/translation.json';

// Do not call react-native-localize (getLocales) during this module's first
// evaluation: it runs from index.js before the RN bridge is ready and can
// trigger "RCTEventEmitter.receiveEvent / module not registered" on iOS.
// Device language is applied on mount in RootNavigator via changeLanguage().
i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  debug: true,
  ns: 'translation',
  resources: {
    en: { translation: en },
    ko: { translation: ko },
  },
});

export default i18n;
