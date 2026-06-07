/**
 * Electron 主进程
 *
 * 关键职责（PRD §5）：
 * 1. 启动后端子进程（novel2script-backend.exe，开发期用 uvicorn）
 * 2. 等待 http://localhost:8000/health 返回 200
 * 3. 加载前端页面（dev: http://localhost:5173；prod: dist/index.html）
 * 4. 退出时清理后端子进程
 * 5. 提供 IPC：read-file / get-app-data-path
 */
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const { spawn } = require('node:child_process')
const http = require('node:http')
const fs = require('node:fs')

const isDev = !app.isPackaged
const BACKEND_PORT = 8000
let backendProcess = null
let mainWindow = null

/* ───────────── 后端进程管理 ───────────── */

/**
 * 启动后端子进程
 * - 开发期：用 python -m uvicorn 跑 backend/app/main.py
 * - 打包后：执行 resources/novel2script-backend.exe
 */
function startBackend() {
  if (isDev) {
    const backendDir = path.join(__dirname, '..', '..', 'backend')
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
    backendProcess = spawn(
      pythonCmd,
      ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(BACKEND_PORT)],
      { cwd: backendDir, stdio: 'inherit' },
    )
  } else {
    const exePath = path.join(process.resourcesPath, 'novel2script-backend.exe')
    if (!fs.existsSync(exePath)) {
      console.error('[backend] not found:', exePath)
      return
    }
    backendProcess = spawn(exePath, [], { stdio: 'inherit' })
  }

  backendProcess.on('exit', (code) => {
    console.log(`[backend] exited with code ${code}`)
    backendProcess = null
  })
}

/** 轮询后端 /health 直至就绪 */
function waitForBackend(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(
        `http://127.0.0.1:${BACKEND_PORT}/health`,
        (res) => {
          if (res.statusCode === 200) {
            resolve()
          } else {
            retry()
          }
        },
      )
      req.on('error', retry)
      req.setTimeout(1000, () => {
        req.destroy()
        retry()
      })
    }
    const retry = () => {
      if (Date.now() > deadline) {
        reject(new Error('backend start timeout'))
      } else {
        setTimeout(tick, 500)
      }
    }
    tick()
  })
}

/* ───────────── 窗口管理 ───────────── */

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Novel2Script · 星幕',
    icon: path.join(__dirname, '..', 'public', 'brand', 'app-icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    await mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

/* ───────────── IPC 处理器 ───────────── */

/** 读取本地文件（比走 HTTP /api/files/read 更安全） */
ipcMain.handle('read-file', async (_event, filePath) => {
  if (typeof filePath !== 'string' || !filePath) {
    throw new Error('invalid path')
  }
  return fs.promises.readFile(filePath, 'utf-8')
})

/** 获取应用数据目录（用于存配置 / 日志） */
ipcMain.handle('get-app-data-path', () => app.getPath('userData'))

/* ───────────── 生命周期 ───────────── */

app.whenReady().then(async () => {
  startBackend()
  try {
    await waitForBackend()
    console.log('[backend] ready')
  } catch (e) {
    console.error('[backend] start failed:', e)
    // 即便后端未就绪，也打开窗口，让用户看到错误提示
  }
  await createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.on('before-quit', () => {
  if (backendProcess && !backendProcess.killed) {
    try {
      backendProcess.kill()
    } catch (e) {
      console.error('[backend] kill failed:', e)
    }
  }
})
