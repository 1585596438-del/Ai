/**
 * 简单的 stat 卡片：标签 + 值
 * 供 ResultPage 展示元信息使用
 */
interface StatProps {
  label: string
  value: string | number
  /** 是否用等宽字体（适合 ID、路径、版本号等） */
  mono?: boolean
}

export function Stat({ label, value, mono = false }: StatProps): JSX.Element {
  return (
    <div className="rounded border border-slate-200 p-2">
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className={`mt-0.5 ${mono ? 'font-mono text-xs' : 'text-sm font-semibold'}`}>{value}</div>
    </div>
  )
}
