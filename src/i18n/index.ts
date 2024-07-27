import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en/translation.json';
import ko from './locales/ko/translation.json';
import { NativeModules, Platform } from 'react-native';

const getDeviceLanguage = () => {
  const deviceLanguage =
    Platform.OS === 'ios'
      ? NativeModules.SettingsManager.settings.AppleLocale ||
        NativeModules.SettingsManager.settings.AppleLanguages[0]
      : NativeModules.I18nManager.localeIdentifier;

  return deviceLanguage.split('_')[0];
};

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
