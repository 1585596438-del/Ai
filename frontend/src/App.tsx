/**
 * 应用根组件：路由表 + Layout
 * 5 个页面：Home / Providers / Convert / Progress / Result
 */
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { HomePage } from '@/pages/HomePage'
import { ProvidersPage } from '@/pages/ProvidersPage'
import { ConvertPage } from '@/pages/ConvertPage'
import { ProgressPage } from '@/pages/ProgressPage'
import { ResultPage } from '@/pages/ResultPage'

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/providers" element={<ProvidersPage />} />
        <Route path="/convert" element={<ConvertPage />} />
        <Route path="/progress/:taskId" element={<ProgressPage />} />
        <Route path="/result/:taskId" element={<ResultPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
