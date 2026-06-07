/**
 * 结果预览 / 编辑页：
 * - 左：YAML 文本编辑器（textarea，等价于 Monaco 的功能但零依赖）
 * - 右：解析后的场景卡片预览（js-yaml）
 * - 下载、重新生成
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import yaml from 'js-yaml'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAppStore } from '@/stores/appStore'
import { useToast } from '@/components/ui/toast'
import { downloadResult } from '@/api'
import { Download, RotateCcw, Loader2 } from 'lucide-react'

interface ScriptScene {
  id?: string
  location?: string
  time?: string
  characters?: string[]
  action?: string
  dialogues?: Array<{ character: string; line: string; emotion?: string }>
}

interface ScriptDoc {
  title?: string
  author?: string
  scenes?: ScriptScene[]
}

export function ResultPage(): JSX.Element {
  const { taskId = '' } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const currentYaml = useAppStore((s) => s.currentYaml)
  const setCurrentYaml = useAppStore((s) => s.setCurrentYaml)
  const [loading, setLoading] = useState(true)

  /** 首次进入时拉取 YAML（一次性写进 store） */
  useEffect(() => {
    if (currentYaml) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const blobUrl = await downloadResult(taskId)
        const r = await fetch(blobUrl)
        const text = await r.text()
        URL.revokeObjectURL(blobUrl)
        if (!cancelled) {
          setCurrentYaml(text)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          toast({
            title: '加载结果失败',
            description: (e as { detail?: string }).detail,
            variant: 'destructive',
          })
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId])

  /** 解析 YAML 用于预览；解析失败时显示原始文本 */
  const parsed = useMemo<ScriptDoc | null>(() => {
    try {
      return yaml.load(currentYaml) as ScriptDoc | null
    } catch {
      return null
    }
  }, [currentYaml])

  const onDownload = () => {
    const blob = new Blob([currentYaml], { type: 'text/yaml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${taskId}.yaml`
    a.click()
    URL.revokeObjectURL(url)
  }

  const onRegenerate = () => {
    navigate('/')
  }

  if (loading) {
    return (
      <div className="py-16 text-center text-slate-500">
        <Loader2 className="inline h-5 w-5 animate-spin mr-1" />
        正在加载结果...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">剧本结果</h1>
          <p className="text-slate-500 mt-1 font-mono text-xs">{taskId}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onRegenerate}>
            <RotateCcw className="h-4 w-4" />
            重新生成
          </Button>
          <Button onClick={onDownload}>
            <Download className="h-4 w-4" />
            下载 YAML
          </Button>
        </div>
      </div>

      {parsed?.title && (
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <div className="text-lg font-semibold">{parsed.title}</div>
          {parsed.author && <div className="text-sm text-slate-500">作者：{parsed.author}</div>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>YAML</CardTitle>
            <CardDescription>可直接编辑，右侧预览会同步</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={24}
              value={currentYaml}
              onChange={(e) => setCurrentYaml(e.target.value)}
              className="font-mono text-xs leading-relaxed"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>预览</CardTitle>
            <CardDescription>
              {parsed ? `共 ${parsed.scenes?.length ?? 0} 个场景` : 'YAML 解析失败，请检查格式'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!parsed ? (
              <div className="text-sm text-red-600">YAML 格式错误，无法解析</div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {(parsed.scenes ?? []).map((s, i) => (
                  <div key={i} className="rounded-md border border-slate-200 p-3 text-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">
                        场景 {i + 1}：{s.location ?? '未命名场景'}
                      </div>
                      {s.time && <div className="text-xs text-slate-500">{s.time}</div>}
                    </div>
                    {s.characters && s.characters.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {s.characters.map((c) => (
                          <span key={c} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                    {s.action && <div className="text-xs text-slate-600 italic">{s.action}</div>}
                    {s.dialogues && s.dialogues.length > 0 && (
                      <div className="space-y-1 border-l-2 border-slate-200 pl-3">
                        {s.dialogues.map((d, j) => (
                          <div key={j} className="text-xs">
                            <span className="font-semibold text-slate-800">{d.character}：</span>
                            <span className="text-slate-700">{d.line}</span>
                            {d.emotion && <span className="ml-1 text-slate-400">（{d.emotion}）</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
