/**
 * 应用 Layout：左侧固定侧边栏 + 右侧内容区
 * 侧边栏菜单：开始 / Provider 管理
 * 内容区由 <Outlet /> 渲染子路由
 */
import { NavLink, Outlet } from 'react-router-dom'
import { Home, Settings, PlayCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
  { to: '/', label: '开始转换', icon: Home },
  { to: '/convert', label: '选择模型', icon: PlayCircle },
  { to: '/providers', label: 'Provider 管理', icon: Settings },
]

export function Layout(): JSX.Element {
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* 侧边栏 */}
      <aside className="w-60 shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-slate-200">
          <img src="/brand/logo.png" alt="星幕" className="h-7 w-7" />
          <div>
            <div className="font-bold leading-tight">星幕 StarScript</div>
            <div className="text-[10px] text-slate-500">让故事，走向银幕</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100',
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 text-[11px] text-slate-400 border-t border-slate-200">
          v0.1.0 · Novel2Script
        </div>
      </aside>

      {/* 内容区 */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
