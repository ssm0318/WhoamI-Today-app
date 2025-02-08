import AsyncStorage from '@react-native-async-storage/async-storage';
import { CookieType } from '@types';

export const COOKIE_STORAGE_KEYS = {
  COOKIE: 'COOKIE',
};

export const CookieStorage = (() => {
  // 웹뷰에서 받아온 쿠키 저장
  const setCookie = async ({
    csrftoken,
    access_token,
  }: CookieType.CookieObject) => {
    await AsyncStorage.setItem(
      COOKIE_STORAGE_KEYS.COOKIE,
      JSON.stringify({ csrftoken, access_token }),
    );
  };

  // 쿠키 가져오기
  const getCookie = async (): Promise<CookieType.CookieObject> => {
    try {
      const data =
        (await AsyncStorage.getItem(COOKIE_STORAGE_KEYS.COOKIE)) || '';

      const { csrftoken, access_token } = JSON.parse(data);
      return { csrftoken, access_token };
    } catch {
      return { csrftoken: '', access_token: '' };
    }
  };

  // 쿠키 삭제
  const removeCookie = async () => {
    try {
      await AsyncStorage.removeItem(COOKIE_STORAGE_KEYS.COOKIE);
      // Verify removal by attempting to read
      const remaining = await AsyncStorage.getItem(COOKIE_STORAGE_KEYS.COOKIE);
      if (remaining) {
        console.warn('Cookie removal may not have been successful');
      }
    } catch (error) {
      console.error('Error removing cookies:', error);
    }
  };

  return { setCookie, getCookie, removeCookie };
})();
