/**
 * 后端 API 业务封装：按域拆分方法，统一返回类型
 * 调用方只 import 这层，不直接用 axios
 */
import { apiGet, apiPost, apiPut, apiDelete, http } from './client'
import type {
  Provider,
  ProviderCreate,
  ProviderUpdate,
  ConvertRequest,
  ConvertResponse,
  TaskStatus,
} from '@/types'

/* ───────────── Provider ───────────── */

/** 列出所有 AI Provider */
export const listProviders = () => apiGet<Provider[]>('/providers')

/** 创建 Provider */
export const createProvider = (data: ProviderCreate) => apiPost<Provider, ProviderCreate>('/providers', data)

/** 更新 Provider */
export const updateProvider = (id: string, data: ProviderUpdate) =>
  apiPut<Provider, ProviderUpdate>(`/providers/${id}`, data)

/** 删除 Provider */
export const deleteProvider = (id: string) => apiDelete<{ ok: boolean }>(`/providers/${id}`)

/** 测试 Provider 连通性 */
export const testProvider = (id: string) => apiPost<{ ok: boolean; message: string }>(`/providers/${id}/test`)

/* ───────────── Models ───────────── */

/** 根据 base_url + api_key 拉取可用模型列表（无需先保存 Provider） */
export const fetchModels = (base_url: string, api_key: string) =>
  apiPost<{ models: string[] }, { base_url: string; api_key: string }>('/models/fetch', { base_url, api_key })

/* ───────────── Convert ───────────── */

/** 提交转换任务 */
export const submitConvert = (data: ConvertRequest) =>
  apiPost<ConvertResponse, ConvertRequest>('/convert', data)

/** 查任务状态（备用，SSE 失败时降级用） */
export const getTask = (taskId: string) => apiGet<TaskStatus>(`/convert/${taskId}`)

/**
 * 打开 SSE 流，实时接收任务进度
 * @param taskId 任务 ID
 * @param onEvent 每条 data 字段触发
 * @param onError 连接异常触发
 * @returns 关闭函数
 */
export function openTaskStream(
  taskId: string,
  onEvent: (s: TaskStatus) => void,
  onError?: (e: Event) => void,
): () => void {
  // EventSource 不支持自定义 header，URL 拼参数；后端路径 /api/convert/{id}/stream
  const url = `${http.defaults.baseURL}/convert/${taskId}/stream`
  const es = new EventSource(url)
  es.onmessage = (e) => {
    try {
      const payload = JSON.parse(e.data) as TaskStatus
      onEvent(payload)
    } catch (err) {
      // 非 JSON 数据忽略
      console.warn('[SSE] non-JSON payload', e.data, err)
    }
  }
  es.onerror = (e) => {
    onError?.(e)
  }
  return () => es.close()
}

/** 下载任务结果 YAML（返回 blob URL） */
export async function downloadResult(taskId: string): Promise<string> {
  const resp = await http.get(`/convert/${taskId}/download`, { responseType: 'blob' })
  return URL.createObjectURL(resp.data as Blob)
}

/* ───────────── Files ───────────── */

/** 读取本地文本文件内容（通过后端 /api/files/read） */
export const readLocalFile = (path: string) =>
  apiPost<{ content: string; filename: string }, { path: string }>('/files/read', { path })
