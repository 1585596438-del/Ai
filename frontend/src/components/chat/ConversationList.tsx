/**
 * 左侧对话列表栏：搜索框 + 对话项 + 新建按钮
 */
import { useState, useEffect, useCallback } from 'react'
import { Search, Plus, MoreVertical, Trash2, Copy } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import * as api from '@/api'
import type { Conversation } from '@/types'

interface Props {
  selectedId: string | null
  onSelect: (conv: Conversation) => void
  onNewClick: () => void
  refreshTrigger: number
}

const statusBadge: Record<string, { label: string; color: string }> = {
  pending: { label: '进行中', color: 'bg-blue-100 text-blue-700' },
  parsing: { label: '进行中', color: 'bg-blue-100 text-blue-700' },
  extracting_characters: { label: '进行中', color: 'bg-blue-100 text-blue-700' },
  generating_scenes: { label: '进行中', color: 'bg-blue-100 text-blue-700' },
  generating_dialogues: { label: '进行中', color: 'bg-blue-100 text-blue-700' },
  assembling: { label: '进行中', color: 'bg-blue-100 text-blue-700' },
  completed: { label: '完成', color: 'bg-green-100 text-green-700' },
  failed: { label: '失败', color: 'bg-red-100 text-red-700' },
}

export function ConversationList({ selectedId, onSelect, onNewClick, refreshTrigger }: Props) {
  const [items, setItems] = useState<Conversation[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.listConversations({ page: 1, size: 50, q: search })
      setItems(res.items)
    } catch { /* Toast 由上层统一处理 */ }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => { fetchList() }, [fetchList, refreshTrigger])

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('确定删除此对话？')) return
    try {
      await api.deleteConversation(id)
      if (selectedId === id) onSelect(null as never)
      fetchList()
    } catch { /* ignore */ }
  }

  const handleCopy = async (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await api.copyConversation(conv.id)
      fetchList()
    } catch { /* ignore */ }
  }

  return (
    <div className="flex flex-col h-full border-r border-slate-200 bg-white">
      {/* 搜索框 */}
      <div className="p-3 border-b border-slate-100">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            className="pl-8 h-9 text-sm"
            placeholder="搜索对话..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto">
        {loading && items.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">加载中...</p>
        )}
        {!loading && items.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">暂无对话，点击下方新建</p>
        )}
        {items.map((conv) => {
          const badge = statusBadge[conv.status] ?? statusBadge.pending
          return (
            <div
              key={conv.id}
              onClick={() => onSelect(conv)}
              className={cn(
                'px-3 py-3 cursor-pointer border-b border-slate-50 hover:bg-slate-50 transition-colors',
                selectedId === conv.id && 'bg-slate-100',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{conv.title}</p>
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    {conv.last_message_preview || '暂无内容'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded', badge.color)}>
                    {badge.label}
                  </span>
                  <div className="relative group">
                    <MoreVertical className="h-3.5 w-3.5 text-slate-300 hover:text-slate-600" />
                    <div className="absolute right-0 top-4 hidden group-hover:flex flex-col bg-white border border-slate-200 rounded shadow-lg z-10 py-1 min-w-[80px]">
                      <button
                        onClick={(e) => handleCopy(conv, e)}
                        className="px-3 py-1.5 text-xs hover:bg-slate-50 flex items-center gap-1.5"
                      >
                        <Copy className="h-3 w-3" /> 复制
                      </button>
                      <button
                        onClick={(e) => handleDelete(conv.id, e)}
                        className="px-3 py-1.5 text-xs hover:bg-slate-50 text-red-600 flex items-center gap-1.5"
                      >
                        <Trash2 className="h-3 w-3" /> 删除
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 新建按钮 */}
      <div className="p-3 border-t border-slate-100">
        <Button onClick={onNewClick} className="w-full" size="sm">
          <Plus className="h-4 w-4" /> 新建对话
        </Button>
      </div>
    </div>
  )
}
