// 前端类型定义（与后端 Pydantic Schema 一一对应）

/** AI Provider 模型（来自后端 GET /api/providers） */
export interface Provider {
  id: string
  name: string
  base_url: string
  /** 逗号分隔的模型名（后端用字符串存储） */
  models: string[]
  is_default: boolean
  created_at: string
}

/** 创建 / 更新 Provider 的请求体 */
export interface ProviderCreate {
  name: string
  base_url: string
  api_key: string
  models: string[]
  is_default: boolean
}

export type ProviderUpdate = Partial<ProviderCreate>

/** 任务状态枚举（与后端 TaskStatus 对齐） */
export type TaskStatusValue = 'pending' | 'parsing' | 'extracting' | 'generating_scenes' | 'generating_dialogues' | 'assembling' | 'completed' | 'failed'

/** 任务状态（SSE 流推送 + GET /api/convert/{id}） */
export interface TaskStatus {
  task_id: string
  status: TaskStatusValue
  /** 0~100 */
  progress: number
  detail: string
  error_code: string | null
  error_message: string | null
  result_path: string | null
}

/** 提交转换请求 */
export interface ConvertRequest {
  provider_id: string
  model: string
  title: string
  author: string
  text: string
}

/** 提交转换响应 */
export interface ConvertResponse {
  task_id: string
  status: TaskStatusValue
}

/** 小说输入（全局状态） */
export interface NovelInput {
  title: string
  author: string
  text: string
}

/** 后端统一错误响应 */
export interface ApiError {
  detail: string
  status?: number
}
