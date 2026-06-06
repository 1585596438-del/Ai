# Novel2Script 后端 PRD

## 1. 项目概述

AI 辅助小说转剧本工具的后端服务，以 FastAPI 构建，最终通过 PyInstaller 打包为桌面应用的内嵌服务。

## 2. 技术栈

- **框架**: FastAPI + Uvicorn
- **配置存储**: SQLite (ai_providers, tasks, app_settings)
- **AI 调用**: `openai` 异步客户端，支持任意 OpenAI 兼容接口
- **任务执行**: 异步 `asyncio`（桌面版无需 Celery）
- **打包**: PyInstaller (onedir 模式)

## 3. 架构模块

```
app/
├── main.py              # FastAPI 入口，CORS，生命周期
├── config.py            # 配置管理、数据库路径、常量
├── database.py          # SQLite + SQLAlchemy 初始化
├── models/
│   ├── __init__.py
│   ├── provider.py      # AIProvider ORM 模型
│   └── task.py          # ConversionTask ORM 模型
├── schemas/
│   ├── __init__.py
│   ├── provider.py      # Pydantic: ProviderCreate, ProviderOut...
│   ├── novel.py         # Pydantic: NovelUpload, Chapter...
│   └── script.py        # Pydantic: Script YAML Schema 定义
├── api/
│   ├── __init__.py
│   ├── providers.py     # /api/providers 路由
│   ├── models.py        # /api/models 路由 (获取模型列表)
│   ├── convert.py       # /api/convert 路由 (提交/状态/结果)
│   └── files.py         # /api/files 路由 (本地文件读取)
├── services/
│   ├── __init__.py
│   ├── ai_client.py     # 动态 OpenAI Client 工厂
│   ├── novel_parser.py  # 小说分章、角色预提取
│   ├── script_generator.py  # LLM 调用生成剧本
│   └── yaml_exporter.py # Pydantic -> YAML 导出
└── prompts/
    ├── extract_characters.txt
    ├── generate_scene.txt
    └── generate_dialogue.txt
```

## 4. API 设计

### 4.1 AI Provider 管理

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/providers` | 列出所有已配置 Provider |
| POST | `/api/providers` | 添加 Provider (name, base_url, api_key) |
| PUT | `/api/providers/{id}` | 更新 Provider |
| DELETE | `/api/providers/{id}` | 删除 Provider |
| POST | `/api/providers/{id}/test` | 测试连接有效性 |

### 4.2 模型列表

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/models/fetch` | 根据 base_url + api_key 获取远端模型列表 |

### 4.3 转换任务

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/convert` | 提交转换任务，返回 task_id |
| GET | `/api/convert/{task_id}` | 查询任务状态与结果 |
| GET | `/api/convert/{task_id}/stream` | SSE 流式进度推送 |
| GET | `/api/convert/{task_id}/download` | 下载生成的 YAML 文件 |

### 4.4 文件

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/files/read` | 读取本地文件路径内容 (Electron 传路径) |

## 5. 核心数据流

```
用户粘贴/拖拽小说
    │
    ▼
[POST /api/convert]
    │
    ├──► 1. NovelParser: 文本分章 (正则/规则匹配 "第X章")
    │
    ├──► 2. AI 调用 Step 1: 提取全局角色库
    │       Prompt: extract_characters.txt
    │       Input: 全文 or 前3章采样
    │
    ├──► 3. 逐章并行 AI 调用 Step 2: 生成场景列表
    │       Prompt: generate_scene.txt
    │       Input: 单章文本 + 角色库上下文
    │
    ├──► 4. 逐场景 AI 调用 Step 3: 生成台词与舞台指示
    │       Prompt: generate_dialogue.txt
    │       Input: 场景描述 + 角色库
    │
    └──► 5. YamlExporter: 组装 Pydantic 模型 -> YAML
            写入本地文件
```

## 6. 任务状态机

```
pending -> parsing -> extracting_characters -> generating_scenes -> generating_dialogues -> assembling -> completed
    │           │                │                      │                      │               │
    └───────────┴────────────────┴──────────────────────┴──────────────────────┴───────────────┘-> failed
```

SSE 推送格式:
```json
{"stage": "generating_scenes", "progress": 45, "detail": "正在生成第3章场景..."}
```

## 7. 错误码

| Code | 说明 |
|------|------|
| 4001 | 小说文本过短 (< 1000 字) |
| 4002 | 未找到章节结构 |
| 4003 | AI Provider 配置无效 |
| 5001 | AI 调用超时 |
| 5002 | AI 返回格式异常 |
| 5003 | YAML 组装失败 |

## 8. 打包说明

### PyInstaller 配置 (backend.spec)

```python
# -*- mode: python ; coding: utf-8 -*-
block_cipher = None
a = Analysis(
    ['app/main.py'],
    pathex=[],
    binaries=[],
    datas=[('app/prompts', 'app/prompts')],
    hiddenimports=['uvicorn.logging', 'uvicorn.lifespan.off', 'uvicorn.protocols.http.auto'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='novel2script-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # 桌面版保留控制台便于调试，可改为 False
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
```

### 构建命令

```bash
pyinstaller backend.spec --clean
# 输出: dist/novel2script-backend/
```

### Electron 集成要点

1. 主进程启动 `novel2script-backend/novel2script-backend.exe`
2. 等待 `http://localhost:8000/health` 返回 200
3. 渲染进程加载前端，API Base URL 指向 `http://localhost:8000`
4. 应用退出时 `taskkill` 后端进程

## 9. 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `APP_DATA_DIR` | 系统 AppData/Novel2Script | SQLite 与配置存储路径 |
| `PORT` | 8000 | 服务端口 |
| `LOG_LEVEL` | info | 日志级别 |
