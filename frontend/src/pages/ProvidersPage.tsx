/**
 * Provider 管理页：列表 + 新增 / 编辑 / 删除 / 测试 / 设为默认
 */
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ProviderForm } from '@/components/ProviderForm'
import { useAppStore } from '@/stores/appStore'
import { useToast } from '@/components/ui/toast'
import { testProvider } from '@/api'
import type { Provider, ProviderCreate } from '@/types'
import { Plus, Pencil, Trash2, Star, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ProvidersPage(): JSX.Element {
  const { toast } = useToast()
  const providers = useAppStore((s) => s.providers)
  const loading = useAppStore((s) => s.providersLoading)
  const fetchProviders = useAppStore((s) => s.fetchProviders)
  const addProvider = useAppStore((s) => s.addProvider)
  const removeProvider = useAppStore((s) => s.removeProvider)
  const setDefaultProvider = useAppStore((s) => s.setDefaultProvider)

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Provider | undefined>(undefined)
  const [testingId, setTestingId] = useState<string | null>(null)

  useEffect(() => {
    fetchProviders().catch((e) => {
      toast({ title: '加载 Provider 失败', description: (e as { detail?: string }).detail, variant: 'destructive' })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSubmit = async (data: ProviderCreate) => {
    try {
      await addProvider(data)
      toast({ title: editing ? '已更新' : '已添加', variant: 'success' })
      setOpen(false)
      setEditing(undefined)
    } catch (e) {
      toast({ title: '保存失败', description: (e as { detail?: string }).detail, variant: 'destructive' })
    }
  }

  const onTest = async (id: string) => {
    setTestingId(id)
    try {
      const r = await testProvider(id)
      toast({ title: '连接成功', description: r.message, variant: 'success' })
    } catch (e) {
      toast({ title: '连接失败', description: (e as { detail?: string }).detail, variant: 'destructive' })
    } finally {
      setTestingId(null)
    }
  }

  const onDelete = async (p: Provider) => {
    if (!confirm(`确定删除「${p.name}」？此操作不可撤销`)) return
    try {
      await removeProvider(p.id)
      toast({ title: '已删除', variant: 'success' })
    } catch (e) {
      toast({ title: '删除失败', description: (e as { detail?: string }).detail, variant: 'destructive' })
    }
  }

  const onSetDefault = async (p: Provider) => {
    try {
      await setDefaultProvider(p.id)
      toast({ title: `已将「${p.name}」设为默认`, variant: 'success' })
    } catch (e) {
      toast({ title: '设置失败', description: (e as { detail?: string }).detail, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Provider 管理</h1>
          <p className="text-slate-500 mt-1">配置 OpenAI 兼容的 AI 接口（DeepSeek / 通义千问 / OpenAI 等）</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(undefined) }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              新增 Provider
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? '编辑 Provider' : '新增 Provider'}</DialogTitle>
            </DialogHeader>
            <ProviderForm
              initial={editing}
              onSubmit={onSubmit}
              onCancel={() => {
                setOpen(false)
                setEditing(undefined)
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>已配置（{providers.length}）</CardTitle>
          <CardDescription>默认 Provider 将被「开始转换」页自动选中</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-slate-400">
              <Loader2 className="inline h-5 w-5 animate-spin mr-1" />
              加载中...
            </div>
          ) : providers.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              还没有配置任何 Provider。点击右上角「新增 Provider」开始
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {providers.map((p) => (
                <div key={p.id} className="flex items-center gap-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{p.name}</span>
                      {p.is_default && (
                        <span className="rounded bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 flex items-center gap-0.5">
                          <Star className="h-3 w-3" />默认
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 truncate">{p.base_url}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {p.models.length} 个模型：{p.models.slice(0, 3).join(', ')}
                      {p.models.length > 3 && '...'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onTest(p.id)}
                      disabled={testingId === p.id}
                    >
                      {testingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : '测试'}
                    </Button>
                    {!p.is_default && (
                      <Button variant="ghost" size="sm" onClick={() => onSetDefault(p)}>
                        设为默认
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(p)
                        setOpen(true)
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(p)}
                      className={cn('text-red-600 hover:text-red-700')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
