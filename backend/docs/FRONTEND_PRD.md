# Novel2Script 前端开发需求文档 (PRD)

## 1. 项目定位

AI 辅助小说转剧本工具的桌面应用前端。基于 React 开发，最终通过 Electron 打包为 Windows `.exe`。

---

## 2. 技术栈

| 组件 | 选型 | 说明 |
|------|------|------|
| UI 框架 | React 18 | 组件化开发 |
| 构建工具 | Vite | 快速 HMR、打包 |
| 样式 | TailwindCSS | 原子化 CSS |
| 状态管理 | Zustand 或 React Context | 轻量，适合桌面应用 |
| HTTP 请求 | Axios | 调用后端 API |
| SSE 接收 | EventSource | 接收进度流 |
| YAML 编辑器 | Monaco Editor | VS Code 同款，支持 YAML 高亮 |
| 桌面壳 | Electron | 打包为 exe |

---

## 3. 核心功能模块

### 3.1 AI Provider 配置页
- **功能**: 用户添加/编辑/删除 AI 接口配置
- **表单字段**: 名称、Base URL（如 `https://api.deepseek.com`）、API Key
- **获取模型按钮**: 填入 URL 和 Key 后，点击按钮调用 `/api/models/fetch`，返回模型列表供勾选
- **测试连接按钮**: 调用 `/api/providers/{id}/test`
- **列表展示**: 已配置的 Provider，显示名称、URL、已选模型数、默认标识
- **交互**: 支持设为默认、删除确认

### 3.2 小说输入页
- **功能**: 提供小说文本输入
- **输入方式**:
  - 大文本框直接粘贴
  - 拖拽/选择本地 `.txt` / `.md` 文件（通过 Electron IPC 读取路径，调用 `/api/files/read`）
- **字段**: 小说标题（可选）、作者（可选）、正文（必填）
- **校验**: 正文至少 1000 字，且能解析出至少 3 个章节

### 3.3 转换配置页
- **功能**: 选择 AI 模型和开始转换
- **选择 Provider**: 下拉选择已配置的 Provider
- **选择模型**: 根据 Provider 显示其可用模型列表（单选）
- **开始转换按钮**: 调用 `/api/convert`，进入进度页

### 3.4 进度页
- **功能**: 实时展示转换进度
- **进度条**: 百分比进度条
- **阶段文字**: "解析章节..." → "提取角色..." → "生成场景..." → "生成台词..." → "组装剧本..."
- **技术**: 使用 `EventSource` 连接 `/api/convert/{id}/stream` 接收 SSE 推送
- **完成跳转**: 完成后自动跳转到结果预览页

### 3.5 结果预览/编辑页
- **功能**: 展示生成的剧本 YAML，支持编辑和导出
- **布局**: 左右分栏
  - 左侧：YAML 文本编辑器（Monaco Editor，YAML 语法高亮）
  - 右侧：可视化预览（场景卡片列表，角色高亮）
- **编辑**: 用户可直接修改 YAML，右侧实时同步预览
- **导出**: 下载 YAML 文件（调用 `/api/convert/{id}/download` 或直接前端生成）
- **重新生成**: 返回输入页，保留原文

---

## 4. 页面路由设计

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | 首页/输入页 | 小说文本输入 |
| `/providers` | Provider 配置页 | AI 接口管理 |
| `/convert` | 转换配置页 | 选择模型 |
| `/progress/:taskId` | 进度页 | 实时进度 |
| `/result/:taskId` | 结果页 | YAML 编辑与预览 |

---

## 5. Electron 集成要求

### 主进程 (main.js)
- 启动时：后台启动 `novel2script-backend.exe`（位于应用目录）
- 等待 `http://localhost:8000/health` 返回 200
- 然后加载前端页面（开发时加载 localhost:5173，生产时加载打包后的 index.html）
- 退出时：终止后端子进程

