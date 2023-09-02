import CookieManager from '@react-native-cookies/cookies';
import { CookieStorage } from './cookieStorage';

export const checkCookie = async (url: string) => {
  const { setCookie } = CookieStorage;
  const res = await CookieManager.get(url);

  const { access_token: accessToken, csrftoken: cookie } = res;

  if (!accessToken || !cookie) return;
  setCookie({
    accessToken: accessToken.value || '',
    cookie: cookie.value || '',
  });
};
