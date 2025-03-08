import { APP_CONSTS } from '@constants';
import { CookieStorage } from '@tools';
import axios, { AxiosRequestConfig } from 'axios';
import RNFetchBlob from 'rn-fetch-blob';
import { APIInstance, BlobAPIInstance, Methods } from './API.types';
import i18n from 'i18next';

/** API Instance */
const JSON_DEFAULT_OPTIONS: AxiosRequestConfig = {
  baseURL: APP_CONSTS.API_URL,
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

      // 토큰 유효성 검사: 토큰이 비어있는 경우 요청을 중단하고 오류 반환
      if (!access_token || !csrftoken) {
        console.error(
          '[API] Missing authentication tokens for request to:',
          config.url,
        );
        console.error('[API] Missing authentication tokens for request to:', {
          access_token,
          csrftoken,
        });
        return;
      }

      config.headers.Cookie = `access_token=${access_token};csrftoken=${csrftoken}`;
      config.headers['X-Csrftoken'] = csrftoken;
      console.log('[API request]', config.url);
      console.log('👷 [API request headers]', config.headers);

      return config;
    },
    (err) => {
      console.log('[API request error]', err);
      return Promise.reject(err);
    },
  );

  apiInstance.interceptors.response.use(
    (config) => {
      console.log('ℹ️ [API response]', config.config.url, config.data);
      return config.data;
    },
    (err) => {
      console.log('‼️ [API response error]', err.config?.url, err);
      return Promise.reject(err);
    },
  );

  return apiInstance;
})();

/** BLOB API Instance */
const BLOB_DEFAULT_OPTIONS = {
  baseURL: APP_CONSTS.API_URL,
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
