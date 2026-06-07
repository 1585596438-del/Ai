# 后端模块功能参考（Module Reference）

> 本文档详细列出后端（`backend/`）每个文件 / 模块 / 关键代码段的功能职责。  
> **用途**：团队成员提交 PR 时，需在 PR 描述中引用本文档的对应章节，说明本次改动涉及哪些模块、修改了哪些函数。

---

## 1. 应用入口（`backend/app/`）

### 1.1 `app/main.py` — FastAPI 应用入口
**职责**：应用启动、生命周期管理、CORS 配置、health check 端点。

| 位置（行） | 符号 | 功能 |
| --- | --- | --- |
| L11-15 | `lifespan()` | 应用启动时调用 `init_db()` 初始化 SQLite 表 |
| L18-22 | `app = FastAPI(...)` | 创建 FastAPI 实例，设置标题、版本 |
| L25-31 | `add_middleware(CORSMiddleware...)` | 配置 CORS，允许 Electron 渲染进程跨域访问 |
| L33 | `include_router(api_router)` | 挂载 `/api` 前缀的子路由 |
| L36-38 | `GET /health` | 健康检查端点，返回 `{"status": "ok"}` |
| L41-43 | `if __name__ == "__main__"` | 直接运行入口，启动 uvicorn |

### 1.2 `app/config.py` — 全局配置
**职责**：应用配置常量、路径管理、环境变量读取。

| 位置（行） | 符号 | 功能 |
| --- | --- | --- |
| L4 | `APP_NAME` | 应用名常量 `"Novel2Script"` |
| L7-17 | `get_app_data_dir()` | 解析数据目录，优先用 `APP_DATA_DIR` 环境变量，否则用 `~/AppData/Roaming/Novel2Script` |
| L20 | `APP_DATA_DIR` | 应用数据目录（Path 对象） |
| L21 | `DATABASE_URL` | SQLite 异步连接 URL（写入 `APP_DATA_DIR/app.db`） |
| L23 | `PORT` | HTTP 服务端口，默认 8000，可由 `PORT` 环境变量覆盖 |
| L24 | `LOG_LEVEL` | 日志级别，默认 `info` |
| L27-28 | `OUTPUT_DIR` | 生成文件（YAML）输出目录，启动时自动创建 |

### 1.3 `app/database.py` — 数据库初始化
**职责**：SQLAlchemy 异步引擎、Session 工厂、ORM 基类、表创建。

| 位置（行） | 符号 | 功能 |
| --- | --- | --- |
| L5 | `engine` | 全局异步引擎（create_async_engine） |
| L6 | `async_session` | Session 工厂（async_sessionmaker） |
| L7 | `Base` | 所有 ORM 模型的基类（declarative_base） |
| L10-12 | `init_db()` | 创建所有表，FastAPI lifespan 启动时调用 |

---

## 2. 路由层（`backend/app/api/`）

### 2.1 `app/api/__init__.py` — 路由聚合
**职责**：把所有子路由聚合到 `api_router`，统一 `/api` 前缀。

| 位置（行） | 符号 | 功能 |
| --- | --- | --- |
| L4 | `api_router` | 顶层 `APIRouter(prefix="/api")` |
| L5-8 | `include_router(...)` | 挂载 providers/models/convert/files 4 个子路由，分别带 `/providers` `/models` `/convert` `/files` 前缀 |

### 2.2 `app/api/providers.py` — AI Provider 管理
**职责**：AI Provider 的增删改查 + 连通性测试。

| 位置（行） | 符号 | 功能 |
| --- | --- | --- |
| L8-11 | `get_db()` | FastAPI 依赖，注入 `AsyncSession` |
| L14-29 | `GET /api/providers` | 列出所有 Provider |
| L32-58 | `POST /api/providers` | 创建 Provider（设默认时自动取消其他默认） |
| L61-94 | `PUT /api/providers/{id}` | 更新 Provider（部分更新，models 列表自动 join 为逗号分隔字符串） |
| L97-105 | `DELETE /api/providers/{id}` | 删除 Provider |
| L108-122 | `POST /api/providers/{id}/test` | 测试 Provider 连通性（调 `test_connection`） |

### 2.3 `app/api/models.py` — 远端模型列表
**职责**：根据 base_url + api_key 拉取远端 OpenAI 兼容 API 的可用模型列表。

| 位置（行） | 符号 | 功能 |
| --- | --- | --- |
| L9-11 | `FetchModelsRequest` | Pydantic 入参 schema（base_url 必须 http(s) 开头） |
| L14-19 | `POST /api/models/fetch` | 自动补齐 `/v1` 路径，调 `fetch_models` |

### 2.4 `app/api/convert.py` — 转换任务管理
**职责**：任务提交、状态查询、SSE 流式进度、文件下载。

