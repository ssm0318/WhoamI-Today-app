import { APP_CONSTS } from '@constants';
import { NativeModules } from 'react-native';

// Use 'en' as default
export const getDeviceLanguage = (): 'en' | 'ko' => {
  // Get values like 'en-US', 'ko-KR', 'ja-JP'
  const language = APP_CONSTS.IS_IOS
    ? NativeModules.SettingsManager.settings.AppleLocale ||
      NativeModules.SettingsManager.settings.AppleLanguages[0] // iOS 13
    : NativeModules.I18nManager.localeIdentifier;

  if (language.includes('ko')) return 'ko';
  return 'en';
};
