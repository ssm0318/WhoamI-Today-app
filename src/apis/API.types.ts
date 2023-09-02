import { AxiosInstance, AxiosRequestConfig } from 'axios';
import { FetchBlobResponse } from 'rn-fetch-blob';

/** API Instance */
export interface APIInstance extends AxiosInstance {
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

/** BLOB API Instance */
export type Methods =
  | 'POST'
  | 'GET'
  | 'DELETE'
  | 'PUT'
  | 'post'
  | 'get'
  | 'delete'
  | 'put';

export interface BlobAPIInstance {
  fetch(
    method: Methods,
    url: string,
    body?: any | null,
  ): Promise<FetchBlobResponse>;
}
