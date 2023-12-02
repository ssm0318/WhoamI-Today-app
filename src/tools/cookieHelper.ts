import CookieManager, { Cookie } from '@react-native-cookies/cookies';
import { CookieStorage } from './cookieStorage';
import { WEBVIEW_CONSTS } from '@constants';
import { CookieType } from '@types';

export const parseCookie = (cookie: string): CookieType.CookieObject => {
  const cookieArr = cookie.split(';');
  const cookieObj: Record<string, string> = {};
  cookieArr.forEach((item) => {
    const [key, value] = item.split('=');
    cookieObj[key.trim()] = value;
  });

  return cookieObj as CookieType.CookieObject;
};

export const saveCookie = async (cookieObj?: CookieType.CookieObject) => {
  if (!cookieObj) return;
  const { csrftoken, access_token } = cookieObj;
  const { setCookie } = CookieStorage;
  await CookieManager.set(WEBVIEW_CONSTS.WEB_VIEW_URL.DEV, {
    name: 'csrftoken',
    value: csrftoken,
  });
  await CookieManager.set(WEBVIEW_CONSTS.WEB_VIEW_URL.DEV, {
    name: 'access_token',
    value: access_token,
  });
  setCookie({
    csrftoken: csrftoken,
    access_token: access_token,
  });
};

export const getCookie = async (): Promise<Cookie> => {
  const res = await CookieManager.get(WEBVIEW_CONSTS.WEB_VIEW_URL.DEV, true);
  const { cookie } = res;
  return cookie;
};

export const removeCookie = async () => {
  const { removeCookie } = CookieStorage;
  await CookieManager.clearAll(true);
  removeCookie();
};
