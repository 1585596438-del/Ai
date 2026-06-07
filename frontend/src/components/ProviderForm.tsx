/**
 * Provider 表单：用于新增 / 编辑 AI Provider
 * 受控组件，提交时回调 onSubmit
 */
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Provider, ProviderCreate } from '@/types'
import { fetchModels } from '@/api'
import { useToast } from '@/components/ui/toast'
import { CheckCircle2, Loader2 } from 'lucide-react'

export interface ProviderFormProps {
  initial?: Provider
  onSubmit: (data: ProviderCreate) => Promise<void> | void
  onCancel: () => void
}

export function ProviderForm({ initial, onSubmit, onCancel }: ProviderFormProps): JSX.Element {
  const { toast } = useToast()
  const [name, setName] = useState(initial?.name ?? '')
  const [baseUrl, setBaseUrl] = useState(initial?.base_url ?? 'https://api.deepseek.com')
  const [apiKey, setApiKey] = useState('')
  const [modelsText, setModelsText] = useState(initial?.models.join(', ') ?? '')
  const [isDefault, setIsDefault] = useState(initial?.is_default ?? false)
  const [fetchedModels, setFetchedModels] = useState<string[]>([])
  const [fetching, setFetching] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // 编辑时不允许显示原 key（后端不返回 api_key），但模型列表可直接显示
  useEffect(() => {
    if (initial) {
      setFetchedModels(initial.models)
    }
  }, [initial])

  /** 根据 base_url + api_key 拉取模型列表 */
  const onFetchModels = async () => {
    if (!apiKey) {
      toast({ title: '请先填写 API Key', variant: 'destructive' })
      return
    }
    setFetching(true)
    try {
      const r = await fetchModels(baseUrl, apiKey)
      setFetchedModels(r.models)
      toast({ title: `拉取到 ${r.models.length} 个模型`, variant: 'success' })
    } catch (e) {
      const msg = (e as { detail?: string }).detail ?? '拉取失败'
      toast({ title: '拉取模型失败', description: msg, variant: 'destructive' })
    } finally {
      setFetching(false)
    }
  }

  const onSubmitClick = async () => {
    if (!name || !baseUrl) {
      toast({ title: '名称与 Base URL 必填', variant: 'destructive' })
      return
    }
    // 模型列表优先用「拉取」得到的，回退到用户输入的逗号列表
    const models = fetchedModels.length
      ? fetchedModels
      : modelsText.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean)
    if (!models.length) {
      toast({ title: '请至少选择一个模型', variant: 'destructive' })
      return
    }
    // 编辑时不要求重新填 api_key
    const finalKey = apiKey || (initial ? '__KEEP_EXISTING__' : '')
    if (!finalKey) {
      toast({ title: '请填写 API Key', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      await onSubmit({
        name,
        base_url: baseUrl,
        api_key: finalKey,
        models,
        is_default: isDefault,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="pf-name">名称</Label>
        <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="例：DeepSeek" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pf-url">Base URL</Label>
        <Input
          id="pf-url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.deepseek.com"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pf-key">
          API Key{initial && <span className="ml-1 text-xs text-slate-500">（编辑时留空则保留原 key）</span>}
        </Label>
        <div className="flex gap-2">
          <Input
            id="pf-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
          />
          <Button type="button" variant="outline" onClick={onFetchModels} disabled={fetching}>
            {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : '拉取模型'}
          </Button>
        </div>
      </div>

      {fetchedModels.length > 0 && (
        <div className="space-y-1.5">
          <Label>可用模型（{fetchedModels.length}）</Label>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs max-h-40 overflow-y-auto space-y-1">
            {fetchedModels.map((m) => (
              <div key={m} className="font-mono text-slate-700">
                {m}
              </div>
            ))}
          </div>
        </div>
      )}

      {!fetchedModels.length && (
        <div className="space-y-1.5">
          <Label htmlFor="pf-models">模型列表（逗号分隔）</Label>
          <Input
            id="pf-models"
            value={modelsText}
            onChange={(e) => setModelsText(e.target.value)}
            placeholder="deepseek-chat, deepseek-coder"
          />
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="rounded" />
        设为默认 Provider
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          取消
        </Button>
        <Button onClick={onSubmitClick} disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          保存
        </Button>
      </div>
    </div>
  )
}
