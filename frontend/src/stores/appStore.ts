/**
 * 全局应用状态：Provider 列表、默认配置、小说输入
 * 使用 Zustand 持久化到 localStorage
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Provider, ProviderCreate } from '@/types'
import * as api from '@/api'

export interface NovelInputState {
  title: string
  author: string
  text: string
}

interface AppState {
  /* Provider */
  providers: Provider[]
  providersLoading: boolean
  fetchProviders: () => Promise<void>
  addProvider: (data: ProviderCreate) => Promise<Provider>
  removeProvider: (id: string) => Promise<void>

  /* 默认配置（持久化） */
  defaultProviderId: string
  defaultModelName: string
  setDefaults: (providerId: string, modelName: string) => void

  /* 小说输入（持久化） */
  novelInput: NovelInputState
  setNovelInput: (input: Partial<NovelInputState>) => void
  resetNovelInput: () => void
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
        const next = get().providers.filter((p) => p.id !== id)
        set({
          providers: next,
          defaultProviderId: get().defaultProviderId === id ? '' : get().defaultProviderId,
        })
      },

      /* 默认配置 */
      defaultProviderId: '',
      defaultModelName: '',
      setDefaults: (providerId, modelName) =>
        set({ defaultProviderId: providerId, defaultModelName: modelName }),

      /* 小说输入 */
      novelInput: emptyNovel,
      setNovelInput: (input) => set({ novelInput: { ...get().novelInput, ...input } }),
      resetNovelInput: () => set({ novelInput: emptyNovel }),
    }),
    {
      name: 'novel2script-app',
      partialize: (state) => ({
        novelInput: state.novelInput,
        defaultProviderId: state.defaultProviderId,
        defaultModelName: state.defaultModelName,
      }) as AppState,
    },
  ),
)
