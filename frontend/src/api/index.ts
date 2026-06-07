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
  ConversationDetail,
  ConversationListResponse,
  CreateConversationRequest,
  AddMessageRequest,
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

/** 设为默认 Provider */
export const setDefaultProvider = (id: string) =>
  apiPut<Provider, { is_default: boolean }>(`/providers/${id}`, { is_default: true })

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


/* ───────────── Conversations ───────────── */

/** 获取对话列表（支持分页+搜索+状态筛选） */
export const listConversations = (params?: {
  page?: number; size?: number; q?: string; status?: string
}) => apiGet<ConversationListResponse>('/conversations', params ? { params } : undefined)

/** 获取对话详情 */
export const getConversation = (id: string) =>
  apiGet<ConversationDetail>(`/conversations/${id}`)

/** 新建对话 */
export const createConversation = (data: CreateConversationRequest) =>
  apiPost<{ conversation_id: string; user_message_id: string; assistant_message_id: string }>(
    '/conversations', data
  )

/** 重命名对话 */
export const renameConversation = (id: string, title: string) =>
  apiPut<{ ok: boolean }>(`/conversations/${id}`, { title })

/** 复制对话 */
export const copyConversation = (id: string) =>
  apiPost<{ conversation_id: string }>(`/conversations/${id}/copy`)

/** 删除对话 */
export const deleteConversation = (id: string) =>
  apiDelete<{ ok: boolean }>(`/conversations/${id}`)

/** 追加消息（多轮修改） */
export const addMessage = (convId: string, data: AddMessageRequest) =>
  apiPost<{ user_message_id: string; assistant_message_id: string }>(
    `/conversations/${convId}/messages`, data
  )

/** 撤回消息 */
export const retractMessage = (convId: string, msgId: string) =>
  apiDelete<{ ok: boolean }>(`/conversations/${convId}/messages/${msgId}`)

/** 修改消息 */
export const editMessage = (convId: string, msgId: string, data: AddMessageRequest) =>
  apiPut<{ user_message_id: string; assistant_message_id: string }>(
    `/conversations/${convId}/messages/${msgId}`, data
  )

/** 多模态探测 */
export const checkMultimodal = (providerId: string, modelName: string) =>
  apiPost<{ is_multimodal: boolean; model_name: string }>(
    '/models/check-multimodal', { provider_id: providerId, model_name: modelName }
  )

/** 导出单条对话（直接打开下载） */
export function exportConversation(convId: string, format: 'yaml' | 'txt' | 'md') {
  const url = `${http.defaults.baseURL}/conversations/${convId}/export?format=${format}`
  window.open(url, '_blank')
}

/** 批量导出 ZIP */
export async function exportConversationsZip(ids: string[], format: 'yaml' | 'txt' | 'md') {
  const resp = await http.post('/conversations/export-zip', { ids, format }, { responseType: 'blob' })
  const blobUrl = URL.createObjectURL(resp.data as Blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = 'conversations.zip'
  a.click()
  URL.revokeObjectURL(blobUrl)
}

/**
 * 打开对话 SSE 流
 * @returns 关闭函数
 */
export function openConversationStream(
  convId: string,
  onProgress: (data: { stage: string; progress: number; detail: string }) => void,
  onMessage: (data: { message_id: string; delta: string }) => void,
  onDone: (data: { conversation_id: string; message_id: string; status: string; duration_ms: number }) => void,
  onError: (data: { error_code: string; error_message: string }) => void,
): () => void {
  const url = `${http.defaults.baseURL}/conversations/${convId}/stream`
  const es = new EventSource(url)

  es.addEventListener('progress', (e: MessageEvent) => {
    try { onProgress(JSON.parse(e.data)) } catch { /* ignore */ }
  })
  es.addEventListener('message', (e: MessageEvent) => {
    try { onMessage(JSON.parse(e.data)) } catch { /* ignore */ }
  })
  es.addEventListener('done', (e: MessageEvent) => {
    try { onDone(JSON.parse(e.data)); es.close() } catch { /* ignore */ }
  })
  es.addEventListener('error', (e: MessageEvent) => {
    try {
      const d = JSON.parse(e.data)
      if (d.error_code) onError(d)
    } catch { /* ignore */ }
    es.close()
  })

  return () => es.close()
}
