/**
 * 对话主页面：左侧可折叠对话列表 + 中间对话区
 * - 首次发送消息自动创建对话（使用已保存的默认 Provider/Model）
 * - 顶部无弹窗，直接在输入框操作
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { PanelLeftClose, PanelLeft, MessageSquare, Plus } from 'lucide-react'
import { ConversationList } from '@/components/chat/ConversationList'
import { ChatArea } from '@/components/chat/ChatArea'
import { ChatInput } from '@/components/chat/ChatInput'
import * as api from '@/api'
import { useToast } from '@/components/ui/toast'
import { useAppStore } from '@/stores/appStore'
import type { Conversation, ConversationDetail } from '@/types'

export function ChatPage(): JSX.Element {
  const { toast } = useToast()
  const fetchProviders = useAppStore((s) => s.fetchProviders)
  const defaultProviderId = useAppStore((s) => s.defaultProviderId)
  const defaultModelName = useAppStore((s) => s.defaultModelName)

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [conversation, setConversation] = useState<ConversationDetail | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null)
  const [streamingContent, setStreamingContent] = useState('')
  const [streamDurationMs, setStreamDurationMs] = useState<number | null>(null)
  const closeStreamRef = useRef<(() => void) | null>(null)
  const streamStartRef = useRef<number>(0)

  // 初始化
  useEffect(() => {
    fetchProviders().catch(() => {})
  }, [fetchProviders])

  // 选择对话
  const handleSelect = useCallback(async (conv: Conversation) => {
    setSelectedId(conv.id)
    try {
      const detail = await api.getConversation(conv.id)
      setConversation(detail)
    } catch {
      toast({ title: '加载对话失败', variant: 'destructive' })
    }
  }, [toast])

  // 启动 SSE 流
  const startStream = useCallback((convId: string, assistantId: string) => {
    closeStreamRef.current?.()
    setIsStreaming(true)
    setStreamingMsgId(assistantId)
    setStreamingContent('')
    setStreamDurationMs(null)
    streamStartRef.current = Date.now()

    const close = api.openConversationStream(
      convId,
      () => {},
      (msg) => {
        if (msg.message_id === assistantId) {
          setStreamingContent((prev) => prev + msg.delta)
        }
      },
      (done) => {
        const duration = done.duration_ms || (Date.now() - streamStartRef.current)
        setStreamDurationMs(duration)
        setIsStreaming(false)
        setStreamingMsgId(null)
        api.getConversation(convId).then(setConversation).catch(() => {})
        setRefreshTrigger((p) => p + 1)
      },
      (err) => {
        setStreamDurationMs(Date.now() - streamStartRef.current)
        setIsStreaming(false)
        setStreamingMsgId(null)
        toast({ title: '生成失败', description: err.error_message, variant: 'destructive' })
        api.getConversation(convId).then(setConversation).catch(() => {})
      },
    )
    closeStreamRef.current = close
  }, [toast])

  // 发送消息
  const handleSend = useCallback(async (text: string, imagePaths?: string[], mode: 'default' | 'novel_to_script' = 'default') => {
    if (!defaultProviderId || !defaultModelName) {
      toast({ title: '未配置模型', description: '请先点击右上角齿轮设置 Provider 和模型', variant: 'destructive' })
      return
    }

    try {
      // 如果当前没有对话，先创建
      if (!conversation) {
        const res = await api.createConversation({
          title: text.slice(0, 30),
          novel: { title: text.slice(0, 30), author: '', text },
          provider_id: defaultProviderId,
          model_name: defaultModelName,
          image_paths: imagePaths,
          mode,
        })
        setSelectedId(res.conversation_id)
        setRefreshTrigger((p) => p + 1)

        // 乐观更新
        setConversation({
          id: res.conversation_id, title: text.slice(0, 30),
          novel_id: null, novel_title: '', novel_author: '',
          provider_id: defaultProviderId, model_name: defaultModelName,
          status: 'pending', progress: 0, detail: '',
          error_code: null, error_message: null,
          mode,
          message_count: 1, last_message_preview: text.slice(0, 50),
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          messages: [],
        })

        startStream(res.conversation_id, res.assistant_message_id)
        return
      }

      // 追加消息
      const { assistant_message_id } = await api.addMessage(conversation.id, { text, image_paths: imagePaths })
      // 乐观更新本地消息
      setConversation((prev) => prev ? {
        ...prev,
        messages: [...prev.messages, {
          id: 'temp-' + Date.now(), conversation_id: prev.id,
          role: 'user' as const, content: text, has_image: !!imagePaths,
          image_paths: null, created_at: new Date().toISOString(),
        }],
      } : null)

      startStream(conversation.id, assistant_message_id)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: { error_message?: string } } } })?.response?.data?.detail
      toast({ title: '发送失败', description: detail?.error_message || '请配置有效的 Provider 后重试', variant: 'destructive' })
    }
  }, [conversation, defaultProviderId, defaultModelName, toast, startStream])

  // 撤回
  const handleRetract = useCallback(async (msgId: string) => {
    if (!conversation) return
    if (!confirm('撤回将删除此消息及之后的所有消息，确定继续？')) return
    try {
      await api.retractMessage(conversation.id, msgId)
      handleSelect({ id: conversation.id } as Conversation)
      setRefreshTrigger((p) => p + 1)
    } catch {
      toast({ title: '撤回失败', variant: 'destructive' })
    }
  }, [conversation, toast, handleSelect])

  // 修改用户消息并重新生成
  const handleEdit = useCallback(async (msgId: string, text: string) => {
    if (!conversation) return
    try {
      const { assistant_message_id } = await api.editMessage(conversation.id, msgId, { text })

      // 乐观更新：找到被编辑的用户消息，删除它及之后的消息，替换为新内容 + 空 assistant 占位
      setConversation((prev) => {
        if (!prev) return prev
        const idx = prev.messages.findIndex((m) => m.id === msgId)
        if (idx === -1) return prev
        const kept = prev.messages.slice(0, idx)
        const userMsg = {
          ...prev.messages[idx],
          content: text,
        }
        const assistantPlaceholder = {
          id: assistant_message_id, conversation_id: prev.id,
          role: 'assistant' as const, content: '',
          has_image: false, image_paths: null,
          created_at: new Date().toISOString(),
        }
        return { ...prev, messages: [...kept, userMsg, assistantPlaceholder] }
      })

      startStream(conversation.id, assistant_message_id)
    } catch {
      toast({ title: '修改失败', variant: 'destructive' })
    }
  }, [conversation, toast, startStream])

  // 新建空白对话
  const handleNewConversation = () => {
    setSelectedId(null)
    setConversation(null)
    setIsStreaming(false)
    setStreamingMsgId(null)
    setStreamingContent('')
    setStreamDurationMs(null)
    closeStreamRef.current?.()
  }

  // 清理
  useEffect(() => {
    return () => { closeStreamRef.current?.() }
  }, [])

  return (
    <div className="flex h-full">
      {/* 左侧可折叠面板 — 整条到底 */}
      <div
        className={`shrink-0 h-full border-r border-slate-200 bg-white transition-all duration-200 overflow-hidden ${
          sidebarOpen ? 'w-64' : 'w-0'
        }`}
      >
        <ConversationList
          selectedId={selectedId}
          onSelect={handleSelect}
          onNewClick={handleNewConversation}
          refreshTrigger={refreshTrigger}
        />
      </div>

      {/* 右侧：折叠按钮 + 对话区 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 折叠按钮栏 */}
        <div className="h-10 shrink-0 border-b border-slate-200 flex items-center px-3 gap-2 bg-white">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 rounded hover:bg-slate-100 text-slate-500"
            title={sidebarOpen ? '收起列表' : '展开列表'}
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </button>
          <button
            onClick={handleNewConversation}
            className="p-1 rounded hover:bg-slate-100 text-slate-500"
            title="新建对话"
          >
            <Plus className="h-4 w-4" />
          </button>
          {!defaultProviderId && (
            <span className="text-xs text-amber-600 ml-2">请点击右上角齿轮设置模型</span>
          )}
        </div>

        {/* 对话区 */}
        <div className="flex-1 flex flex-col min-h-0">
          {!conversation && !isStreaming ? (
            <>
              {/* 空白首页 */}
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4">
                <MessageSquare className="h-12 w-12 text-slate-300" />
                <div className="text-center">
                  <p className="text-lg font-medium text-slate-600">开始一段新对话</p>
                  <p className="text-sm mt-1">直接输入小说正文或上传文件，AI 将生成剧本</p>
                </div>
              </div>
              {/* 输入框 */}
              <ChatInput onSend={handleSend} isStreaming={false} />
            </>
          ) : (
            <ChatArea
              conversation={conversation}
              streamingMessageId={streamingMsgId}
              streamingContent={streamingContent}
              onSend={handleSend}
              onRetract={handleRetract}
              onEdit={handleEdit}
              isStreaming={isStreaming}
              streamDurationMs={streamDurationMs}
            />
          )}
        </div>
      </div>
    </div>
  )
}
