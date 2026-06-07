/**
 * Axios HTTP 客户端：统一 baseURL、错误处理、拦截器
 *
 * - 开发期：连 http://localhost:8000（Vite proxy 或直连）
 * - Electron 打包后：后端由主进程在同机 localhost:8000 启动，前端通过相对路径 /api 访问
 * - 错误统一抛出 ApiError，前端 store / 组件可统一处理
 */
import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios'
import type { ApiError } from '@/types'

/** baseURL：开发期直连后端 8000；生产/Electron 走 /api 让主进程代理到 8000 */
const baseURL = import.meta.env.DEV
  ? 'http://localhost:8000/api'
  : '/api'

/** Axios 实例：全局单例 */
export const http: AxiosInstance = axios.create({
  baseURL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

/** 响应拦截器：把后端 HTTPException(detail=...) 统一抛出 ApiError */
http.interceptors.response.use(
  (resp) => resp,
  (err: AxiosError<{ detail?: string }>) => {
    const status = err.response?.status
    const detail = err.response?.data?.detail ?? err.message ?? '请求失败'
    const apiErr: ApiError = { detail, status }
    return Promise.reject(apiErr)
  },
)

/**
 * 类型化 GET 包装：自动推断返回类型
 * @param url 相对路径，如 '/providers'
 * @param config 额外 Axios 配置
 */
export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const resp = await http.get<T>(url, config)
  return resp.data
}

/**
 * 类型化 POST 包装
 * @param url 相对路径
 * @param data 请求体
 * @param config 额外配置
 */
export async function apiPost<T, B = unknown>(url: string, data?: B, config?: AxiosRequestConfig): Promise<T> {
  const resp = await http.post<T>(url, data, config)
  return resp.data
}

/**
 * 类型化 PUT 包装
 */
export async function apiPut<T, B = unknown>(url: string, data?: B, config?: AxiosRequestConfig): Promise<T> {
  const resp = await http.put<T>(url, data, config)
  return resp.data
}

/**
 * 类型化 DELETE 包装
 */
export async function apiDelete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const resp = await http.delete<T>(url, config)
  return resp.data
}
