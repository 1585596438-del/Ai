/**
 * 转换配置页：选 Provider → 选模型 → 开始转换
 * 提交后：调 /api/convert 拿 taskId，跳到 /progress/:taskId 并打开 SSE
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useAppStore } from '@/stores/appStore'
import { useToast } from '@/components/ui/toast'
import { submitConvert } from '@/api'
import { ArrowRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ConvertPage(): JSX.Element {
  const navigate = useNavigate()
  const { toast } = useToast()
  const providers = useAppStore((s) => s.providers)
  const fetchProviders = useAppStore((s) => s.fetchProviders)
  const novelInput = useAppStore((s) => s.novelInput)
  const setCurrentTask = useAppStore((s) => s.setCurrentTask)

  const [providerId, setProviderId] = useState<string>('')
  const [model, setModel] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (providers.length === 0) {
      fetchProviders().catch(() => {
        toast({ title: '加载 Provider 失败', variant: 'destructive' })
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 默认选中默认 Provider
  useEffect(() => {
    if (!providerId && providers.length) {
      const def = providers.find((p) => p.is_default) ?? providers[0]
      setProviderId(def.id)
      if (def.models.length) setModel(def.models[0])
    }
  }, [providers, providerId])

  // 切换 Provider 时重置 model
  useEffect(() => {
    const p = providers.find((x) => x.id === providerId)
    if (p && (!model || !p.models.includes(model))) {
      setModel(p.models[0] ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId])

  const currentProvider = providers.find((p) => p.id === providerId)

  const onStart = async () => {
    if (!novelInput.text) {
      toast({ title: '请先到「开始转换」页输入小说正文', variant: 'destructive' })
      return
    }
    if (!providerId) {
      toast({ title: '请选择 Provider', variant: 'destructive' })
      return
    }
    if (!model) {
      toast({ title: '请选择模型', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      // 注意：与后端 Pydantic ConvertRequest 对齐，novel 字段必须嵌套
      const r = await submitConvert({
        novel: {
          text: novelInput.text,
          title: novelInput.title || undefined,
          author: novelInput.author || undefined,
        },
        provider_id: providerId,
        model,
      })
      setCurrentTask(r.task_id, r.status)
      navigate(`/progress/${r.task_id}`)
    } catch (e) {
      toast({ title: '提交失败', description: (e as { detail?: string }).detail, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  if (providers.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">选择模型</h1>
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            <p>还没有可用的 Provider</p>
            <Button className="mt-4" onClick={() => navigate('/providers')}>
              去配置 Provider
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">选择模型</h1>
        <p className="text-slate-500 mt-1">选择 AI Provider 与模型，开始转换「{novelInput.title || '未命名小说'}」</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Provider</CardTitle>
          <CardDescription>已配置 {providers.length} 个，选择其中一个</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {providers.map((p) => (
              <label
                key={p.id}
                className={cn(
                  'flex items-center gap-3 rounded-md border p-3 cursor-pointer transition-colors',
                  providerId === p.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:bg-slate-50',
                )}
              >
                <input
                  type="radio"
                  name="provider"
                  value={p.id}
                  checked={providerId === p.id}
                  onChange={() => setProviderId(p.id)}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm flex items-center gap-1.5">
                    {p.name}
                    {p.is_default && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">默认</span>}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{p.base_url}</div>
                </div>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {currentProvider && (
        <Card>
          <CardHeader>
            <CardTitle>模型</CardTitle>
            <CardDescription>来自「{currentProvider.name}」的 {currentProvider.models.length} 个模型</CardDescription>
          </CardHeader>
          <CardContent>
            <Label htmlFor="model-select" className="sr-only">模型</Label>
            <select
              id="model-select"
              className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {currentProvider.models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button size="lg" onClick={onStart} disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          开始转换
        </Button>
      </div>
    </div>
  )
}