### 渲染进程 ↔ 主进程通信
- `ipcRenderer.invoke('read-file', path)` → 主进程读取文件返回内容（替代直接调用后端 `/files/read`，更安全）
- `ipcRenderer.invoke('get-app-data-path')` → 获取应用数据目录

### 窗口配置
- 默认尺寸：1280x800
- 最小尺寸：900x600
- 标题：Novel2Script

---

## 6. 与后端接口契约

Base URL: `http://localhost:8000/api`

### 必须调用的接口

| 接口 | 用途 |
|------|------|
| `GET /health` | 启动时检查后端是否就绪 |
| `GET /providers` | 加载 Provider 列表 |
| `POST /providers` | 添加 Provider |
| `PUT /providers/{id}` | 更新 Provider |
| `DELETE /providers/{id}` | 删除 Provider |
| `POST /providers/{id}/test` | 测试连接 |
| `POST /models/fetch` | 获取模型列表 |
| `POST /convert` | 提交转换 |
| `GET /convert/{id}` | 查询状态（备用） |
| `GET /convert/{id}/stream` | SSE 进度流 |
| `GET /convert/{id}/download` | 下载 YAML |

---

## 7. 状态管理设计

### Global Store (Zustand)

```typescript
interface AppState {
  // Provider
  providers: Provider[];
  fetchProviders: () => Promise<void>;
  addProvider: (p: ProviderCreate) => Promise<void>;
  
  // 当前任务
  currentTaskId: string | null;
  taskStatus: TaskStatus | null;
  
  // 小说输入
  novelInput: { title: string; author: string; text: string };
  setNovelInput: (input: Partial<NovelInput>) => void;
  
  // 结果
  currentYaml: string;
  setCurrentYaml: (yaml: string) => void;
}
```

---

## 8. UI/UX 要求

- **整体风格**: 简洁专业，深色/浅色主题切换
- **输入页**: 大文本框占主要区域，支持拖拽文件
- **进度页**: 大进度条 + 阶段文字 + 详细日志（可折叠）
- **结果页**: 编辑器与预览同步滚动（可选）
- **错误处理**: Toast 通知显示后端返回的错误信息
- **加载状态**: 按钮 Loading 状态，防止重复提交

---

## 9. 项目目录结构建议

```
novel2script-frontend/
├── electron/
│   ├── main.js          # 主进程
│   └── preload.js       # 预加载脚本（暴露安全 API）
├── src/
│   ├── main.tsx         # React 入口
│   ├── App.tsx          # 路由配置
│   ├── pages/
│   │   ├── HomePage.tsx         # 小说输入
│   │   ├── ProvidersPage.tsx    # Provider 配置
│   │   ├── ConvertPage.tsx      # 转换配置
│   │   ├── ProgressPage.tsx     # 进度
│   │   └── ResultPage.tsx       # 结果编辑
│   ├── components/
│   │   ├── Layout.tsx
│   │   ├── ProviderForm.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── YamlEditor.tsx
│   │   └── ScriptPreview.tsx
│   ├── stores/
│   │   └── appStore.ts
│   ├── api/
│   │   └── client.ts    # Axios 实例 + API 封装
│   └── types/
│       └── index.ts     # TypeScript 类型定义
├── index.html
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

---

## 10. 打包要求

- Electron + Vite 集成打包
- 输出 `Novel2Script Setup.exe`（Windows Installer）
- 包含后端 exe 文件（放在 `electron/resources/` 或 `public/` 目录，打包时复制）
- 自动更新（可选，第一期可不做）

---

## 11. 开发注意事项

1. **CORS**: 后端已全开，前端直接调用 `http://localhost:8000`
2. **SSE 重连**: 进度流断开后需自动重连
3. **文件路径**: Windows 路径含反斜杠，传给后端时注意转义或改用正斜杠
4. **YAML 校验**: 编辑 YAML 时，可调用 `js-yaml` 做前端基础校验
5. **性能**: 大文本（几十万字）输入时，注意防抖和虚拟滚动
