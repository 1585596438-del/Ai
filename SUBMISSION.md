# Novel2Script（星幕 · StarScript）项目提交说明

> **让故事，走向银幕。**

本文档面向**评审老师**与**协作者**，说明本次提交的内容、规范遵循情况与协作流程。

---

## 1. 仓库信息

| 项目 | 内容 |
| --- | --- |
| 仓库地址 | <https://github.com/1585596438-del/Ai> |
| 项目名称 | **Novel2Script** |
| 产品名称 | **星幕 / StarScript** |
| 团队名称 | **望星** |
| Slogan | 让故事，走向银幕。 |
| Logo | [`frontend/public/brand/logo.png`](./frontend/public/brand/logo.png) |
| 应用图标 | [`frontend/public/brand/app-icon.png`](./frontend/public/brand/app-icon.png)（打包到 Electron 桌面应用） |
| 提交日期 | 2026-06-06 |
| 公开性 | ✅ Public |

---

## 2. 团队分工

| 角色 | 成员 | 负责模块 |
| --- | --- | --- |
| **后端** | Zhiwen P（1585596438@qq.com） | FastAPI 后端、AI 调用、任务编排、PyInstaller 打包 |
| **前端** | user-wangjun（1740925470@qq.com） | Electron 桌面壳、UI、文件交互 |

---

## 3. 提交内容核对（规则 3.1）

| 要求 | 状态 | 说明 |
| --- | --- | --- |
| 公开的 GitHub 仓库 | ✅ | <https://github.com/1585596438-del/Ai> |
| README 文档 | ✅ | 仓库根目录 `README.md` |
| Demo 视频 | ⏳ | 待上传 B 站/云盘，链接将补充在此 |

---

## 4. 仓库结构（规则 3.5 单仓多模块）

```
.
├── backend/                     # FastAPI 后端服务
│   ├── app/
│   │   ├── api/                 # 路由层
│   │   ├── models/              # ORM 模型
│   │   ├── schemas/             # Pydantic Schema
│   │   ├── services/            # 业务逻辑（AI 调用、解析、生成）
│   │   ├── config.py            # 配置
│   │   ├── database.py          # SQLite 初始化
│   │   └── main.py              # FastAPI 入口
│   ├── docs/                    # 后端文档
│   ├── backend.spec             # PyInstaller 打包配置
│   └── requirements.txt
├── frontend/                    # Electron 桌面应用
│   └── .gitkeep                 # 占位（前端开发中）
├── docs/                        # 总项目文档
├── .github/
│   ├── PULL_REQUEST_TEMPLATE.md # PR 描述模板（规则 3.3）
│   └── COMMIT_TEMPLATE          # Commit 模板
├── .gitignore
├── README.md
└── SUBMISSION.md                # 本文件
```

---

## 5. 提交规范遵循情况（规则 3.3）

- ✅ **主分支**：`main`
- ✅ **PR 模板**：`.github/PULL_REQUEST_TEMPLATE.md`（含标题、描述、截图、测试方式四要素）
- ✅ **Commit 模板**：`.github/COMMIT_TEMPLATE`（Conventional Commits 规范）
- ✅ **PR 粒度**：一个 PR 只做一件事
- ✅ **可运行状态**：主分支（main）合并后保持可运行
- ⏳ **分支保护**：建议在 GitHub 仓库 Settings → Branches 设置（owner 操作）

---

## 6. 技术栈概览

### 后端（`backend/`）
- **Web 框架**：FastAPI 0.111 + Uvicorn 0.30
- **ORM**：SQLAlchemy 2.0（异步）
- **数据库**：SQLite（aiosqlite）
- **AI 调用**：OpenAI 1.30 异步客户端（支持任意 OpenAI 兼容接口）
- **打包**：PyInstaller（onedir 模式）
- **数据交换**：YAML（通过 Pydantic 校验）

### 前端（`frontend/`）
- **运行时**：Electron
- **与后端通信**：HTTP + SSE（流式任务进度）

---

## 7. 核心特性

- **多 AI Provider 管理**：支持添加任意 OpenAI 兼容接口，自带连通性测试
- **异步任务编排**：长任务后台运行，SSE 推送实时进度
- **结构化输出**：通过 Pydantic + YAML 严格约束剧本格式
- **角色一致性**：先抽取全局角色库，再分章生成场景与台词，避免"换人"问题
- **桌面一体化**：打包后双击即用，无需配置 Python 环境

---

## 8. 任务状态机

```
pending → parsing → extracting_characters
        → generating_scenes → generating_dialogues
        → assembling → completed
                       └─→ failed（任一阶段异常）
```

详见 [`backend/docs/PRD.md`](./backend/docs/PRD.md) 第 6 节。

---

## 9. 文档导航

| 文档 | 路径 |
| --- | --- |
| 总 PRD | [`backend/docs/PRD.md`](./backend/docs/PRD.md) |
| 后端 PRD | [`backend/docs/BACKEND_PRD.md`](./backend/docs/BACKEND_PRD.md) |
| 前端 PRD | [`backend/docs/FRONTEND_PRD.md`](./backend/docs/FRONTEND_PRD.md) |
| YAML Schema | [`backend/docs/YAML_SCHEMA.md`](./backend/docs/YAML_SCHEMA.md) |
| 提交说明 | [`SUBMISSION.md`](./SUBMISSION.md) |
| 仓库说明 | [`README.md`](./README.md) |
| **后端模块参考** | [`docs/MODULE_REFERENCE.md`](./docs/MODULE_REFERENCE.md) |

> 💡 **PR 提交规范**：每次 PR 描述必须引用 [`docs/MODULE_REFERENCE.md`](./docs/MODULE_REFERENCE.md) 对应章节，说明本次改动涉及哪些模块的哪些函数。

---

## 10. Demo 视频

- 🎬 链接：_待上传后补充_

---

## 11. 知识产权与学术诚信（规则 3.6）

- ✅ 所有代码为团队原创
- ✅ 第三方依赖（FastAPI、SQLAlchemy、OpenAI 客户端等）均来自 MIT / Apache 2.0 等开源协议
- ✅ 知识产权归项目团队所有
- ✅ 遵循学术诚信，未使用未授权的第三方代码

---

## 12. 协作流程

1. 从 `main` 拉取最新代码
2. 创建 `feature/<name>` 分支
3. 开发并按规范提交 commit
4. 推送到远端并创建 PR
5. 评审通过后合并到 main
6. **所有改动走 PR 流程，不允许直推 main**（符合规则 3.3）
