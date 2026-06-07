/**
 * 底部输入区域：文本输入 + 文件上传（txt/docx/pdf/图片） + 发送按钮
 */
import { useState, useCallback, useRef } from 'react'
import { Send, Paperclip, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { http } from '@/api/client'

interface Props {
  onSend: (text: string, imagePaths?: string[]) => void
  disabled?: boolean
  isStreaming?: boolean
}

/** 上传后返回的文件信息 */
interface UploadedFile {
  filename: string
  content: string
  type: 'text' | 'image'
}

export function ChatInput({ onSend, disabled, isStreaming }: Props) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

    onSend(finalText, imagePaths.length > 0 ? imagePaths : undefined)
    setText('')
    setFiles([])
  }, [text, files, isStreaming, onSend])

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

    setFiles((prev) => [...prev, ...newFiles])
    setUploading(false)
    // 重置 input 以允许重复选同一个文件
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="border-t border-slate-200 bg-white p-4">
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
          placeholder={isStreaming ? 'AI 正在生成中...' : '输入小说正文或修改指令...'}
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
