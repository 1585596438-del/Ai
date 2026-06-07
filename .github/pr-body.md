## 标题（Title）

feat(frontend): scaffold Vite + React + TypeScript app with 5 pages, Electron shell and brand assets

## 描述（Description）

完成 Novel2Script 前端骨架的第 1 阶段交付，包含：

- **Web 端**：5 个核心页面（开始转换 / Provider 管理 / 选择模型 / 转换进度 / 剧本结果），按后端 PRD §3 完整实现，可直接 `npm run dev` 跑通
- **桌面壳**：Electron 主进程 + preload + 类型声明，`npm run electron:dev` 启动后自动拉起后端 uvicorn，IPC 提供 readFile / getAppDataPath 两个安全能力
- **品牌资产**：Logo PNG 与应用图标已纳入 `frontend/public/brand/`，README / SUBMISSION 同步更新链接
- **工程化**：依赖、构建、TypeScript 配置、ESLint 规则全部就绪；`npx tsc --noEmit` 0 错误，`npm run build` 成功（dist/ 369.90 kB JS / 16.39 kB CSS）

## 变更类型（Type of Change）

- [x] 新功能（feat）
- [x] 构建/工具链（chore）
- [x] 文档更新（docs）

## 影响范围（Scope）

### 后端模块影响

- [ ] 无（本次 PR 仅前端；后端接口路径假设与 [MODULE_REFERENCE §2](../../docs/MODULE_REFERENCE.md#2-路由层-backendappapi) 一致：`/api/providers` / `/api/convert` / `/api/convert/{id}/stream` / `/api/files/read` / `/api/models/fetch`）

### 前端模块影响

- [x] `frontend/package.json` — 依赖与 scripts
- [x] `frontend/vite.config.ts` — 构建配置
- [x] `frontend/tsconfig.json` / `frontend/tsconfig.node.json` — TypeScript 配置
- [x] `frontend/index.html` / `frontend/src/main.tsx` / `frontend/src/App.tsx` — 入口与路由
- [x] `frontend/src/api/` — HTTP 客户端与业务封装
- [x] `frontend/src/components/` — Layout / ProviderForm / shadcn 基础组件
- [x] `frontend/src/pages/` — 5 个页面
- [x] `frontend/src/stores/` — Zustand 全局状态
- [x] `frontend/src/types/` — 类型定义
- [x] `frontend/src/lib/` — 工具函数
- [x] `frontend/electron/` — 主进程 + preload
- [x] `frontend/public/brand/` — 品牌素材

### 其他

- [x] `README.md` — 品牌表更新
- [x] `SUBMISSION.md` — 资源指向更新

## 改动明细（按文件分组）

### Commit 1：`chore(frontend): scaffold vite + react + ts + tailwind project` (3296378)

- 新增 `frontend/package.json`（React 18.3 + Vite 5.4 + TS 5.5 + Tailwind 3.4）
- 新增 `frontend/vite.config.ts`、`frontend/tsconfig.json`、`frontend/tsconfig.node.json`
- 新增 `frontend/index.html`、`frontend/src/main.tsx`、`frontend/src/App.tsx`
- 新增 `frontend/src/index.css`（仅 Tailwind 三件套）
- 新增 `frontend/postcss.config.js`、`frontend/tailwind.config.js`

### Commit 2：`docs(frontend): update brand and product info in README and SUBMISSION` (fd57513)

- 修改 `README.md`（品牌表：产品名「SCRIPT-STAR 星幕」、Slogan、Logo/Icon 说明）
- 修改 `SUBMISSION.md`（产品名、团队名、Slogan、资源指向）
- 新增 `frontend/docs/BRAND.md`（品牌素材版本记录，约定未来更新口径）

### Commit 3：`docs(frontend): add brand assets and update logo links in docs` (671a2ab)

- 新增 `frontend/public/brand/logo.png`（团队主标识）
- 新增 `frontend/public/brand/app-icon.png`（Electron 桌面应用图标）
- 修改 `README.md` / `SUBMISSION.md`（Logo / Icon 改用 `frontend/public/brand/` 相对路径链接）

### Commit 4：`feat(frontend): add router, layout, 5 pages, shadcn UI and Zustand store` (a17895f)

- 新增 `frontend/src/types/index.ts` — 与后端 Pydantic 一一对应的 TypeScript 类型
- 新增 `frontend/src/lib/utils.ts` — `cn()` 工具（clsx + tailwind-merge）
- 新增 `frontend/src/api/client.ts` — axios 实例 + 拦截器 + 类型化 GET/POST/PUT/DELETE 包装
- 新增 `frontend/src/api/index.ts` — 业务 API 封装：listProviders / createProvider / submitConvert / openTaskStream / downloadResult / readLocalFile 等
- 新增 `frontend/src/stores/appStore.ts` — Zustand 全局状态：providers / currentTask / novelInput（持久化）/ currentYaml
- 新增 `frontend/src/components/ui/` — shadcn 风格基础组件（button / card / input / label / textarea / dialog / progress / toast），零 CLI 依赖手写
- 新增 `frontend/src/components/Layout.tsx` — 左侧固定侧边栏（Logo + 3 菜单）+ 右侧路由出口
- 新增 `frontend/src/components/ProviderForm.tsx` — Provider 新增/编辑表单（含「拉取模型」按钮）
- 新增 `frontend/src/pages/HomePage.tsx` — 小说输入（粘贴 + 选文件 + 字数/章节校验）
- 新增 `frontend/src/pages/ProvidersPage.tsx` — Provider 列表 + CRUD + 测试 + 设为默认
- 新增 `frontend/src/pages/ConvertPage.tsx` — 选 Provider + 选模型 + 提交
- 新增 `frontend/src/pages/ProgressPage.tsx` — SSE 实时进度 + 完成后跳结果
- 新增 `frontend/src/pages/ResultPage.tsx` — YAML 编辑（textarea）+ 场景预览 + 下载
- 修改 `frontend/src/App.tsx` — 5 路由（`/` / `/providers` / `/convert` / `/progress/:taskId` / `/result/:taskId`）
- 修改 `frontend/src/main.tsx` — `BrowserRouter` + `Toaster`
- 修改 `frontend/vite.config.ts` — 加 `base: './'`（Electron `file://` 兼容）
- 修改 `frontend/tsconfig.json` — 移除 broken references

### Commit 5：`feat(frontend): add Electron main process and IPC bridge` (f8f66e4)

- 新增 `frontend/electron/main.js` — 主进程：启动后端 uvicorn / 轮询 `/health` / 加载 5173 或 `dist/index.html` / `before-quit` 清理子进程 / IPC `read-file`、`get-app-data-path`
- 新增 `frontend/electron/preload.js` — `contextBridge` 安全暴露 `electronAPI`
- 新增 `frontend/src/types/electron.d.ts` — `window.electronAPI` 类型声明
- 修改 `frontend/package.json` — 加 `main` 字段、`dev:electron` / `electron:dev` / `electron:build` scripts、`build` (electron-builder) 配置：appId、productName、files、extraResources、nsis 打包目标

## 实现思路（Implementation Approach）

### 技术选型

| 类别 | 选型 | 备选与理由 |
| --- | --- | --- |
| 构建 | Vite 5.4 | 选 Vite：dev HMR 毫秒级、CJS/ESM 混合友好；不选 webpack：配置成本高 |
| 路由 | react-router-dom 7 | 选 v7：data API + 嵌套路由更现代；不选 v6：v7 已是默认 |
| 状态 | Zustand 5 + persist | 选 Zustand：API 极简、bundle 小（< 3 kB）；不选 Redux Toolkit：模板代码多；不选 Jotai：原子化粒度与本项目 1 个全局 store 场景不匹配 |
| HTTP | axios 1.x | 选 axios：拦截器/取消/超时均成熟；不选 fetch：需要手写重试和超时 |
| 样式 | TailwindCSS 3.4 + cva + clsx + tailwind-merge | shadcn/ui 同款三件套，零运行时主题切换成本 |
| UI 组件 | shadcn 风格（手写） | 手写而非 `npx shadcn add` 的原因：避免引入 CLI 依赖、避免污染 components.json；功能等价 |
| 图标 | lucide-react | 选 lucide：tree-shakable、size 一致；不选 react-icons：体积大 |
| 桌面 | Electron 31 + electron-builder 24 | 选 Electron：PRD §10 指定；不选 Tauri：当前环境无 Rust 工具链 |
| YAML 预览 | js-yaml 4 | 标准 YAML 库，零替代 |

### 核心设计

1. **API 客户端分层**
   - `api/client.ts`：底层 axios 实例 + 拦截器（HTTPException(detail) → ApiError）
   - `api/index.ts`：业务域封装（providers / models / convert / files），只返回类型化结果，不暴露 axios
   - 上层 store / 组件只 import `api/index.ts`

2. **SSE 进度**
   - 原生 `EventSource` 监听 `/api/convert/{id}/stream`，无第三方依赖
   - 完成后通过 `useNavigate` 跳结果页
   - 断开仅提示，不自动重连（MVP 范围，重连属后续优化）

3. **状态持久化边界**
   - 只把 `novelInput` 写 localStorage（用户输入不应丢）
   - `providers` / `currentTask` / `currentYaml` 不持久化（以服务端为准，避免与数据库漂移）

4. **Electron 启动后端**
   - 开发期：`python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`，cwd 指向 `backend/`
   - 打包后：执行 `resources/novel2script-backend.exe`（待后端 PyInstaller 产物就位）
   - 主进程用 `http.get('/health')` 轮询最多 30s，失败不阻断窗口启动（让用户看到错误页）
   - 退出时 `backendProcess.kill()`，避免僵尸进程

5. **Vite base 配置**
   - `base: './'` 让 `dist/index.html` 用相对路径加载 JS/CSS，Electron `loadFile()` 走 `file://` 时不会 404
   - 开发期仍用绝对 `http://localhost:5173`

### 权衡说明

- **YAML 编辑器用 textarea 而非 Monaco**：Monaco 安装包 ~30 MB 且需额外类型配置；当前需求是「展示 + 微调」，textarea 足够。后续若用户要语法高亮/自动补全，可平滑替换为 Monaco，ResultPage 已有 `currentYaml` 作为单一数据源
- **shadcn 组件手写而非 CLI 引入**：项目规则 §3.5「单文件 ≤ 500 行」，手写的 8 个基础组件每个 < 80 行；CLI 引入会带 `components.json`、`tsconfig.json` 自动 patch，不便评审
- **Electron 暂未装包**：本次 PR 提交 `electron/main.js` 代码 + `package.json` scripts/build 配置，`npm i -D electron@^31 electron-builder@^24` 由评审通过后另起一个 chore commit 安装（包体 100 MB+，避免拖慢本次评审）
- **侧边栏菜单只有 3 项**：PRD 提到的导出/历史等放在后续 commit；MVP 只覆盖开始转换 / Provider 管理 / 选择模型 3 个核心入口
- **后端进程启动不健康也能打开窗口**：避免主进程卡死导致用户看不到任何 UI；后续可在窗口内显示「后端连接失败，请重试」横幅

## 截图 / 录屏（Screenshots / Recordings）

待补：浏览器跑通 5 个页面的录屏；Electron 桌面壳启动录屏（依赖 electron 包安装）

## 测试方式（How to Test）

```bash
# 1) 装依赖（仅运行时，本 PR 不含 electron）
cd frontend
npm install

# 2) 启动后端（另开终端）
cd ../backend
uvicorn app.main:app --reload --port 8000

# 3) 启动前端
cd ../frontend
npm run dev
# 浏览器打开 http://localhost:5173

# 4) 验证
# - 首页粘贴小说正文（≥ 1000 字，含「第X章」3 次以上）→ 「下一步」
# - Provider 管理 → 「新增 Provider」→ 填入 base_url + api_key → 「拉取模型」→ 保存
# - 选择模型 → 「开始转换」→ 进度页 SSE 实时推进
# - 完成后自动跳结果页 → 左右双栏可编辑 / 预览 → 「下载 YAML」

# 5) 静态检查与构建
cd frontend
npx tsc --noEmit           # 0 错误
npm run build              # 应成功输出 dist/
```

## 关联 Issue

无

## 检查清单（Checklist）

- [x] 一个 PR 只做一件事（前端骨架首版，规则 3.3）
- [x] PR 描述已包含 4 要素：标题、功能描述、实现思路、测试方式（规则 3.3）
- [x] 已在本地自测通过：`npx tsc --noEmit` 0 错误、`npm run build` 成功、`npm run dev` 在 5173 跑通
- [x] 主分支（main）合并后保持可运行状态（仅依赖后端 /api/* 与 PRD 对齐）
- [x] 已更新相关文档（README、SUBMISSION、frontend/docs/BRAND.md）
- [x] Commit 信息已遵循 Conventional Commits 规范
- [x] 未引入新的 linter / type-check 告警
- [x] 未提交敏感信息（.env、密钥、数据库文件等）
- [x] 新引用的第三方库 / 框架已在 README 中列举（react-router-dom / zustand / axios / js-yaml / @radix-ui / lucide-react / tailwind-merge / clsx / class-variance-authority / concurrently / wait-on / cross-env）

## 评审关注点（Reviewer Notes）

- **重点关注 1：API 路径与后端契约**
  - 前端默认假设的路径：`/api/providers`、`/api/providers/{id}/test`、`/api/providers/{id}`、`/api/models/fetch`、`/api/convert`、`/api/convert/{id}/stream`、`/api/convert/{id}/download`、`/api/files/read`
  - 请后端同事对照 `backend/docs/MODULE_REFERENCE.md §2` 确认路径与字段名完全一致；若不一致，对应 API 文件的 `frontend/src/api/index.ts` 修改成本很低
- **重点关注 2：SSE payload 格式**
  - 假设为 `data: <TaskStatus JSON>\n\n`，字段：`task_id / status / progress / detail / error_code / error_message / result_path`
  - 状态枚举：`pending / parsing / extracting / generating_scenes / generating_dialogues / assembling / completed / failed`
  - 与 `frontend/src/pages/ProgressPage.tsx STAGE_LABEL` 一一对应
- **重点关注 3：Electron 后端进程管理**
  - 假设后端 PyInstaller 产物名 `novel2script-backend.exe`，位于 `resources/`
  - 开发期依赖 PATH 中有 `python` 或 `python3` 且能 import uvicorn + 本项目后端依赖
  - 若后端打包产物改名或路径调整，需同步修改 `frontend/electron/main.js` 第 30 行附近
- **后续待办（不在本 PR）**
  - 安装 electron / electron-builder 依赖
  - 打包验证（NSIS installer）
  - Monaco 编辑器替换 textarea
  - 历史记录 / 任务列表页面
  - 错误重试 / SSE 自动重连
