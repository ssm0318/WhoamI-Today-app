import { WEBVIEW_CONSTS } from '@constants';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import i18n from 'i18next';

export const API_BASE_URL = {
  DEV: `http://${WEBVIEW_CONSTS.WEB_VIEW_DEV_HOSTNAME}:8000/api/`,
  PROD: 'https://diivers.world/api/',
};

interface APIInstance extends AxiosInstance {
  getUri(config?: AxiosRequestConfig): string;
  request<T>(config: AxiosRequestConfig): Promise<T>;
  get<T>(url: string, config?: AxiosRequestConfig): Promise<T>;
  delete<T>(url: string, config?: AxiosRequestConfig): Promise<T>;
  head<T>(url: string, config?: AxiosRequestConfig): Promise<T>;
  options<T>(url: string, config?: AxiosRequestConfig): Promise<T>;
  post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
  put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
  patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
}

const JSON_DEFAULT_OPTIONS: AxiosRequestConfig = {
  baseURL: API_BASE_URL.DEV,
  withCredentials: true,
  xsrfHeaderName: 'X-CSRFTOKEN',
  xsrfCookieName: 'csrftoken',
  headers: {
    'Content-Type': 'application/json',
    'Accept-Language': i18n.language,
  },
};

const API = (() => {
  const apiInstance: APIInstance = axios.create(JSON_DEFAULT_OPTIONS);

  apiInstance.interceptors.request.use(
    async (config: any) => {
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

export default API;
