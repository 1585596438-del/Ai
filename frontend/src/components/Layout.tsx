/**
 * 极简顶栏 Layout：Logo + 设置齿轮
 * 内容区由 <Outlet /> 渲染子路由
 */
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Settings } from 'lucide-react'
import { SettingsDialog } from '@/components/SettingsDialog'
import { useAppStore } from '@/stores/appStore'

export function Layout(): JSX.Element {
  const [showSettings, setShowSettings] = useState(false)
  const fetchProviders = useAppStore((s) => s.fetchProviders)

  const openSettings = async () => {
    await fetchProviders().catch(() => {})
    setShowSettings(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFFDF7] to-[#F2E8D5] flex flex-col">
      {/* 顶栏 */}
      <header className="h-12 shrink-0 border-b border-[#E8DCC8] flex items-center justify-between px-4 bg-gradient-to-r from-[#FFFDF7] to-[#F7EDDC]">
        <div className="flex items-center gap-2">
          <img src="/brand/logo.png" alt="星幕" className="h-6 w-6" />
          <span className="font-bold text-sm">星幕 StarScript</span>
        </div>
        <button
          onClick={openSettings}
          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors"
          title="设置"
        >
          <Settings className="h-4 w-4" />
        </button>
      </header>

      {/* 内容 */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>

      {/* 设置弹窗 */}
      {showSettings && (
        <SettingsDialog onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}
