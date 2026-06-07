# Novel2Script 项目开发规则

> 本文件是 **Novel2Script** 项目的本地协作规则，集中存放代码规范、提交流程、协作约定。
> 所有项目成员（前端 / 后端）必须遵守。新成员加入时请先通读一遍。
>
> 维护：随项目演进持续更新；长期文档，长期维护。

---

## 1. 提交规则（来自活动方硬性要求）

### 1.1 提交内容（规则 3.1）
- ✅ 公开的 GitHub 仓库：`https://github.com/1585596438-del/Ai`
- ✅ `README.md` 完整，含项目说明、运行方式、文档导航
- ⏳ **Demo 视频**（bilibili / 云盘），链接放 README

### 1.2 作品有效性（规则 3.2）
- ✅ 自主完成，无抄袭
- ⚠️ **全周期持续交付**：从开发首日起，必须在 `feature/xxx` 分支上**持续** PR/commit，**严禁最后一天一次性导入**
- ⚠️ commit 时间戳必须散布在活动批次开始与截止时间之间
- ✅ 复用旧代码片段需在 PR 描述注明
- ✅ 引用第三方库 / 框架必须在 README 中列举

### 1.3 PR 规范（规则 3.3）
- **一事一议**：每个 PR 只做一件最小化的事
- **PR 描述必须包含 4 要素**：
  1. 标题：一句话说清本 PR 新增 / 修改了什么
  2. 功能描述：本次的作用与使用方式
  3. **实现思路**：技术选型、关键设计、权衡（见 PR 模板）
  4. 测试方式：如何验证功能正常运行
- 主分支（main）合并后**必须可运行**

### 1.4 多人协作（规则 3.5）
- 每位成员用**自己的 GitHub 账号**提交 commit / PR
- 多模块用独立子目录（`/backend`、`/frontend`）分别管理
- 提交时区分身份：后端 `Zhiwen P`，前端 `user-wangjun`

---

## 2. Git 工作流

### 2.1 分支策略
| 分支 | 用途 | 谁可推 |
|---|---|---|
| `main` | 受保护主分支，始终可运行 | 仅 PR 合入 |
| `feature/backend-xxx` | 后端功能 | Zhiwen P |
| `feature/frontend-xxx` | 前端功能 | user-wangjun |
| `fix/xxx` | 紧急修复 | 各自 |
| `docs/xxx` | 文档更新 | 各自 |

### 2.2 Commit 规范（Conventional Commits）
```
<type>(<scope>): <subject>

<body 详细说明 what & why（每行 ≤ 72 字符）>

<footer 关联 issue / breaking change>
```
**Type**：`feat` / `fix` / `docs` / `style` / `refactor` / `perf` / `test` / `chore` / `ci` / `build` / `revert`

**Scope**：`backend` / `frontend` / `docs` / `.github` / `root`

**Subject 要求**：
- 祈使句，现在时（"add" 而非 "added"）
- 首字母不大写，结尾不加句号
- ≤ 50 字符

**示例**：
```
feat(frontend): add provider list page with create / delete actions

- 新增 ProvidersPage 组件，复用 ProviderForm
- 通过 GET /api/providers 拉取列表
- 删除操作带二次确认
- 错误用 Toast 通知
```

### 2.3 PR 流程
1. 从最新 `main` 拉取：`git pull origin main`
2. 拉新分支：`git checkout -b feature/xxx`
3. 开发并按规范提交
4. 推送：`git push -u origin feature/xxx`
5. 在 GitHub 上提 PR，按 `.github/PULL_REQUEST_TEMPLATE.md` 填写（含 4 要素）
6. 自检通过 Checklist 后请求评审
7. 合并后删除远端分支

---

## 3. 代码规范

### 3.1 命名约定
- **后端（Python）**：`snake_case` 函数 / 变量，`PascalCase` 类，`UPPER_SNAKE_CASE` 常量
- **前端（TypeScript / React）**：`camelCase` 变量 / 函数，`PascalCase` 组件 / 类型，`UPPER_SNAKE_CASE` 常量
- 命名要有意义、描述性；**避免缩写和单字母变量**（循环中的 `i`、`j`、`k` 等约定俗成除外）
- 文件名遵循各语言社区惯例（React 组件 `PascalCase.tsx`，工具函数 `camelCase.ts`）

### 3.2 注释规范
- **注释解释"为什么"，而不是"做什么"**（代码本身应能表达"做什么"）
- **函数级中文注释**：每个公开函数 / 复杂逻辑函数必须有中文 docstring / 注释
- 注释随代码更新；过时注释比没注释更糟糕
- 公共 API 需有清晰文档（参数、返回值、异常、副作用）
- TODO 注释格式：`# TODO(用户名): 说明 -- YYYY-MM-DD`

