# Novel2Script 后端开发需求文档 (PRD)

## 1. 项目定位

AI 辅助小说转剧本工具的后端服务。接收小说文本，调用 LLM 分阶段生成结构化剧本（YAML），最终通过 PyInstaller 打包为桌面应用的内嵌服务。

---

## 2. 技术栈

| 组件 | 选型 | 版本 |
|------|------|------|
| Web 框架 | FastAPI | 0.111.0 |
| ASGI 服务器 | Uvicorn | 0.30.0 |
| 数据校验 | Pydantic v2 | 2.7.0 |
| ORM | SQLAlchemy (异步) | 2.0.30 |
| 数据库 | SQLite (aiosqlite) | - |
| AI 调用 | OpenAI Python SDK | 1.30.0 |
| YAML 输出 | PyYAML | 6.0.1 |
| 打包 | PyInstaller | - |

---

## 3. 核心功能模块

### 3.1 AI Provider 管理
- 用户可配置多个 OpenAI 兼容的 API 端点
- 每个 Provider 包含：名称、Base URL、API Key、可用模型列表、是否默认
- 支持增删改查、连接测试
- **关键**: API Key 需简单加密存储（如 base64 或轻量 AES）

### 3.2 模型列表获取
- 根据用户填入的 base_url + api_key，代理请求 `/v1/models`
- 返回模型 ID 列表供前端选择

### 3.3 小说转剧本（核心）
- 接收小说全文文本（至少3章）
- 分阶段调用 LLM 生成剧本：
  1. **解析章节**: 正则提取章节结构（第X章 / CHAPTER X）
  2. **提取角色**: 调用 LLM 从全文提取角色库（id, name, aliases, description, traits）
  3. **生成场景**: 逐章调用 LLM 生成场景列表（scene_id, location, time, characters_present）
  4. **生成台词**: 逐场景调用 LLM 生成舞台指示 + 台词 + 情绪标注
  5. **组装 YAML**: 用 Pydantic 模型校验并输出 YAML 文件
- 全程 SSE 流式推送进度（status, progress%, detail）

### 3.4 文件服务
- 读取本地文件路径内容（Electron 前端传路径，后端读取返回）

### 3.5 任务管理
- 异步任务状态跟踪（pending → parsing → extracting_characters → generating_scenes → generating_dialogues → assembling → completed/failed）
- 支持查询状态、SSE 流式推送、下载结果 YAML

---

## 4. API 接口规范

Base URL: `http://localhost:8000/api`

### Provider 管理

| Method | Path | 功能 | 请求体 | 响应 |
|--------|------|------|--------|------|
| GET | `/providers` | 列表 | - | `[{id, name, base_url, models[], is_default, created_at}]` |
| POST | `/providers` | 创建 | `{name, base_url, api_key, models[], is_default}` | 同上 |
| PUT | `/providers/{id}` | 更新 | 可选字段同上 | 同上 |
| DELETE | `/providers/{id}` | 删除 | - | `{ok: true}` |
| POST | `/providers/{id}/test` | 测试连接 | - | `{ok: true, message}` |

### 模型列表

| Method | Path | 功能 | 请求体 | 响应 |
|--------|------|------|--------|------|
| POST | `/models/fetch` | 获取远端模型 | `{base_url, api_key}` | `{models: ["gpt-4", ...]}` |

### 转换任务

| Method | Path | 功能 | 请求体 | 响应 |
|--------|------|------|--------|------|
| POST | `/convert` | 提交任务 | `{novel: {text, title, author}, provider_id, model}` | `{task_id, status}` |
| GET | `/convert/{id}` | 查询状态 | - | `{task_id, status, progress, detail, error_code, error_message, result_path}` |
| GET | `/convert/{id}/stream` | SSE 进度流 | - | `data: {status, progress, detail, ...}` |
| GET | `/convert/{id}/download` | 下载 YAML | - | `FileResponse` |

### 文件

| Method | Path | 功能 | 请求体 | 响应 |
|--------|------|------|--------|------|
| POST | `/files/read` | 读本地文件 | `{path}` | `{content, filename}` |

### 健康检查

| Method | Path | 响应 |
|--------|------|------|
| GET | `/health` | `{status: "ok"}` |

---

## 5. 数据模型

### AIProvider (SQLite)
```
id: string (PK)
name: string
base_url: string
api_key: string (加密存储)
models: string (逗号分隔)
is_default: boolean
created_at: datetime
```

### ConversionTask (SQLite)
```
id: string (PK)
status: string
progress: integer (0-100)
detail: string
error_code: string | null
error_message: string | null
result_path: string | null
created_at: datetime
updated_at: datetime
```

---

## 6. YAML Schema 输出规范

见 `docs/YAML_SCHEMA.md`，核心结构：

```yaml
script:
  metadata: {title, source_novel, author, generated_at, version, total_scenes, total_characters}
  characters: [{id, name, aliases, description, age, gender, traits, notes}]
  scenes: [{scene_id, chapter_ref, scene_number, title, location, time_of_day, characters_present, content: [{type, text, character, emotion, ...}], notes}]
```

---

## 7. 项目目录结构

```
novel2script-backend/
├── docs/
│   ├── BACKEND_PRD.md
│   └── YAML_SCHEMA.md
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI 入口
│   ├── config.py            # 配置、路径、常量
│   ├── database.py          # SQLAlchemy 初始化
│   ├── models/              # ORM 模型
│   ├── schemas/             # Pydantic 模型
│   ├── api/                 # 路由
│   └── services/            # 业务逻辑
│       ├── ai_client.py     # OpenAI 客户端工厂
│       ├── novel_parser.py  # 小说分章
│       └── script_generator.py  # 剧本生成主流程
├── requirements.txt
└── backend.spec             # PyInstaller 配置