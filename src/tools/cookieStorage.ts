import AsyncStorage from '@react-native-async-storage/async-storage';

export const COOKIE_STORAGE_KEYS = {
  COOKIE: 'COOKIE',
};

export const CookieStorage = (() => {
  // 웹뷰에서 받아온 쿠키 저장
  const setCookie = async ({
    cookie,
    accessToken,
  }: {
    cookie: string;
    accessToken: string;
  }) => {
    await AsyncStorage.setItem(
      COOKIE_STORAGE_KEYS.COOKIE,
      JSON.stringify({ cookie, accessToken }),
    );
  };

  // 쿠키 가져오기
  const getCookie = async (): Promise<{
    cookie: string;
    accessToken: string;
  }> => {
    try {
      const data =
        (await AsyncStorage.getItem(COOKIE_STORAGE_KEYS.COOKIE)) || '';
      const { cookie, accessToken } = JSON.parse(data);
      return { cookie, accessToken };
    } catch {
      return { cookie: '', accessToken: '' };
    }
  };

  // 쿠키 삭제
  const removeCookie = () =>
    AsyncStorage.removeItem(COOKIE_STORAGE_KEYS.COOKIE);

  return { setCookie, getCookie, removeCookie };
})();
