import AsyncStorage from '@react-native-async-storage/async-storage';
import { CookieType } from '@types';

export const COOKIE_STORAGE_KEYS = {
  COOKIE: 'COOKIE',
};

export const CookieStorage = (() => {
  // Store cookies received from webview
  const setCookie = async ({
    csrftoken,
    access_token,
  }: CookieType.CookieObject) => {
    await AsyncStorage.setItem(
      COOKIE_STORAGE_KEYS.COOKIE,
      JSON.stringify({ csrftoken, access_token }),
    );
  };

  // Get cookies
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

  // Delete cookies
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
