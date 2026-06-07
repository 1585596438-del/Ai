/**
 * 首页：小说文本输入
 * - 标题 / 作者（可选）
 * - 大文本框：直接粘贴 或 选择 .txt/.md 文件（通过后端 /api/files/read）
 * - 校验：≥1000 字且能解析 ≥3 章节（前端粗略估算）
 * - 「下一步」按钮：保存到 store，跳到 /convert
 */
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAppStore } from '@/stores/appStore'
import { useToast } from '@/components/ui/toast'
import { FileUp, ArrowRight } from 'lucide-react'

/** 粗略解析章节：匹配「第X章」「Chapter N」等 */
function countChapters(text: string): number {
  const patterns = [/^\s*第[一二三四五六七八九十百千0-9]+章/gm, /^\s*Chapter\s+\d+/gim]
  let total = 0
  for (const p of patterns) {
    const m = text.match(p)
    if (m) total += m.length
  }
  return total
}

export function HomePage(): JSX.Element {
  const navigate = useNavigate()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const novelInput = useAppStore((s) => s.novelInput)
  const setNovelInput = useAppStore((s) => s.setNovelInput)

  /** 处理用户选择本地文件 */
  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      // Electron 环境下用 IPC 走主进程（避免暴露任意文件读取）
      // 浏览器环境下用 FileReader 直读
      const electronAPI = (window as unknown as { electronAPI?: { readFile: (p: string) => Promise<string> } }).electronAPI
      const content = electronAPI
        ? await electronAPI.readFile((file as unknown as { path?: string }).path ?? file.name)
        : await file.text()
      setNovelInput({ text: content })
      if (!novelInput.title) {
        // 自动从文件名提取标题
        const baseName = file.name.replace(/\.(txt|md)$/i, '')
        setNovelInput({ title: baseName })
      }
      toast({ title: '已加载文件', description: file.name, variant: 'success' })
    } catch (err) {
      const msg = (err as { detail?: string }).detail ?? '读取失败'
      toast({ title: '文件读取失败', description: msg, variant: 'destructive' })
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  /** 下一步：校验后跳转 */
  const onNext = () => {
    const len = novelInput.text.length
    const chapters = countChapters(novelInput.text)
    if (len < 1000) {
      toast({ title: '正文过短', description: `当前 ${len} 字，至少需要 1000 字`, variant: 'destructive' })
      return
    }
    if (chapters < 3) {
      toast({
        title: '章节过少',
        description: `解析到 ${chapters} 个章节，至少需要 3 个（确保使用「第X章」或「Chapter N」格式）`,
        variant: 'destructive',
      })
      return
    }
    navigate('/convert')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">开始一次转换</h1>
        <p className="text-slate-500 mt-1">粘贴或加载中文网络小说，AI 将自动解析并生成结构化剧本</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>小说信息</CardTitle>
          <CardDescription>标题和作者为可选项，正文为必填</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">标题</Label>
              <Input
                id="title"
                placeholder="例：天龙八部"
                value={novelInput.title}
                onChange={(e) => setNovelInput({ title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="author">作者</Label>
              <Input
                id="author"
                placeholder="例：金庸"
                value={novelInput.author}
                onChange={(e) => setNovelInput({ author: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="text">正文（{novelInput.text.length} 字 · {countChapters(novelInput.text)} 章节）</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
              >
                <FileUp className="h-4 w-4" />
                选择文件
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                className="hidden"
                onChange={onPickFile}
              />
            </div>
            <Textarea
              id="text"
              rows={20}
              placeholder="请粘贴小说正文，或点击「选择文件」加载本地 .txt / .md..."
              value={novelInput.text}
              onChange={(e) => setNovelInput({ text: e.target.value })}
              className="font-mono text-sm leading-relaxed"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onNext} size="lg" disabled={busy}>
          下一步：选择模型
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
