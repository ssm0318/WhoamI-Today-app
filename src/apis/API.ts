import { TokenStorage } from '@tools';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export const API_BASE_URL = 'https://diivers.world/api/';
// export const API_BASE_URL = 'http://localhost:3000/api/';

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

const API = (() => {
  const apiInstance: APIInstance = axios.create({
    withCredentials: true,
    baseURL: API_BASE_URL,
  });

  apiInstance.interceptors.request.use(
    async (config: any) => {
      const { access: token } = await TokenStorage.getToken();
      config.headers['Content-Type'] = 'application/json';
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    },
    (err) => {
      return Promise.reject(err);
    },
  );

  apiInstance.interceptors.response.use(
    (config) => {
      return config;
    },
    (err) => {
      return Promise.reject(err);
    },
  );

  return apiInstance;
})();

export default API;
