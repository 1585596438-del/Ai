/**
 * Electron preload 脚本：在 contextIsolation 启用时安全暴露 IPC
 * 渲染进程通过 window.electronAPI 调用
 */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  /** 读取本地文本文件（比走后端 /api/files/read 更安全） */
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),

  /** 获取应用数据目录（用于持久化配置 / 日志） */
  getAppDataPath: () => ipcRenderer.invoke('get-app-data-path'),
})
