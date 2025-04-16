import { Platform } from 'react-native';

export const IS_IOS = Platform.OS === 'ios';
export const IS_ANDROID = Platform.OS === 'android';

// dev 환경에서 설정하는 hostname
// NOTE
// 로컬에서 개발할 때는 이 hostname을 사용해야 함
// 실제 archive 할때는 PROD로 변경해야 함
export const WEB_VIEW_DEV_HOSTNAME = 'localhost';
export const IS_ADMIN = true; // 어드민 환경인지 여부
export const IS_DEV = false; // 개발환경인지 여부

export const WEB_VIEW_URL_INFO = {
  DEV: `http://${WEB_VIEW_DEV_HOSTNAME}:3000`,
  // PROD: 'https://diivers.world',
  //NOTE DNS 유효기간 만료 문제로 아래 URL 임시 사용
  PROD: 'https://whoami-test-group.gina-park.site',
  PROD_ADMIN: 'https://whoami-admin-group.gina-park.site',
};

export const WEB_VIEW_URL = (() => {
  if (IS_ADMIN) return WEB_VIEW_URL_INFO.PROD_ADMIN;
  if (IS_DEV) return WEB_VIEW_URL_INFO.DEV;
  return WEB_VIEW_URL_INFO.PROD;
})();

// API
export const API_BASE_URL = {
  DEV: `http://${WEB_VIEW_DEV_HOSTNAME}:8000/api/`,
  // PROD: 'https://diivers.world/api/'
  //NOTE DNS 유효기간 만료 문제로 아래 URL 임시 사용
  PROD: 'https://whoami-test-group.gina-park.site/api/',
  PROD_ADMIN: 'https://whoami-admin-group.gina-park.site/api/',
};

export const API_URL = (() => {
  if (IS_ADMIN) return API_BASE_URL.PROD_ADMIN;
  if (IS_DEV) return API_BASE_URL.DEV;
  return API_BASE_URL.PROD;
})();
