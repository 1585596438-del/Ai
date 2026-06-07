/**
 * 进度页：SSE 实时接收任务进度
 * - 进度条 + 阶段文字
 * - 完成后跳到 /result/:taskId
 * - 失败时显示错误
 */
import { useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/appStore'
import { useToast } from '@/components/ui/toast'
import { openTaskStream } from '@/api'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

/** 阶段中文映射 */
const STAGE_LABEL: Record<string, string> = {
  pending: '等待中',
  parsing: '解析章节',
  extracting: '提取角色',
  generating_scenes: '生成场景',
  generating_dialogues: '生成台词',
  assembling: '组装剧本',
  completed: '已完成',
  failed: '失败',
}

export function ProgressPage(): JSX.Element {
  const { taskId = '' } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const taskStatus = useAppStore((s) => s.taskStatus)
  const updateTaskStatus = useAppStore((s) => s.updateTaskStatus)
  const closeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!taskId) return
    updateTaskStatus({ status: 'pending', progress: 0, detail: '正在连接...' })

    const close = openTaskStream(
      taskId,
      (s) => {
        updateTaskStatus(s)
        if (s.status === 'completed') {
          toast({ title: '转换完成', variant: 'success' })
          // 完成后跳结果页（结果页会自己下载 yaml）
          navigate(`/result/${taskId}`)
        } else if (s.status === 'failed') {
          toast({ title: '转换失败', description: s.error_message ?? s.detail, variant: 'destructive' })
        }
      },
      () => {
        // SSE 错误：简单提示，不重连（PRD 提到重连，但 MVP 先降级到 GET 轮询）
        toast({ title: '进度流断开', description: '可手动重试或返回', variant: 'destructive' })
      },
    )
    closeRef.current = close
    return () => {
      close()
      closeRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId])

  const status = taskStatus?.status ?? 'pending'
  const progress = taskStatus?.progress ?? 0
  const detail = taskStatus?.detail ?? '等待服务器响应...'
  const isFailed = status === 'failed'
  const isDone = status === 'completed'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">转换进度</h1>
        <p className="text-slate-500 mt-1 font-mono text-xs">任务 ID：{taskId}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {!isDone && !isFailed && <Loader2 className="h-5 w-5 animate-spin" />}
            {isDone && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
            {isFailed && <XCircle className="h-5 w-5 text-red-600" />}
            {STAGE_LABEL[status] ?? status}
          </CardTitle>
          <CardDescription>{detail}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={progress} />
          <div className="text-right text-sm text-slate-500">{progress}%</div>

          {isFailed && taskStatus?.error_message && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <div className="font-semibold">错误信息</div>
              <div className="mt-1">{taskStatus.error_message}</div>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => navigate('/')}>
              返回首页
            </Button>
            {isDone && (
              <Button onClick={() => navigate(`/result/${taskId}`)}>
                查看结果
              </Button>
            )}
            {isFailed && (
              <Button onClick={() => navigate('/')}>重新开始</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
