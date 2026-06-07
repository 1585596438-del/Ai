/**
 * 设置弹窗：选默认 Provider + Model + API Key 管理
 */
import { useState, useEffect, useCallback } from 'react'
import { X, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppStore } from '@/stores/appStore'
import { useToast } from '@/components/ui/toast'
import * as api from '@/api'

interface Props {
  onClose: () => void
}

export function SettingsDialog({ onClose }: Props) {
  const { toast } = useToast()
  const providers = useAppStore((s) => s.providers)
  const addProvider = useAppStore((s) => s.addProvider)
  const removeProvider = useAppStore((s) => s.removeProvider)
  const defaultProviderId = useAppStore((s) => s.defaultProviderId)
  const defaultModelName = useAppStore((s) => s.defaultModelName)
  const setDefaults = useAppStore((s) => s.setDefaults)

  const [selectedProviderId, setSelectedProviderId] = useState(defaultProviderId)
  const [selectedModel, setSelectedModel] = useState(defaultModelName)
  const [models, setModels] = useState<string[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)

  // 新增 Provider 表单
  const [newName, setNewName] = useState('')
  const [newBaseUrl, setNewBaseUrl] = useState('https://api.openai.com')
  const [newApiKey, setNewApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [adding, setAdding] = useState(false)

  // 切换 Provider 时拉取模型列表
  const loadModels = useCallback(async (providerId: string) => {
    const p = providers.find((pr) => pr.id === providerId)
    if (!p) { setModels([]); return }

    setModelsLoading(true)
    try {
      // 如果 Provider 已有 models 列表，直接用
      if (p.models && p.models.length > 0) {
        setModels(p.models)
        return
      }
      // 尝试从远端拉取（需要 api_key，这里通过后端缓存获取）
      const res = await api.fetchModels(p.base_url, '')
      setModels(res.models)
    } catch {
      setModels(p.models || [])
    } finally {
      setModelsLoading(false)
    }
  }, [providers])

  useEffect(() => {
    if (selectedProviderId) loadModels(selectedProviderId)
  }, [selectedProviderId, loadModels])

  const handleAddProvider = async () => {
    if (!newName || !newBaseUrl || !newApiKey) return
    setAdding(true)
    try {
      const p = await addProvider({
        name: newName,
        base_url: newBaseUrl,
        api_key: newApiKey,
        models: [],
        is_default: providers.length === 0,
      })
      setNewName('')
      setNewBaseUrl('https://api.openai.com')
      setNewApiKey('')
      setSelectedProviderId(p.id)
      toast({ title: '已添加 Provider', variant: 'success' })
    } catch {
      toast({ title: '添加失败', variant: 'destructive' })
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteProvider = async (id: string) => {
    if (!confirm('确定删除此 Provider？')) return
    try {
      await removeProvider(id)
      if (selectedProviderId === id) {
        setSelectedProviderId('')
        setSelectedModel('')
      }
      toast({ title: '已删除', variant: 'success' })
    } catch {
      toast({ title: '删除失败', variant: 'destructive' })
    }
  }

  const handleSave = () => {
    setDefaults(selectedProviderId, selectedModel)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-6 space-y-5">
        {/* 标题 */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">设置</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 已保存的 Provider 列表 */}
        <div className="space-y-2">
          <Label>已配置的 AI Provider</Label>
          {providers.length === 0 && (
            <p className="text-sm text-slate-400">暂无，请在下方添加</p>
          )}
          {providers.map((p) => (
            <div
              key={p.id}
              className={`flex items-center justify-between p-2 rounded border cursor-pointer text-sm ${
                selectedProviderId === p.id ? 'border-blue-400 bg-blue-50' : 'border-slate-200'
              }`}
              onClick={() => setSelectedProviderId(p.id)}
            >
              <div className="truncate flex-1">
                <span className="font-medium">{p.name}</span>
                <span className="text-slate-400 ml-2 text-xs">{p.base_url}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteProvider(p.id) }}
                className="text-xs text-red-500 hover:text-red-700 shrink-0 ml-2"
              >
                删除
              </button>
            </div>
          ))}
        </div>

        {/* 模型选择 */}
        {selectedProviderId && (
          <div className="space-y-1.5">
            <Label>默认模型</Label>
            <select
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={modelsLoading}
            >
              <option value="">{modelsLoading ? '加载中...' : '-- 选择模型 --'}</option>
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        )}

        {/* 新增 Provider */}
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <Label>添加新 Provider</Label>
          <Input
            placeholder="名称（如 OpenAI）"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Input
            placeholder="Base URL（如 https://api.openai.com）"
            value={newBaseUrl}
            onChange={(e) => setNewBaseUrl(e.target.value)}
          />
          <div className="relative">
            <Input
              type={showApiKey ? 'text' : 'password'}
              placeholder="API Key"
              value={newApiKey}
              onChange={(e) => setNewApiKey(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
            >
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button
            onClick={handleAddProvider}
            disabled={adding || !newName || !newBaseUrl || !newApiKey}
            size="sm"
            className="w-full"
          >
            {adding ? '添加中...' : '添加 Provider'}
          </Button>
        </div>

        {/* 保存 */}
        <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSave} disabled={!selectedProviderId || !selectedModel}>
            保存设置
          </Button>
        </div>
      </div>
    </div>
  )
}
