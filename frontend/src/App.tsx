/**
 * 应用根组件（commit 1 占位）
 *
 * commit 3 会替换为路由配置：
 *   <Routes>
 *     <Route path="/" element={<HomePage />} />
 *     <Route path="/providers" element={<ProvidersPage />} />
 *     <Route path="/convert" element={<ConvertPage />} />
 *     <Route path="/progress/:taskId" element={<ProgressPage />} />
 *     <Route path="/result/:taskId" element={<ResultPage />} />
 *   </Routes>
 */
export default function App(): JSX.Element {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900">
      <main className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Novel2Script</h1>
        <p className="mt-2 text-slate-500">前端骨架已就绪（commit 1）</p>
      </main>
    </div>
  )
}
