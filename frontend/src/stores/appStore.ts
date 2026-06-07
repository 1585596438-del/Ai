/**
 * 全局应用状态：Provider 列表、当前任务、小说输入、当前 YAML
 * 使用 Zustand 持久化到 localStorage，刷新不丢小说输入
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Provider, TaskStatus, ProviderCreate } from '@/types'
import * as api from '@/api'

/**
 * 全局状态中的「小说输入」形状
 * - 区别于 types/index.ts 中的 NovelInput（后者是与后端 Pydantic 对齐的传输类型）
 * - 这里 title/author 用空字符串占位，避免组件中到处判 undefined
 */
export interface NovelInputState {
  title: string
  author: string
  text: string
}

/** 单个 Provider 在内存中的运行时状态（包含仅前端用的 api_key 草稿） */
export interface ProviderDraft {
  api_key: string
}

interface AppState {
  /* Provider */
  providers: Provider[]
  providersLoading: boolean
  fetchProviders: () => Promise<void>
  addProvider: (data: ProviderCreate) => Promise<Provider>
  removeProvider: (id: string) => Promise<void>
  setDefaultProvider: (id: string) => Promise<void>

  /* 当前任务 */
  currentTaskId: string | null
  taskStatus: TaskStatus | null
  setCurrentTask: (taskId: string, initialStatus?: TaskStatus['status']) => void
  updateTaskStatus: (s: Partial<TaskStatus>) => void
  clearTask: () => void

  /* 小说输入（持久化） */
  novelInput: NovelInputState
  setNovelInput: (input: Partial<NovelInputState>) => void
  resetNovelInput: () => void

  /* 结果 YAML（仅当前任务） */
  currentYaml: string
  setCurrentYaml: (yaml: string) => void
}

const emptyNovel: NovelInputState = { title: '', author: '', text: '' }

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      /* Provider */
      providers: [],
      providersLoading: false,
      fetchProviders: async () => {
        set({ providersLoading: true })
        try {
          const list = await api.listProviders()
          set({ providers: list, providersLoading: false })
        } catch (e) {
          set({ providersLoading: false })
          throw e
        }
      },
      addProvider: async (data) => {
        const p = await api.createProvider(data)
        set({ providers: [...get().providers, p] })
        return p
      },
      removeProvider: async (id) => {
        await api.deleteProvider(id)
        set({ providers: get().providers.filter((p) => p.id !== id) })
      },
      setDefaultProvider: async (id) => {
        const updated = await api.updateProvider(id, { is_default: true })
        set({
          providers: get().providers.map((p) => ({ ...p, is_default: p.id === id })),
        })
        // 找到刚被设为默认的项，确保本地一致
        void updated
      },

      /* 任务 */
      currentTaskId: null,
      taskStatus: null,
      setCurrentTask: (taskId, initialStatus = 'pending') =>
        set({
          currentTaskId: taskId,
          taskStatus: {
            task_id: taskId,
            status: initialStatus,
            progress: 0,
            detail: '',
            error_code: null,
            error_message: null,
            result_path: null,
          },
        }),
      updateTaskStatus: (s) =>
        set((state) => ({
          taskStatus: state.taskStatus ? { ...state.taskStatus, ...s } : null,
        })),
      clearTask: () => set({ currentTaskId: null, taskStatus: null, currentYaml: '' }),

      /* 小说输入 */
      novelInput: emptyNovel,
      setNovelInput: (input) => set({ novelInput: { ...get().novelInput, ...input } }),
      resetNovelInput: () => set({ novelInput: emptyNovel }),

      /* 结果 */
      currentYaml: '',
      setCurrentYaml: (yaml) => set({ currentYaml: yaml }),
    }),
    {
      name: 'novel2script-app',
      // 持久化小说输入；Provider / 任务 不持久化（后端为准）
      partialize: (state) => ({ novelInput: state.novelInput }) as AppState,
    },
  ),
)