| 位置（行） | 符号 | 功能 |
| --- | --- | --- |
| L16-18 | `get_db()` | 注入 Session |
| L21-42 | `POST /api/convert` | 创建任务，校验 Provider 是否存在，后台 `asyncio.create_task` 启动 `generate_script` |
| L45-61 | `GET /api/convert/{task_id}` | 查询任务状态（状态/进度/详情/错误/结果路径） |
| L64-96 | `GET /api/convert/{task_id}/stream` | SSE 流式推送，每秒一次，状态终态时关闭 |
| L99-106 | `GET /api/convert/{task_id}/download` | 下载生成的 YAML 文件 |

### 2.5 `app/api/files.py` — 本地文件读取
**职责**：Electron 渲染进程读取本地小说文本文件。

| 位置（行） | 符号 | 功能 |
| --- | --- | --- |
| L8-9 | `ReadFileRequest` | Pydantic 入参（path 必填且非空） |
| L12-20 | `POST /api/files/read` | 读取 UTF-8 文本文件，返回 `content + filename`；不存在返回 404，异常返回 500 |

---

## 3. ORM 模型（`backend/app/models/`）

### 3.1 `app/models/__init__.py` — 导出入口
**职责**：导出 `AIProvider`、`ConversionTask`，供其他模块引用。

### 3.2 `app/models/provider.py` — AI Provider 表
**职责**：定义 `ai_providers` 表结构。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | String (UUID) | 主键，自动生成 |
| `name` | String | Provider 名称 |
| `base_url` | String | OpenAI 兼容 API base URL |
| `api_key` | String | API 密钥 |
| `models` | String | 逗号分隔的模型列表 |
| `is_default` | Boolean | 是否默认 Provider |
| `created_at` | DateTime | 创建时间 |

### 3.3 `app/models/task.py` — 转换任务表
**职责**：定义 `conversion_tasks` 表结构，保存任务执行状态。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | String (UUID) | 主键 |
| `status` | String | 任务状态（pending/parsing/extracting_characters/generating_scenes/generating_dialogues/assembling/completed/failed） |
| `progress` | Integer | 进度 0-100 |
| `detail` | String | 详情描述（推送至前端） |
| `error_code` | String? | 错误码（如 4001/5001 等） |
| `error_message` | String? | 错误详情 |
| `result_path` | String? | 生成的 YAML 文件路径 |
| `created_at` / `updated_at` | DateTime | 时间戳 |

---

## 4. Pydantic Schema（`backend/app/schemas/`）

### 4.1 `app/schemas/__init__.py` — 导出入口
**职责**：导出所有 schemas，集中引用。

### 4.2 `app/schemas/novel.py` — 小说与任务相关
**职责**：定义入参/出参 Pydantic 模型。

| 类 | 用途 |
| --- | --- |
| `NovelInput` | 小说文本入参（最小 1000 字，必填 title/author 可选） |
| `ConvertRequest` | 转换任务请求（novel + provider_id + model + custom_prompt 可选） |
| `ConvertResponse` | 转换任务提交响应（task_id + status） |
| `TaskStatus` | 任务状态响应（含进度/详情/错误/结果路径） |

### 4.3 `app/schemas/provider.py` — Provider 相关
**职责**：Provider CRUD 的 Pydantic 模型。

| 类 | 用途 |
| --- | --- |
| `ProviderBase` | 基类（name/base_url/models/is_default） |
| `ProviderCreate` | 创建入参（继承 + api_key） |
| `ProviderUpdate` | 更新入参（所有字段可选） |
| `ProviderOut` | 出参（含 id/created_at，启用 ORM 模式） |

### 4.4 `app/schemas/script.py` — 剧本结构
**职责**：定义剧本的 Pydantic 结构，并提供 YAML 序列化方法。

| 类 | 关键字段 | 用途 |
| --- | --- | --- |
| `ScriptMetadata` | title/source_novel/author/generated_at/version/total_scenes/total_characters/generator | 剧本元信息 |
| `Character` | id（`char_NNN`）/name/aliases/description/age/gender/traits/notes | 角色信息 |
| `SceneContent` | type（`stage_direction/dialogue/transition/voiceover/sound`）/text/character/emotion/target_scene/description | 单条剧本内容（一句台词或一个舞台指示） |
| `Scene` | scene_id（`scene_NNN`）/chapter_ref/scene_number/title/location/time_of_day/characters_present/content/notes | 单个场景 |
| `Script` | metadata/characters/scenes | 整部剧本 |
| `Script.to_yaml()` | — | 序列化为 YAML 字符串，保留字段顺序、不排序、宽行 1000、支持 Unicode |

---

## 5. 业务逻辑层（`backend/app/services/`）

### 5.1 `app/services/ai_client.py` — OpenAI 异步客户端封装
**职责**：封装异步 OpenAI 客户端的常用操作。

| 位置（行） | 符号 | 功能 |
| --- | --- | --- |
| L4-11 | `fetch_models(base_url, api_key)` | 拉取远端模型列表，返回 `(models_list, error_msg)` 元组 |
| L14-22 | `test_connection(base_url, api_key)` | 调 `models.list()` 测试连通性，返回 `(ok, message)` |
| L25-27 | `get_client(base_url, api_key)` | 返回 `AsyncOpenAI` 客户端实例 |
| L30-44 | `chat_completion(client, model, messages, temperature=0.7, max_tokens=4000)` | 封装聊天补全调用，返回首条 choice 的 content |

