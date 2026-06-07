/**
 * 结果预览 / 编辑页：
 * - 左：YAML 文本编辑器（textarea，等价于 Monaco 的功能但零依赖）
 * - 右：解析后的元数据 + 角色 + 场景预览（与后端 Pydantic Script 对齐）
 * - 下载、重新生成
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import yaml from 'js-yaml'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Stat } from '@/components/Stat'
import { useAppStore } from '@/stores/appStore'
import { useToast } from '@/components/ui/toast'
import { downloadResult } from '@/api'
import { Download, RotateCcw, Loader2 } from 'lucide-react'

/* ────────── 与后端 Pydantic Schema 对齐的类型 ────────── */

/** 后端 ScriptMetadata */
interface ScriptMetadata {
  title?: string
  source_novel?: string
  author?: string
  generated_at?: string
  version?: string
  total_scenes?: number
  total_characters?: number
  generator?: string
}

/** 后端 Character */
interface ScriptCharacter {
  id: string
  name: string
  aliases?: string[]
  description?: string
  age?: number | null
  gender?: string | null
  traits?: string[]
  notes?: string
}

/** 后端 SceneContent */
interface ScriptSceneContent {
  type: 'stage_direction' | 'dialogue' | 'transition' | 'voiceover' | 'sound'
  text?: string
  character?: string | null
  emotion?: string | null
  target_scene?: string | null
  description?: string
}

/** 后端 Scene */
interface ScriptScene {
  scene_id: string
  chapter_ref?: string
  scene_number?: number
  title?: string
  location?: string
  time_of_day?: string
  characters_present?: string[]
  content?: ScriptSceneContent[]
  notes?: string
}

/** 后端 Script */
interface ScriptDoc {
  metadata?: ScriptMetadata
  characters?: ScriptCharacter[]
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

  /** 构建角色 id → name 映射，方便 scene 预览把 char_001 替换为「林晓」 */
  const charNameMap = useMemo<Map<string, string>>(() => {
    const m = new Map<string, string>()
    for (const c of parsed?.characters ?? []) {
      m.set(c.id, c.name)
    }
    return m
  }, [parsed])

  /** 工具：把 char_001 转成「林晓」；未知 id 保持原样 */
  const resolveChar = (id?: string | null): string => {
    if (!id) return ''
    return charNameMap.get(id) ?? id
  }

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

  const meta = parsed?.metadata
  const scenes = parsed?.scenes ?? []
  const characters = parsed?.characters ?? []

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

      {!parsed ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          YAML 格式错误，无法解析
        </div>
      ) : (
        <>
          {/* 元信息卡片 */}
          {meta && (
            <Card>
              <CardHeader>
                <CardTitle>{meta.title || '未命名剧本'}</CardTitle>
                <CardDescription>
                  {meta.author && <span>作者：{meta.author} · </span>}
                  {meta.generated_at && <span>生成于 {new Date(meta.generated_at).toLocaleString()} · </span>}
                  {meta.version && <span>版本 {meta.version} · </span>}
                  {meta.generator && <span>生成器 {meta.generator}</span>}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <Stat label="总场景" value={meta.total_scenes ?? scenes.length} />
                  <Stat label="总角色" value={meta.total_characters ?? characters.length} />
                  <Stat label="源小说" value={meta.source_novel || '—'} mono />
                  <Stat label="解析到" value={`${scenes.length} 场景 / ${characters.length} 角色`} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* 角色一览 */}
          {characters.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>角色库（{characters.length}）</CardTitle>
                <CardDescription>与后端 Script.characters 字段一一对应</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {characters.map((c) => (
                    <div key={c.id} className="rounded-md border border-slate-200 p-2 text-sm space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{c.name}</span>
                        <span className="font-mono text-[10px] text-slate-400">{c.id}</span>
                      </div>
                      {c.aliases && c.aliases.length > 0 && (
                        <div className="text-xs text-slate-500">别名：{c.aliases.join('、')}</div>
                      )}
                      {c.description && <div className="text-xs text-slate-600">{c.description}</div>}
                      {c.traits && c.traits.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {c.traits.map((t) => (
                            <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 场景详情 + YAML 双栏 */}
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
                <CardTitle>场景预览（{scenes.length}）</CardTitle>
                <CardDescription>
                  {parsed ? '与后端 Script.scenes 字段一一对应' : 'YAML 解析失败'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {scenes.map((s, i) => (
                    <div key={s.scene_id ?? i} className="rounded-md border border-slate-200 p-3 text-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">
                          场景 {s.scene_number ?? i + 1}：{s.title || s.location || s.scene_id}
                        </div>
                        {s.time_of_day && <div className="text-xs text-slate-500">{s.time_of_day}</div>}
                      </div>
                      <div className="text-xs text-slate-500">
                        <span className="font-mono">{s.scene_id}</span>
                        {s.location && <span> · {s.location}</span>}
                        {s.chapter_ref && <span> · {s.chapter_ref}</span>}
                      </div>
                      {s.characters_present && s.characters_present.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {s.characters_present.map((cid) => (
                            <span key={cid} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                              {resolveChar(cid)}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="space-y-1 border-l-2 border-slate-200 pl-3">
                        {(s.content ?? []).map((c, j) => {
                          if (c.type === 'stage_direction') {
                            return (
                              <div key={j} className="text-xs text-slate-500 italic">
                                {c.text}
                              </div>
                            )
                          }
                          if (c.type === 'dialogue') {
                            return (
                              <div key={j} className="text-xs">
                                <span className="font-semibold text-slate-800">{resolveChar(c.character)}：</span>
                                <span className="text-slate-700">{c.text}</span>
                                {c.emotion && <span className="ml-1 text-slate-400">（{c.emotion}）</span>}
                              </div>
                            )
                          }
                          if (c.type === 'voiceover') {
                            return (
                              <div key={j} className="text-xs text-slate-600">
                                <span className="text-slate-400">【旁白 · {resolveChar(c.character)}】</span>
                                {c.text}
                              </div>
                            )
                          }
                          if (c.type === 'transition') {
                            return (
                              <div key={j} className="text-xs text-slate-500 text-center">
                                —— {c.text} {c.target_scene && <span>→ {c.target_scene}</span>} ——
                              </div>
                            )
                          }
                          if (c.type === 'sound') {
                            return (
                              <div key={j} className="text-xs text-slate-500">
                                ♪ {c.text || c.description}
                              </div>
                            )
                          }
                          return null
                        })}
                      </div>
                      {s.notes && (
                        <div className="text-[10px] text-slate-400 border-t border-slate-100 pt-1">
                          备注：{s.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
