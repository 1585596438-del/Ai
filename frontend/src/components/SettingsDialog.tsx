/**
 * 设置弹窗：Provider 列表管理 + 模型列表管理
 * 支持添加/编辑/删除/测试模型，以及启用/禁用切换
 */
import { useState, useEffect, useCallback } from 'react'
import { 
  X, Plus, TestTube2, Pencil, Trash2, 
  CheckCircle2, Loader2, 
  ChevronDown, ChevronRight, Eye, EyeOff
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppStore } from '@/stores/appStore'
import { useToast } from '@/components/ui/toast'
import * as api from '@/api'
import type { Provider, ProviderUpdate } from '@/types'

interface Props {
  onClose: () => void
}

/** 模型配置项 */
interface ModelConfig {
  name: string
  enabled: boolean
}

export function SettingsDialog({ onClose }: Props) {
  const { toast } = useToast()
  const providers = useAppStore((s) => s.providers)
  const addProvider = useAppStore((s) => s.addProvider)
  const removeProvider = useAppStore((s) => s.removeProvider)
  const updateProvider = useAppStore((s) => s.updateProvider)
  const defaultProviderId = useAppStore((s) => s.defaultProviderId)
  const defaultModelName = useAppStore((s) => s.defaultModelName)
  const setDefaults = useAppStore((s) => s.setDefaults)

  // Provider 选择
  const [selectedProviderId, setSelectedProviderId] = useState(defaultProviderId)
  const [selectedModel, setSelectedModel] = useState(defaultModelName)
  
  // 模型列表状态
  const [models, setModels] = useState<ModelConfig[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  
  // 展开/收起 Provider
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set([defaultProviderId]))

  // 新增 Provider 表单
  const [showAddProvider, setShowAddProvider] = useState(false)
  const [newName, setNewName] = useState('')
  const [newBaseUrl, setNewBaseUrl] = useState('https://api.openai.com')
  const [newApiKey, setNewApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [adding, setAdding] = useState(false)

  // 编辑 Provider 表单
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null)
  const [editName, setEditName] = useState('')
  const [editBaseUrl, setEditBaseUrl] = useState('')
  const [editApiKey, setEditApiKey] = useState('')
  const [showEditApiKey, setShowEditApiKey] = useState(false)
  const [editing, setEditing] = useState(false)

  // 添加/编辑模型弹窗
  const [showModelDialog, setShowModelDialog] = useState(false)
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null)
  const [modelName, setModelName] = useState('')
  const [modelEnabled, setModelEnabled] = useState(true)

  // 测试状态
  const [testingModel, setTestingModel] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Map<string, boolean>>(new Map())

  /** 切换 Provider 展开/收起 */
  const toggleProviderExpanded = (providerId: string) => {
    setExpandedProviders(prev => {
      const next = new Set(prev)
      if (next.has(providerId)) {
        next.delete(providerId)
      } else {
        next.add(providerId)
      }
      return next
    })
  }

  /** 切换 Provider 选中状态 */
  const handleSelectProvider = async (providerId: string) => {
    setSelectedProviderId(providerId)
    // 自动展开选中的 Provider
    setExpandedProviders(prev => new Set([...prev, providerId]))
    await loadModels(providerId)
  }

  /** 加载 Provider 的模型列表 */
  const loadModels = useCallback(async (providerId: string) => {
    const provider = providers.find((p) => p.id === providerId)
    if (!provider) {
      setModels([])
      return
    }

    setModelsLoading(true)
    try {
      // 将 provider.models 转换为 ModelConfig 格式，根据默认模型设置启用状态
      const modelConfigs: ModelConfig[] = provider.models.map(name => ({
        name,
        enabled: name === defaultModelName && providerId === defaultProviderId
      }))
      setModels(modelConfigs)
    } catch {
      setModels([])
    } finally {
      setModelsLoading(false)
    }
  }, [providers, defaultModelName, defaultProviderId])

  useEffect(() => {
    if (selectedProviderId) {
      loadModels(selectedProviderId)
    }
  }, [selectedProviderId, loadModels])

  /** 添加新 Provider */
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
      setShowAddProvider(false)
      setSelectedProviderId(p.id)
      toast({ title: '已添加 Provider', variant: 'success' })
    } catch (e) {
      const msg = (e as { detail?: string }).detail ?? '未知错误'
      toast({ title: '添加失败', description: msg, variant: 'destructive' })
    } finally {
      setAdding(false)
    }
  }

  /** 删除 Provider */
  const handleDeleteProvider = async (providerId: string) => {
    if (!confirm('确定删除此 Provider？删除后模型配置将丢失。')) return
    try {
      await removeProvider(providerId)
      if (selectedProviderId === providerId) {
        setSelectedProviderId('')
        setSelectedModel('')
        setModels([])
      }
      toast({ title: '已删除', variant: 'success' })
    } catch (e) {
      const msg = (e as { detail?: string }).detail ?? '未知错误'
      toast({ title: '删除失败', description: msg, variant: 'destructive' })
    }
  }

  /** 打开编辑 Provider 表单 */
  const openEditProviderForm = (provider: Provider) => {
    setEditingProvider(provider)
    setEditName(provider.name)
    setEditBaseUrl(provider.base_url)
    setEditApiKey('')
    setShowEditApiKey(false)
  }

  /** 保存编辑后的 Provider */
  const handleEditProvider = async () => {
    if (!editingProvider || !editName || !editBaseUrl) return
    setEditing(true)
    try {
      const updateData: ProviderUpdate = {
        name: editName,
        base_url: editBaseUrl,
      }
      if (editApiKey) {
        updateData.api_key = editApiKey
      }
      await updateProvider(editingProvider.id, updateData)
      setEditingProvider(null)
      toast({ title: '已更新 Provider', variant: 'success' })
    } catch (e) {
      const msg = (e as { detail?: string }).detail ?? '未知错误'
      toast({ title: '更新失败', description: msg, variant: 'destructive' })
    } finally {
      setEditing(false)
    }
  }

  /** 打开添加模型弹窗 */
  const openAddModelDialog = () => {
    setEditingModel(null)
    setModelName('')
    setModelEnabled(true)
    setShowModelDialog(true)
  }

  /** 打开编辑模型弹窗 */
  const openEditModelDialog = (model: ModelConfig) => {
    setEditingModel(model)
    setModelName(model.name)
    setModelEnabled(model.enabled)
    setShowModelDialog(true)
  }

  /** 保存模型（添加或编辑） */
  const handleSaveModel = async () => {
    if (!modelName.trim() || !selectedProviderId) return
    
    const provider = providers.find(p => p.id === selectedProviderId)
    if (!provider) return

    let updatedModels: string[]
    if (editingModel) {
      // 编辑模式：替换原模型名
      updatedModels = provider.models.map(m => 
        m === editingModel.name ? modelName.trim() : m
      )
    } else {
      // 添加模式：检查重名
      if (provider.models.includes(modelName.trim())) {
        toast({ title: '模型名称已存在', variant: 'destructive' })
        return
      }
      updatedModels = [...provider.models, modelName.trim()]
    }

    try {
      await updateProvider(selectedProviderId, { models: updatedModels })
      await loadModels(selectedProviderId)
      setShowModelDialog(false)
      toast({ title: editingModel ? '模型已更新' : '模型已添加', variant: 'success' })
    } catch (e) {
      const msg = (e as { detail?: string }).detail ?? '未知错误'
      toast({ title: '保存失败', description: msg, variant: 'destructive' })
    }
  }

  /** 删除模型 */
  const handleDeleteModel = async (modelNameToDelete: string) => {
    if (!selectedProviderId) return
    if (!confirm(`确定删除模型 "${modelNameToDelete}"？`)) return

    const provider = providers.find(p => p.id === selectedProviderId)
    if (!provider) return

    const updatedModels = provider.models.filter(m => m !== modelNameToDelete)
    try {
      await updateProvider(selectedProviderId, { models: updatedModels })
      await loadModels(selectedProviderId)
      // 如果删除的是默认模型，清空默认设置
      if (defaultModelName === modelNameToDelete) {
        setDefaults(selectedProviderId, '')
      }
      toast({ title: '已删除', variant: 'success' })
    } catch (e) {
      const msg = (e as { detail?: string }).detail ?? '未知错误'
      toast({ title: '删除失败', description: msg, variant: 'destructive' })
    }
  }

  /** 测试模型连通性 */
  const handleTestModel = async (modelToTest: string) => {
    if (!selectedProviderId) return
    setTestingModel(modelToTest)
    try {
      await api.testProvider(selectedProviderId)
      setTestResults(prev => new Map(prev).set(modelToTest, true))
      toast({ title: `${modelToTest} 测试成功`, variant: 'success' })
    } catch (e) {
      const msg = (e as { detail?: string }).detail ?? '未知错误'
      setTestResults(prev => new Map(prev).set(modelToTest, false))
      toast({ title: `${modelToTest} 测试失败`, description: msg, variant: 'destructive' })
    } finally {
      setTestingModel(null)
    }
  }

  /** 启用指定模型（设为当前默认模型） */
  const handleEnableModel = (modelName: string) => {
    if (!selectedProviderId) return
    setModels(prev => prev.map(m => ({
      ...m,
      enabled: m.name === modelName
    })))
    setSelectedModel(modelName)
    setDefaults(selectedProviderId, modelName)
    toast({ title: `已启用模型: ${modelName}`, variant: 'success' })
  }

  /** 保存设置并关闭 */
  const handleSave = () => {
    setDefaults(selectedProviderId, selectedModel)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold">模型管理</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Provider 列表 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-600">AI Provider 列表</Label>
            
            {providers.length === 0 ? (
              <p className="text-sm text-slate-400">暂无 Provider，请先添加</p>
            ) : (
              providers.map((provider) => {
                const isExpanded = expandedProviders.has(provider.id)
                const isSelected = selectedProviderId === provider.id
                
                return (
                  <div key={provider.id} className="border border-slate-200 rounded-lg overflow-hidden">
                    {/* Provider 头部 */}
                    <div
                      className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-slate-50'
                      }`}
                      onClick={() => handleSelectProvider(provider.id)}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleProviderExpanded(provider.id)
                          }}
                          className="p-0.5 hover:bg-slate-200 rounded"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-slate-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-slate-500" />
                          )}
                        </button>
                        <div className="truncate">
                          <span className="font-medium text-sm">{provider.name}</span>
                          <span className="text-slate-400 ml-2 text-xs">{provider.base_url}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditProviderForm(provider)
                          }}
                          className="p-1 hover:bg-blue-100 rounded text-blue-500 hover:text-blue-600"
                          title="编辑 Provider"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteProvider(provider.id)
                          }}
                          className="p-1 hover:bg-red-100 rounded text-red-500 hover:text-red-600"
                          title="删除 Provider"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Provider 展开内容 - 模型列表 */}
                    {isExpanded && isSelected && (
                      <div className="border-t border-slate-100 bg-slate-50">
                        {/* 添加模型按钮 */}
                        <div className="px-3 py-2 border-b border-slate-100">
                          <Button
                            onClick={openAddModelDialog}
                            size="sm"
                            variant="outline"
                            className="w-full justify-center gap-2"
                          >
                            <Plus className="h-4 w-4" />
                            添加模型
                          </Button>
                        </div>

                        {/* 模型列表 */}
                        <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                          {modelsLoading ? (
                            <div className="flex items-center justify-center py-6 text-slate-400">
                              <Loader2 className="h-5 w-5 animate-spin mr-2" />
                              加载中...
                            </div>
                          ) : models.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 text-sm">
                              暂无模型，点击上方按钮添加
                            </div>
                          ) : (
                            models.map((model) => {
                              const testResult = testResults.get(model.name)
                              const isTesting = testingModel === model.name
                              
                              return (
                                <div
                                  key={model.name}
                                  className="flex items-center justify-between px-3 py-2.5 hover:bg-white transition-colors"
                                >
                                  {/* 模型信息 */}
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <button
                                      onClick={() => handleEnableModel(model.name)}
                                      className={`p-1 rounded transition-colors ${
                                        model.enabled 
                                          ? 'text-green-500 hover:bg-green-100' 
                                          : 'text-slate-300 hover:bg-slate-200 hover:text-green-500'
                                      }`}
                                      title={model.enabled ? '当前使用中' : '点击启用'}
                                    >
                                      <CheckCircle2 className="h-4 w-4" />
                                    </button>
                                    <span className={`text-sm truncate ${model.enabled ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                                      {model.name}
                                    </span>
                                    {model.enabled && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-600 font-medium">使用中</span>
                                    )}
                                    {testResult === true && (
                                      <span className="text-xs text-green-500">✓</span>
                                    )}
                                    {testResult === false && (
                                      <span className="text-xs text-red-500">✗</span>
                                    )}
                                  </div>

                                  {/* 操作按钮 */}
                                  <div className="flex items-center gap-1">
                                    {/* 启用按钮 */}
                                    <button
                                      onClick={() => handleEnableModel(model.name)}
                                      disabled={model.enabled}
                                      className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                                        model.enabled
                                          ? 'bg-green-100 text-green-600 cursor-default'
                                          : 'bg-slate-100 text-slate-500 hover:bg-green-100 hover:text-green-600'
                                      }`}
                                      title={model.enabled ? '当前使用中' : '点击启用此模型'}
                                    >
                                      {model.enabled ? '使用中' : '启用'}
                                    </button>
                                    {/* 测试按钮 */}
                                    <button
                                      onClick={() => handleTestModel(model.name)}
                                      disabled={isTesting}
                                      className="p-1.5 hover:bg-blue-100 rounded text-blue-500 hover:text-blue-600 disabled:opacity-50"
                                      title="测试连通性"
                                    >
                                      {isTesting ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <TestTube2 className="h-3.5 w-3.5" />
                                      )}
                                    </button>
                                    
                                    {/* 编辑按钮 */}
                                    <button
                                      onClick={() => openEditModelDialog(model)}
                                      className="p-1.5 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-700"
                                      title="编辑模型"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    
                                    {/* 删除按钮 */}
                                    <button
                                      onClick={() => handleDeleteModel(model.name)}
                                      className="p-1.5 hover:bg-red-100 rounded text-red-500 hover:text-red-600"
                                      title="删除模型"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}

            {/* 添加 Provider 按钮 */}
            <Button
              onClick={() => setShowAddProvider(!showAddProvider)}
              variant="outline"
              className="w-full justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              {showAddProvider ? '收起' : '添加 Provider'}
            </Button>
          </div>

          {/* 新增 Provider 表单 */}
          {showAddProvider && (
            <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50">
              <Label className="text-sm font-medium text-slate-600">添加新 Provider</Label>
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
                {adding ? '添加中...' : '确认添加'}
              </Button>
            </div>
          )}

          {/* 编辑 Provider 表单 */}
          {editingProvider && (
            <div className="border border-blue-200 rounded-lg p-4 space-y-3 bg-blue-50">
              <Label className="text-sm font-medium text-blue-700">编辑 Provider「{editingProvider.name}」</Label>
              <Input
                placeholder="名称"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
              <Input
                placeholder="Base URL"
                value={editBaseUrl}
                onChange={(e) => setEditBaseUrl(e.target.value)}
              />
              <div className="relative">
                <Input
                  type={showEditApiKey ? 'text' : 'password'}
                  placeholder="API Key（留空则保留原值）"
                  value={editApiKey}
                  onChange={(e) => setEditApiKey(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowEditApiKey(!showEditApiKey)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showEditApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleEditProvider}
                  disabled={editing || !editName || !editBaseUrl}
                  size="sm"
                  className="flex-1"
                >
                  {editing ? '保存中...' : '保存'}
                </Button>
                <Button
                  onClick={() => setEditingProvider(null)}
                  variant="outline"
                  size="sm"
                  disabled={editing}
                >
                  取消
                </Button>
              </div>
            </div>
          )}

          {/* 默认设置 */}
          {selectedProviderId && (
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <Label className="text-sm font-medium text-slate-600">默认模型选择</Label>
              <select
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                <option value="">-- 选择默认模型 --</option>
                {models
                  .filter(m => m.enabled)
                  .map((m) => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))}
              </select>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex gap-2 justify-end px-6 py-4 border-t border-slate-100 bg-white">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSave} disabled={!selectedProviderId || !selectedModel}>
            保存设置
          </Button>
        </div>
      </div>

      {/* 添加/编辑模型弹窗 */}
      {showModelDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {editingModel ? '编辑模型' : '添加模型'}
              </h3>
              <button 
                onClick={() => setShowModelDialog(false)} 
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="model-name">模型名称</Label>
                <Input
                  id="model-name"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="例：gpt-4o"
                  disabled={!!editingModel}
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={modelEnabled}
                  onChange={(e) => setModelEnabled(e.target.checked)}
                  className="rounded"
                />
                启用模型
              </label>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button 
                variant="outline" 
                onClick={() => setShowModelDialog(false)}
              >
                取消
              </Button>
              <Button 
                onClick={handleSaveModel}
                disabled={!modelName.trim()}
              >
                {editingModel ? '保存' : '添加'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
