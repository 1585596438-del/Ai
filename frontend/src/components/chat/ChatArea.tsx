/**
 * 中间对话区域：消息列表 + 输入框
 */
import { useEffect, useRef } from 'react'
import { Download, FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'
import type { ConversationDetail } from '@/types'
import * as api from '@/api'

interface Props {
  conversation: ConversationDetail | null
  streamingMessageId: string | null
  streamingContent: string
  onSend: (text: string, imagePaths?: string[]) => void
  onRetract: (msgId: string) => void
  onEdit: (msgId: string, text: string) => void
  isStreaming: boolean
}

export function ChatArea({
  conversation, streamingMessageId, streamingContent,
  onSend, onRetract, onEdit, isStreaming,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation?.messages, streamingContent])

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 bg-slate-50">
        <div className="text-center">
          <p className="text-lg">选择一个对话，或新建一个</p>
          <p className="text-sm mt-2">开始将小说转化为剧本</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-white">
        <div>
          <h2 className="text-sm font-semibold">{conversation.title}</h2>
          <p className="text-[11px] text-slate-400">
            {conversation.model_name} · {conversation.message_count} 条消息
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => api.exportConversation(conversation.id, 'md')}>
            <FileDown className="h-3.5 w-3.5" /> MD
          </Button>
          <Button variant="outline" size="sm" onClick={() => api.exportConversation(conversation.id, 'txt')}>
            <FileDown className="h-3.5 w-3.5" /> TXT
          </Button>
          <Button variant="outline" size="sm" onClick={() => api.exportConversation(conversation.id, 'yaml')}>
            <Download className="h-3.5 w-3.5" /> YAML
          </Button>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
        {conversation.messages.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-12">发送第一条消息开始</p>
        )}
        {conversation.messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            onRetract={onRetract}
            onEdit={onEdit}
          />
        ))}
        {/* 流式渲染中的 assistant 消息 */}
        {isStreaming && streamingMessageId && (
          <MessageBubble
            msg={{
              id: streamingMessageId,
              conversation_id: conversation.id,
              role: 'assistant',
              content: streamingContent,
              has_image: false,
              image_paths: null,
              created_at: new Date().toISOString(),
            }}
            isStreaming
          />
        )}
        <div ref={bottomRef} />
      </div>

      {/* 输入框 */}
      <ChatInput
        onSend={onSend}
        isStreaming={isStreaming}
      />
    </div>
  )
}
