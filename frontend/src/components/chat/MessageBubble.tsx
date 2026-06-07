/**
 * 消息气泡组件：user(右对齐/可编辑) | assistant(左对齐/流式打字)
 */
import { useState } from 'react'
import { Pencil, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Message } from '@/types'

interface Props {
  msg: Message
  isStreaming?: boolean
  onRetract?: (msgId: string) => void
  onEdit?: (msgId: string, text: string) => void
}

export function MessageBubble({ msg, isStreaming, onRetract, onEdit }: Props) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(msg.content)
  const isUser = msg.role === 'user'

  const handleSaveEdit = () => {
    if (editText.trim() && editText !== msg.content) {
      onEdit?.(msg.id, editText)
    }
    setEditing(false)
  }

  return (
    <div className={cn('flex gap-2 mb-4', isUser ? 'justify-end' : 'justify-start')}>
      {/* 头像 */}
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
        isUser ? 'bg-blue-500 text-white order-2' : 'bg-slate-700 text-white order-1',
      )}>
        {isUser ? '我' : 'AI'}
      </div>

      {/* 气泡 */}
      <div className={cn(
        'max-w-[70%] rounded-lg px-4 py-2.5 text-sm',
        isUser ? 'bg-blue-500 text-white order-1' : 'bg-white border border-slate-200 order-2',
      )}>
        {isUser && editing ? (
          <div className="space-y-2">
            <textarea
              className="w-full min-h-[60px] p-2 rounded border border-blue-300 text-slate-900 text-sm resize-none"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              autoFocus
            />
            <div className="flex gap-1 justify-end">
              <button
                onClick={() => setEditing(false)}
                className="text-xs px-2 py-1 rounded bg-white/20 hover:bg-white/30"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                className="text-xs px-2 py-1 rounded bg-white/20 hover:bg-white/30"
              >
                保存并重新生成
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="whitespace-pre-wrap break-words leading-relaxed">
              {msg.content || (isStreaming && '思考中...')}
              {isStreaming && msg.content && <span className="animate-pulse">▊</span>}
            </div>

            {/* 操作按钮 */}
            {!isStreaming && msg.content && (
              <div className={cn('flex gap-1 mt-1.5', isUser ? 'justify-end' : 'justify-start')}>
                {isUser && (
                  <button
                    onClick={() => { setEditing(true); setEditText(msg.content) }}
                    className="text-[10px] px-1.5 py-0.5 rounded opacity-60 hover:opacity-100 hover:bg-white/20 transition-opacity flex items-center gap-1"
                  >
                    <Pencil className="h-2.5 w-2.5" /> 修改
                  </button>
                )}
                <button
                  onClick={() => onRetract?.(msg.id)}
                  className="text-[10px] px-1.5 py-0.5 rounded opacity-60 hover:opacity-100 hover:bg-white/20 transition-opacity flex items-center gap-1"
                >
                  <Undo2 className="h-2.5 w-2.5" /> 撤回
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
