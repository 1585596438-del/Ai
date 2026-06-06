# Novel2Script

> AI 辅助小说转剧本工具 —— 让小说一键变剧本

Novel2Script 是一个桌面端 AI 工具，能够将中文网络小说自动转换为结构化的剧本（YAML 格式）。
后端基于 **FastAPI** + **大语言模型**，前端基于 **Electron**，最终以**桌面应用**形态分发。

---

## 仓库结构

本仓库采用**单仓多模块**方式管理前后端（符合项目提交规则 3.5）：

```
.
├── backend/        # FastAPI 后端服务（PyInstaller 打包后内嵌至 Electron）
├── frontend/       # Electron 桌面应用前端
├── docs/           # 归档的总项目文档（已迁至 backend/docs/，此处留索引）
├── .gitignore
└── README.md
```

> 详细的后端 / 前端文档分别在 `backend/docs/` 和 `frontend/docs/` 下。

---

## 团队分工

| 角色 | 负责模块 | 目录 |
| --- | --- | --- |
| 后端 | FastAPI 服务、AI 调用、任务编排、PyInstaller 打包 | `backend/` |
| 前端 | Electron 桌面壳、UI、文件交互 | `frontend/` |

---

## 技术栈概览

### 后端（`backend/`）
- **Web 框架**：FastAPI 0.111 + Uvicorn 0.30
- **ORM**：SQLAlchemy 2.0（异步）
- **数据库**：SQLite（aiosqlite）
- **AI 调用**：OpenAI 1.30 异步客户端（支持任意 OpenAI 兼容接口）
- **打包**：PyInstaller（onedir 模式）
- **数据交换格式**：YAML（通过 Pydantic 校验）

### 前端（`frontend/`）
- **运行时**：Electron
- **与后端通信**：HTTP / SSE（流式任务进度）

---

## 快速开始

### 1. 启动后端

```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# macOS / Linux
# source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- 健康检查：<http://localhost:8000/health>
- 交互式 API 文档：<http://localhost:8000/docs>
- OpenAPI Schema：<http://localhost:8000/openapi.json>

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

---

## 核心特性

- **多 AI Provider 管理**：支持添加任意 OpenAI 兼容接口，自带连通性测试
- **异步任务编排**：长任务后台运行，SSE 推送实时进度
- **结构化输出**：通过 Pydantic + YAML 严格约束剧本格式
- **角色一致性**：先抽取全局角色库，再分章生成场景与台词，避免"换人"问题
- **桌面一体化**：打包后双击即用，无需配置 Python 环境

---

## 任务状态机

```
pending → parsing → extracting_characters
        → generating_scenes → generating_dialogues
        → assembling → completed
                       └─→ failed（任一阶段异常）
```

详情参见 [`backend/docs/PRD.md`](./backend/docs/PRD.md) 第 6 节。

---

## 文档导航

| 文档 | 路径 |
| --- | --- |
| 总 PRD | [`backend/docs/PRD.md`](./backend/docs/PRD.md) |
| 后端 PRD | [`backend/docs/BACKEND_PRD.md`](./backend/docs/BACKEND_PRD.md) |
| 前端 PRD | [`backend/docs/FRONTEND_PRD.md`](./backend/docs/FRONTEND_PRD.md) |
| YAML Schema | [`backend/docs/YAML_SCHEMA.md`](./backend/docs/YAML_SCHEMA.md) |

---

## Demo

> 🎬 Demo 视频链接：Bilibili / 云盘（待上传后补充）

---

## 协作流程

- 主分支：`main`（保护分支，所有改动通过 PR 合入）
- 开发流程：每位成员从 `main` 拉取 → 创建 `feature/<name>` 分支 → 提交 PR → Review 后合并
- Commit 规范：建议遵循 `feat: / fix: / docs: / refactor:` 前缀
- 一个 PR 只做一件事（符合提交规则 3.3）

---

## 许可证

本项目仅用于课程作品提交，知识产权归项目团队所有。
详细条款参见 [`backend/docs/PRD.md`](./backend/docs/PRD.md) 及活动主办方要求。
