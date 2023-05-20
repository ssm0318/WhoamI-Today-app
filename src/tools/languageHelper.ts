import { APP_CONSTS } from '@constants';
import { NativeModules } from 'react-native';

// en을 default로
export const getDeviceLanguage = (): 'en' | 'ko' => {
  // 'en-US', 'ko-KR', 'ja-JP' 와 같은 값을 가져옴
  const language = APP_CONSTS.IS_IOS
    ? NativeModules.SettingsManager.settings.AppleLocale ||
      NativeModules.SettingsManager.settings.AppleLanguages[0] // iOS 13
    : NativeModules.I18nManager.localeIdentifier;

  if (language.includes('ko')) return 'ko';
  return 'en';
};