### 3.3 函数一致性
- **创建与调用必须一致**：函数定义时声明的所有参数，调用时也必须全部传齐
- 函数命名保持一致，不中途改名
- 修改函数签名需同步更新所有调用点

### 3.4 性能与代码质量
- **避免不必要的循环和递归**：能用 O(n) 不用 O(n²)
- **选择合适的数据结构**（查 → dict / set；有序 → list / heap）
- **并行化处理**：CPU 密集型任务用多进程 / 线程池；I/O 密集型用 async
- **避免不必要复制**：能用引用就别深拷贝
- **避免多层嵌套**：提前 return / 卫语句（guard clause）优先
- **修改代码时保证其他模块运行功能不变**（避免范围蔓延）

### 3.5 函数 / 模块长度
- 单函数 ≤ 50 行（不含注释和空行）
- 单文件 ≤ 500 行（超出考虑拆分）
- 单文件组件 ≤ 300 行（React）

---

## 4. 端口与进程

- **后端**：`8000`（`PORT` 环境变量可覆盖）
- **前端开发服务器（Vite）**：`5173`
- **Electron 主进程**：`--remote-debugging-port=9223`（开发时）
- 一旦绑定，**未经用户主动要求不得修改**

---

## 5. 文档规范

### 5.1 文档分类
- **长期文档**（长期维护）：README、SUBMISSION、PRD、MODULE_REFERENCE、YAML_SCHEMA、本文件
- **临时文档**（任务完成后删除）：TODO 笔记、调试脚本、临时方案

### 5.2 文档语言
- **所有文档用中文**
- 技术名词保留英文（如 Pydantic、FastAPI、EventSource）
- 中英文之间留 1 空格

### 5.3 文档位置
| 类型 | 位置 |
|---|---|
| 仓库总览 | 根目录 `README.md` / `SUBMISSION.md` |
| 后端 PRD | `backend/docs/BACKEND_PRD.md` |
| 前端 PRD | `backend/docs/FRONTEND_PRD.md` |
| YAML Schema | `backend/docs/YAML_SCHEMA.md` |
| 模块参考 | `docs/MODULE_REFERENCE.md` |
| 项目规则 | `.trae/rules/project_rules.md`（本文件） |
| API 文档 | 后端启动后访问 `/docs`（FastAPI 自动生成） |

### 5.4 避免冗余
- **不创建重复文档**：已有相关文档就编辑它，不新建
- 修改文档时同步更新引用此文档的其他地方

---

## 6. 前后端协作约定

### 6.1 API 契约
- 前端 API 客户端必须与后端 OpenAPI Schema 保持一致
- 后端接口变更需先在 `backend/docs/` 更新文档，前端再跟进
- 联调前双方在 PR 描述里 @ 对方

### 6.2 联调步骤
1. 后端起本地服务：`uvicorn app.main:app --reload --port 8000`
2. 前端连 `http://localhost:8000`
3. 接口走通后，前端提交 PR；PR 描述里附后端接口路径

### 6.3 文件读取
- 优先走 Electron IPC `read-file`（更安全，绕开 CORS）
- 不通过 HTTP 暴露本地任意路径读取能力

### 6.4 错误处理
- 后端：返回结构化错误（`error_code` + `error_message`）
- 前端：用 Toast 显示 `error_message`；调试模式下显示 `error_code`

---

## 7. 关键模块速查

后端模块参考 [`docs/MODULE_REFERENCE.md`](../MODULE_REFERENCE.md)，PR 描述的"影响范围"必须引用对应章节。

前端核心模块（占位，前端开发中补充）：
- `frontend/src/api/`：HTTP 客户端
- `frontend/src/pages/`：路由页面
- `frontend/src/components/`：复用组件
- `frontend/src/stores/`：Zustand 全局状态
- `frontend/electron/`：主进程 / preload

---

## 8. 删除文件原则

> ⚠️ **删除任何文件前必须先告诉用户**（删除带来的效果和后果，要肯定的结果，不能模棱两可）。
>
> - 删除前：列出文件路径、删除原因、影响范围、是否有替代方案
> - 删除后：检查是否还有引用残留（`grep` / `git log --diff-filter=D`）

---

## 9. 工作流规范

- **开发项目 / 新功能时严格按 superpowers 规范**：先 brainstorming → plan → subagent 实施 → TDD → 评审 → 合入
- **遇到 Bug 用 systematic-debugging**：假设 → 插桩 → 复现 → 分析 → 修复 → 验证
- **完成功能用 test-driven-development**：测试先行
- **完成工作用 finishing-a-development-branch**：决定 merge / PR / 清理

---

## 10. 规则演进

- 本文件随项目演进持续更新
- 修改本文件需在 PR 描述中说明变更原因
- 重大规则变更需团队两人同时确认
