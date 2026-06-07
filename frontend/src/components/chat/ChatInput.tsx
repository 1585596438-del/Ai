/**
 * 底部输入区域：文本输入 + 文件上传（txt/docx/pdf/图片） + 发送按钮
 * 支持小说文件检测：上传小说文件时自动进入小说转剧本模式
 */
import { useState, useCallback, useRef } from 'react'
import { Send, Paperclip, Loader2, X, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { http } from '@/api/client'

/** 小说最大允许字数 */
const NOVEL_MAX_CHARS = 15000

interface Props {
  onSend: (text: string, imagePaths?: string[], mode?: 'default' | 'novel_to_script') => void
  disabled?: boolean
  isStreaming?: boolean
}

/** 上传后返回的文件信息 */
interface UploadedFile {
  filename: string
  content: string
  type: 'text' | 'image'
}

/** 检测文件是否为小说文本（.txt 文件且内容较长） */
function isNovelFile(filename: string, content: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext !== 'txt' && ext !== 'md') return false
  // 超过 500 字视为小说文本
  return content.length > 500
}

export function ChatInput({ onSend, disabled, isStreaming }: Props) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [novelMode, setNovelMode] = useState(false)
  const [charCount, setCharCount] = useState(0)
  const [showTruncationWarning, setShowTruncationWarning] = useState(false)
  const [pendingNovelText, setPendingNovelText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  /** 计算并显示小说字数信息 */
  const updateNovelInfo = useCallback((uploadedFiles: UploadedFile[]) => {
    const novelFile = uploadedFiles.find((f) => f.type === 'text' && isNovelFile(f.filename, f.content))
    if (novelFile) {
      const totalChars = novelFile.content.length
      setNovelMode(true)
      setCharCount(totalChars)
      if (totalChars > NOVEL_MAX_CHARS) {
        setShowTruncationWarning(true)
        setPendingNovelText(novelFile.content)
      }
    } else {
      setNovelMode(false)
      setCharCount(0)
      setShowTruncationWarning(false)
      setPendingNovelText('')
    }
  }, [])

  /** 继续生成（截取前 15000 字） */
  const handleTruncateAndSend = useCallback(() => {
    const truncatedText = pendingNovelText.slice(0, NOVEL_MAX_CHARS)
    // 替换待发送的小说文件内容
    setFiles((prev) =>
      prev.map((f) =>
        f.type === 'text' && isNovelFile(f.filename, f.content)
          ? { ...f, content: truncatedText }
          : f
      )
    )
    setShowTruncationWarning(false)
    setPendingNovelText('')
    setCharCount(NOVEL_MAX_CHARS)
  }, [pendingNovelText])

  /** 取消截取，恢复原始文件 */
  const handleCancelTruncation = useCallback(() => {
    setShowTruncationWarning(false)
    setPendingNovelText('')
  }, [])

  const handleSend = useCallback(() => {
    const hasContent = text.trim() || files.some((f) => f.type === 'text')
    if (!hasContent || isStreaming) return

    // 拼合文本内容：输入的文本 + 上传的文本文件内容
    let finalText = text.trim()
    const imagePaths: string[] = []

    for (const f of files) {
      if (f.type === 'text') {
        finalText = finalText ? finalText + '\n\n' + f.content : f.content
      } else {
        imagePaths.push(f.content)
      }
    }

    if (!finalText && imagePaths.length === 0) return

    // 检测是否为小说转剧本模式
    const detectedMode = novelMode ? 'novel_to_script' : 'default'
    onSend(finalText, imagePaths.length > 0 ? imagePaths : undefined, detectedMode)
    setText('')
    setFiles([])
    setNovelMode(false)
    setCharCount(0)
  }, [text, files, isStreaming, novelMode, onSend])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  /** 上传文件 */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (!selectedFiles || selectedFiles.length === 0) return

    setUploading(true)
    const newFiles: UploadedFile[] = []

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i]
      try {
        const formData = new FormData()
        formData.append('file', file)
        const resp = await http.post<UploadedFile>('/files/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        newFiles.push(resp.data)
      } catch {
        // 忽略单个文件失败
      }
    }

    const updatedFiles = [...files, ...newFiles]
    setFiles(updatedFiles)
    updateNovelInfo(updatedFiles)
    setUploading(false)
    // 重置 input 以允许重复选同一个文件
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = (index: number) => {
    const updatedFiles = files.filter((_, i) => i !== index)
    setFiles(updatedFiles)
    updateNovelInfo(updatedFiles)
  }

  return (
    <div className="border-t border-slate-200 bg-white p-4">
      {/* 小说模式提示 */}
      {novelMode && !showTruncationWarning && (
        <div className="mb-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-xs flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            已检测到小说文本（{charCount.toLocaleString()} 字），将进入「小说转剧本」模式
            {charCount > NOVEL_MAX_CHARS && (
              <> · 超过 {NOVEL_MAX_CHARS.toLocaleString()} 字的部分将被截断</>
            )}
          </span>
        </div>
      )}

      {/* 字数超限警告 */}
      {showTruncationWarning && (
        <div className="mb-2 px-3 py-2 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium">
              小说字数 {charCount.toLocaleString()} 字，超过上限 {NOVEL_MAX_CHARS.toLocaleString()} 字
            </span>
          </div>
          <p className="mb-2 ml-5">
            超出的 {(charCount - NOVEL_MAX_CHARS).toLocaleString()} 字将被截断。请确认操作：
          </p>
          <div className="flex gap-2 ml-5">
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs"
              onClick={handleTruncateAndSend}
            >
              继续生成（截取前 {NOVEL_MAX_CHARS.toLocaleString()} 字）
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs"
              onClick={handleCancelTruncation}
            >
              取消，重新上传
            </Button>
          </div>
        </div>
      )}

      {/* 已上传文件预览 */}
      {files.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap">
          {files.map((f, i) => (
            <div
              key={i}
              className={cn(
                'text-xs px-2 py-1 rounded flex items-center gap-1 max-w-[200px]',
                f.type === 'image' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700',
              )}
            >
              <span className="truncate">{f.type === 'image' ? '图片' : f.filename}</span>
              {f.type === 'text' && isNovelFile(f.filename, f.content) && (
                <span className="shrink-0 text-[10px] opacity-60">
                  {f.content.length.toLocaleString()} 字
                </span>
              )}
              <button
                onClick={() => removeFile(i)}
                className="shrink-0 hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* 文件上传按钮 */}
        <div className="shrink-0">
          <label
            className={cn(
              'flex items-center justify-center w-9 h-9 rounded-md border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors',
              uploading && 'opacity-50 cursor-wait',
            )}
            title="上传文件（txt/docx/pdf/图片）"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            ) : (
              <Paperclip className="h-4 w-4 text-slate-500" />
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.docx,.pdf,.png,.jpg,.jpeg,.gif,.webp"
              multiple
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
        </div>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isStreaming ? 'AI 正在生成中...' : novelMode ? '输入修改指令或补充信息...' : '输入小说正文或修改指令...'}
          className="min-h-[40px] max-h-[120px] resize-none"
          rows={1}
          disabled={disabled || isStreaming}
        />

        <Button
          onClick={handleSend}
          size="icon"
          disabled={(!text.trim() && !files.some((f) => f.type === 'text')) || isStreaming}
          className="shrink-0"
        >
          {isStreaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}
