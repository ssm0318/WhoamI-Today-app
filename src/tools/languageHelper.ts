import { getLocales } from 'react-native-localize';

// Use 'en' as default
export const getDeviceLanguage = (): 'en' | 'ko' => {
  const languageTag = getLocales()[0]?.languageTag ?? 'en';
  if (languageTag.includes('ko')) return 'ko';
  return 'en';
};
