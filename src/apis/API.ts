import { WEBVIEW_CONSTS } from '@constants';
import { CookieStorage } from '@tools';
import axios, { AxiosRequestConfig } from 'axios';
import i18n from 'i18next';
import RNFetchBlob from 'rn-fetch-blob';
import { APIInstance, BlobAPIInstance, Methods } from './API.types';

export const API_BASE_URL = {
  DEV: `http://${WEBVIEW_CONSTS.WEB_VIEW_DEV_HOSTNAME}:8000/api/`,
  PROD: 'https://diivers.world/api/',
};

const API_URL = API_BASE_URL.PROD;

/** API Instance */
const JSON_DEFAULT_OPTIONS: AxiosRequestConfig = {
  baseURL: API_URL,
  withCredentials: true,
  xsrfHeaderName: 'X-CSRFToken',
  xsrfCookieName: 'csrftoken',
  withXSRFToken: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept-Language': i18n.language,
  },
};

const API = (() => {
  const { getCookie } = CookieStorage;
  const apiInstance: APIInstance = axios.create(JSON_DEFAULT_OPTIONS);

  apiInstance.interceptors.request.use(
    async (config: any) => {
      const { access_token, csrftoken } = await getCookie();
      config.headers.Cookie = `access_token=${access_token};csrftoken=${csrftoken}`;
      config.headers['X-Csrftoken'] = csrftoken;
      return config;
    },
    (err) => {
      console.log('[API request error]', err);
      return Promise.reject(err);
    },
  );

  apiInstance.interceptors.response.use(
    (config) => {
      return config;
    },
    (err) => {
      console.log('[API response error]', err);
      return Promise.reject(err);
    },
  );

  return apiInstance;
})();

/** BLOB API Instance */
const BLOB_DEFAULT_OPTIONS = {
  baseURL: API_URL,
  withCredentials: true,
  xsrfHeaderName: 'X-CSRFTOKEN',
  xsrfCookieName: 'csrftoken',
  headers: {
    'Content-Type': 'multipart/form-data',
    'Accept-Language': i18n.language,
  },
};

const BlobAPI = ((): BlobAPIInstance => {
  const { getCookie } = CookieStorage;

  const fetch = async (method: Methods, url: string, body?: any | null) => {
    const { csrftoken, access_token } = await getCookie();
    const fullHeaders = {
      ...BLOB_DEFAULT_OPTIONS.headers,
      Authorization: `Bearer ${access_token}`,
      Cookie: `csrftoken=${csrftoken}`,
      'X-Csrftoken': csrftoken,
    };

    return RNFetchBlob.fetch(
      method,
      BLOB_DEFAULT_OPTIONS.baseURL + url,
      fullHeaders,
      body,
    )
      .then((response) => {
        return response;
      })
      .catch((error) => {
        console.error('[BlobAPI error]', error);
        throw error;
      });
  };

  return {
    fetch,
  };
})();

const ApiService = {
  API,
  BlobAPI,
};

export default ApiService;
