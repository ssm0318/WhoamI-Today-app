import { Platform } from 'react-native';
import Config from 'react-native-config';

export const IS_IOS = Platform.OS === 'ios';
export const IS_ANDROID = Platform.OS === 'android';

// Hostname setting for dev environment
// NOTE
// This hostname should be used when developing locally
// Must be changed to PROD when actually archiving
export const WEB_VIEW_DEV_HOSTNAME = '192.168.219.123';
export const IS_ADMIN = false; // Whether it is admin environment
// Local WebView + LAN frontend: use DEV URLs below. Set false before release/archive builds.
export const IS_DEV = false;
// Set true for TestFlight/dev builds to bypass maintenance page. Set false for App Store release.
export const MAINTENANCE_BYPASS = true;
export const MAINTENANCE_BYPASS_COOKIE = 'whoami2026_v18'; // 추가

export const WEB_VIEW_URL_INFO = {
  DEV: `http://${WEB_VIEW_DEV_HOSTNAME}:3000`,
  // PROD: 'https://diivers.world',
  //NOTE Temporarily using the URL below due to DNS expiration issue
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
  //NOTE Temporarily using the URL below due to DNS expiration issue
  PROD: 'https://whoami-test-group.gina-park.site/api/',
  PROD_ADMIN: 'https://whoami-admin-group.gina-park.site/api/',
};

export const API_URL = (() => {
  if (IS_ADMIN) return API_BASE_URL.PROD_ADMIN;
  if (IS_DEV) return API_BASE_URL.DEV;
  return API_BASE_URL.PROD;
})();

// Spotify API credentials for widget
// Values are loaded from .env file via react-native-config
export const SPOTIFY_CLIENT_ID = Config.SPOTIFY_CLIENT_ID || '';
export const SPOTIFY_CLIENT_SECRET = Config.SPOTIFY_CLIENT_SECRET || '';
