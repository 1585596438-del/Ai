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

/**
 * 任务状态枚举（与后端 script_generator.update_task() 严格对齐）
 * - 后端定义：backend/app/services/script_generator.py
 * - 历史记录：早期前端用 `extracting`，后端实际是 `extracting_characters`，本枚举已修正
 */
export type TaskStatusValue =
  | 'pending'
  | 'parsing'
  | 'extracting_characters'
  | 'generating_scenes'
  | 'generating_dialogues'
  | 'assembling'
  | 'completed'
  | 'failed'

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

/** 小说输入（与后端 NovelInput 对齐：text 必填且 ≥1000 字） */
export interface NovelInput {
  text: string
  title?: string
  author?: string
}

/**
 * 提交转换请求（与后端 Pydantic ConvertRequest 对齐）
 * - 后端定义见 backend/app/schemas/novel.py
 * - 字段必须嵌套到 `novel` 内，不能平铺到顶层
 */
export interface ConvertRequest {
  novel: NovelInput
  provider_id: string
  model: string
  /** 全局补充提示词（后端保留字段，本期 UI 未暴露） */
  custom_prompt?: string
  /** 分阶段自定义提示词（后端保留字段，本期 UI 未暴露） */
  stage_prompts?: {
    character_extraction?: string
    scene_generation?: string
    dialogue_generation?: string
  }
}

/** 提交转换响应 */
export interface ConvertResponse {
  task_id: string
  status: TaskStatusValue
}

/** 后端统一错误响应 */
export interface ApiError {
  detail: string
  status?: number
}