### 5.2 `app/services/novel_parser.py` — 章节拆分
**职责**：将小说文本按章节结构拆分为 `Chapter` 列表。

| 位置（行） | 符号 | 功能 |
| --- | --- | --- |
| L5-9 | `Chapter` (dataclass) | 章节数据类（index/title/content） |
| L12-53 | `split_chapters(text)` | 主拆分函数，支持"第N章"、中文章节数字、CHAPTER 1/Chapter 1 模式；不足 3 章时回退到双空行分块；仍不足则抛 `ValueError` |
| L56-58 | `extract_sample_for_characters(text, max_chars=8000)` | 取前 N 字符作为角色分析样本 |

### 5.3 `app/services/script_generator.py` — 剧本生成主流程
**职责**：5 阶段 pipeline，编排整个小说→剧本的转换流程。

| 位置（行） | 符号 | 功能 |
| --- | --- | --- |
| L16-43 | `update_task(...)` | 异步更新任务状态/进度/详情/错误/结果路径 |
| L46-123 | `generate_script(task_id, request, provider)` | **主入口**，try/except 包整流程，失败时写入错误状态 |
| L50-53 | Step 1 | `parsing`：调 `split_chapters` 解析章节 |
| L56-59 | Step 2 | `extracting_characters`：调 `_extract_characters` 提取全局角色库 |
| L62-75 | Step 3 | `generating_scenes`：逐章调 `_generate_chapter_scenes`，进度 30%→70% |
| L78-88 | Step 4 | `generating_dialogues`：逐场景调 `_generate_scene_dialogue`，进度 70%→90% |
| L91-114 | Step 5 | `assembling`：组装 `Script` 对象并 `to_yaml()` 写入 `OUTPUT_DIR/{task_id}.yaml` |
| L126-156 | `_extract_characters` | Step 2 实现，prompt 让 LLM 返回 JSON 角色数组，清理 markdown 代码块后 `json.loads` |
| L159-207 | `_generate_chapter_scenes` | Step 3 实现，prompt 让 LLM 返回 JSON 场景数组，构造 `Scene` 对象列表 |
| L210-253 | `_generate_scene_dialogue` | Step 4 实现，prompt 让 LLM 返回 JSON 内容数组，赋给 `scene.content` |

**关键设计**：
- 每个 step 之间用 `await asyncio.sleep(0.5)` 避免触发 LLM 速率限制
- 每个 step 失败时由 `generate_script` 外层 try/except 兜底写入 `failed` 状态
- 角色提取用 `temperature=0.3`（稳定），场景用 `0.5`，台词用 `0.7`（更有创意）

---

## 6. 打包与依赖

### 6.1 `backend/requirements.txt` — 依赖清单
**功能**：声明所有 Python 依赖（FastAPI/Uvicorn/Pydantic/SQLAlchemy/aiosqlite/openai/PyYAML/python-multipart）。

### 6.2 `backend/backend.spec` — PyInstaller 配置
**职责**：定义 Windows 桌面端打包配置。

| 配置项 | 说明 |
| --- | --- |
| `Analysis(['app/main.py'])` | 入口为 `app/main.py` |
| `hiddenimports` | 显式声明 `uvicorn.logging/lifespan.off/protocols.http.auto`、`aiosqlite`、`sqlalchemy.ext.asyncio` |
| `EXE(name='novel2script-backend')` | 输出可执行文件名 |
| `console=True` | 保留控制台窗口（桌面版调试用） |
| `upx=True` | 启用 UPX 压缩 |

> **注意**：`datas=[]` 当前为空。若后续添加 `prompts/` 等静态资源，需在 `datas` 中声明才能被打入 EXE。

---

## 7. 文档（`backend/docs/`）

| 文件 | 用途 |
| --- | --- |
| `PRD.md` | 总产品需求文档 |
| `BACKEND_PRD.md` | 后端专项 PRD |
| `FRONTEND_PRD.md` | 前端专项 PRD（供前端同事使用） |
| `YAML_SCHEMA.md` | 剧本 YAML Schema 详细定义 |

---

## 📌 PR 提交时如何引用本文档

在 PR 描述的 **"影响范围"** 章节，按以下格式引用本文档章节：

```markdown
## 影响范围（Scope）

本次改动涉及：
- `app/api/providers.py`（详见 [MODULE_REFERENCE.md §2.2](docs/MODULE_REFERENCE.md#22-appapiproviderspy--ai-provider-管理)）
- `app/services/script_generator.py`（详见 [MODULE_REFERENCE.md §5.3](docs/MODULE_REFERENCE.md#53-appservicesscript_generatorpy--剧本生成主流程)）

## 改动明细

### `app/api/providers.py`
- 修改 `POST /api/providers`：在创建前增加对 `base_url` 格式的额外校验
- 新增函数 `_validate_base_url_format()`：辅助函数

### `app/services/script_generator.py`
- 修改 `generate_script()` L62-75：增加对 `chapters` 为空列表的防御性处理
```

这样评审者可以快速对照本文档定位改动位置。
