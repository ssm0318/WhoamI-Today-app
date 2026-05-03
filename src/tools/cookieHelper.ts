import CookieManager, { Cookie } from '@react-native-cookies/cookies';
import { CookieStorage } from './cookieStorage';
import { APP_CONSTS } from '@constants';
import { CookieType } from '@types';
import { triggerWidgetRefresh } from '../native/WidgetDataModule';

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
  await CookieManager.set(APP_CONSTS.WEB_VIEW_URL, {
    name: 'csrftoken',
    value: csrftoken,
  });
  await CookieManager.set(APP_CONSTS.WEB_VIEW_URL, {
    name: 'access_token',
    value: access_token,
  });
  await setCookie({
    csrftoken: csrftoken,
    access_token: access_token,
  });

  // Refresh widget after login to show updated data
  await triggerWidgetRefresh();
};

export const getCookie = async (): Promise<Cookie> => {
  const res = await CookieManager.get(APP_CONSTS.WEB_VIEW_URL, true);
  const { cookie } = res;
  return cookie;
};

export const removeCookie = async () => {
  const { removeCookie } = CookieStorage;
  await CookieManager.clearAll(true);
  removeCookie();
};

// Pre-seed the maintenance bypass cookie natively so the first WebView request
// already carries it — avoids the page-side `location.reload()` round-trip.
export const setMaintenanceBypassCookie = async (cookieValue: string) => {
  await CookieManager.set(APP_CONSTS.WEB_VIEW_URL, {
    name: 'maintenance_bypass',
    value: cookieValue,
    path: '/',
    secure: true,
  });
};
