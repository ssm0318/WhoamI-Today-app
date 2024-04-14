import { WEBVIEW_CONSTS } from '@constants';
import axios, { AxiosRequestConfig } from 'axios';
import i18n from 'i18next';
import { APIInstance } from './API.types';
import { CsrfTokenStorage, TokenStorage } from '@tools';

export const API_BASE_URL = {
  DEV: `http://${WEBVIEW_CONSTS.WEB_VIEW_DEV_HOSTNAME}:8000/api/`,
  PROD: 'https://diivers.world/api/',
};

const API_URL = API_BASE_URL.PROD;

/** API Instance */
const JSON_DEFAULT_OPTIONS: AxiosRequestConfig = {
  baseURL: API_URL,
  withCredentials: true,
  xsrfHeaderName: 'X-CSRFTOKEN',
  xsrfCookieName: 'csrftoken',
  withXSRFToken: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept-Language': i18n.language,
  },
};

const API = (() => {
  const apiInstance: APIInstance = axios.create(JSON_DEFAULT_OPTIONS);

  apiInstance.interceptors.request.use(async (config) => {
    const csrfToken = await CsrfTokenStorage.getToken();
    const accessToken = await TokenStorage.getToken();

    try {
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }

      if (csrfToken) {
        config.headers.Cookie = `csrftoken=${csrfToken}`;
        config.headers['X-Requested-With'] = 'XMLHttpRequest';
        config.headers['X-CSRFTOKEN'] = csrfToken;
      }
    } catch (error) {
      console.log(accessToken, 48);
      console.error('[API request error]', error, accessToken);
      return Promise.reject(error);
    }
    return config;
  });

  apiInstance.interceptors.response.use(
    (config) => {
      return config.data;
    },
    (err) => {
      console.log('[API response error]', err);
      return Promise.reject(err);
    },
  );

  return apiInstance;
})();

const ApiService = {
  API,
};

export default ApiService;
