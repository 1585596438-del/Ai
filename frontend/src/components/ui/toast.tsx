/**
 * 简易 Toast 系统：基于 Radix 无依赖实现
 * - useToast() 推消息，<Toaster /> 渲染
 * - 自动 4s 消失，最多同时显示 5 条
 */
import { create } from 'zustand'
import { cn } from '@/lib/utils'

type ToastVariant = 'default' | 'success' | 'destructive'

export interface ToastItem {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
}

interface ToastState {
  toasts: ToastItem[]
  push: (t: Omit<ToastItem, 'id'>) => string
  dismiss: (id: string) => void
}

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = Math.random().toString(36).slice(2, 10)
    set((s) => ({ toasts: [...s.toasts.slice(-4), { ...t, id }] }))
    // 4s 后自动消失
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }))
    }, 4000)
    return id
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}))

/** 业务调用入口 */
export function useToast() {
  return {
    toast: (t: Omit<ToastItem, 'id'>) => useToastStore.getState().push(t),
    dismiss: (id: string) => useToastStore.getState().dismiss(id),
  }
}

/** 渲染容器：放到 App 根 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)
  return (
    <div className="pointer-events-none fixed top-4 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto rounded-md border p-3 shadow-md text-sm',
            t.variant === 'destructive' && 'border-red-300 bg-red-50 text-red-900',
            t.variant === 'success' && 'border-emerald-300 bg-emerald-50 text-emerald-900',
            (!t.variant || t.variant === 'default') && 'border-slate-300 bg-white text-slate-900',
          )}
          onClick={() => dismiss(t.id)}
        >
          {t.title && <div className="font-semibold">{t.title}</div>}
          {t.description && <div className="mt-0.5 text-xs opacity-80">{t.description}</div>}
        </div>
      ))}
    </div>
  )
}
