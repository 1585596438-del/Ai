import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// React 18 根节点挂载入口
// commit 3 会改为 BrowserRouter 包裹（待路由引入后再调整）
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
