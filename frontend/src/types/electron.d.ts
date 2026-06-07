/**
 * 桌面应用全局类型声明
 * 由 electron/preload.js 在 window 上挂 electronAPI
 */
export {}

export interface ElectronAPI {
  readFile: (filePath: string) => Promise<string>
  getAppDataPath: () => Promise<string>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
