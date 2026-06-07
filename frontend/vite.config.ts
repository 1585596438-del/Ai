/**
 * Vite 配置：React 插件 + 路径别名 @ -> src/ + Electron 打包兼容
 * - base: './' 让打包后能用 file:// 协议访问（Electron 加载本地 index.html）
 * - server.port 固定 5173（项目规则 §4）
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
