# 对话式历史记录 & 存储功能 — 设计文档

> 状态：已确认 | 日期：2026-07-07

## 1. 概述

将 Novel2Script 前端改为 **DeepSeek 式对话界面**，支持：
- 多轮对话（每次"开始转换"=一个对话）
- 流式输出剧本（SSE 实时推送文本 Delta）
- 历史记录管理（搜索/分页/删除/撤回/修改/复制）
- 多模态图片上传（模型探测判定）
- 批量/单条导出（YAML/TXT/MD/ZIP）

## 2. 数据模型（新增 3 表）

### `uploaded_novels`
| 字段 | 类型 | 说明 |
|---|---|---|
| id | VARCHAR PK UUID | 原文唯一 ID |
| title | VARCHAR | 小说标题 |
| author | VARCHAR | 作者 |
| content | TEXT | 原文全文 |
| content_hash | VARCHAR | SHA256 用于后续可选去重 |
| char_count | INTEGER | 字数 |
| chapter_count | INTEGER | 章节数 |
| created_at | DATETIME | 上传时间 |

### `conversations`
| 字段 | 类型 | 说明 |
|---|---|---|
| id | VARCHAR PK UUID | 对话 ID |
| title | VARCHAR | 对话标题（默认从原文标题取） |
| novel_id | VARCHAR FK → uploaded_novels.id | 原文引用 |
| provider_id | VARCHAR | 使用的 Provider ID |
| model_name | VARCHAR | 使用的模型名 |
| status | VARCHAR | pending/parsing/.../completed/failed |
| progress | INTEGER | 进度 0-100 |
| detail | VARCHAR | 当前阶段描述 |
| error_code | VARCHAR | 错误码 |
| error_message | VARCHAR | 错误消息 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 最后更新时间 |

### `messages`
| 字段 | 类型 | 说明 |
|---|---|---|
| id | VARCHAR PK UUID | 消息 ID |
| conversation_id | VARCHAR FK → conversations.id | 所属对话 |
| role | VARCHAR | user / assistant / system |
| content | TEXT | 消息内容（user=原文/指令, assistant=剧本） |
| has_image | BOOLEAN | 是否含图片（图片存文件系统） |
| image_paths | TEXT(JSON) | 图片路径列表（JSON 数组） |
| created_at | DATETIME | 消息时间 |

## 3. API 设计

### 3.1 对话 & 消息

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/conversations?page=1&size=20&q=&status=` | 分页列表（支持搜索+状态筛选） |
| GET | `/api/conversations/{id}` | 详情（含消息列表） |
| POST | `/api/conversations` | 新建对话（含原文+首次消息） |
| PUT | `/api/conversations/{id}` | 重命名 `{title}` |
| POST | `/api/conversations/{id}/copy` | 复制对话（深拷贝原文+全部消息） |
| DELETE | `/api/conversations/{id}` | 删除对话及所有消息 |
| POST | `/api/conversations/{id}/messages` | 追加 user 消息（多轮修改） |
| DELETE | `/api/conversations/{id}/messages/{msg_id}` | 撤回消息（删该条及之后） |
| PUT | `/api/conversations/{id}/messages/{msg_id}` | 修改 user 消息（删旧+重建+重新生成） |
| GET | `/api/conversations/{id}/stream` | SSE 流式推送 |

### 3.2 SSE 事件

```
event: progress  → {stage, progress, detail}
event: message   → {message_id, delta}        # assistant 文本增量
event: done      → {conversation_id, message_id, status, duration_ms}
event: error     → {error_code, error_message}
```

### 3.3 多模态探测

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/models/check-multimodal` | `{provider_id, model_name}` → `{is_multimodal: bool}` |

### 3.4 导出

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/conversations/{id}/export?format=yaml|txt|md` | 单条导出 |
| POST | `/api/conversations/export-zip` | `{ids:[...], format}` → ZIP FileResponse |

## 4. 前端架构

### 4.1 路由重构

| 路由 | 页面 | 说明 |
|---|---|---|
| `/` | ChatPage | 主对话页（新） |
| `/providers` | ProvidersPage | 保留不改 |

原有 HomePage/ConvertPage/ProgressPage/ResultPage 全部移除。

### 4.2 ChatPage 三栏布局

```
┌──────────┬───────────────────────┬──────┐
│ 对话列表  │     对话气泡区        │ 详情  │
│ (w-64)   │  user/assistant ...   │ 面板  │
│          │  [撤回] [修改]         │(切换) │
│ - 搜索框 │                       │       │
│ - 对话项 │  ───────────────────  │       │
│ - 新建   │  输入框 [+🖼️] [发送]   │       │
└──────────┴───────────────────────┴──────┘
```

### 4.3 组件树

```
ChatPage
├── ConversationList (左侧栏)
│   ├── SearchBar
│   ├── ConversationItem × N
│   └── NewConversationButton
├── ChatArea (中间)
│   ├── MessageBubble × N
│   │   ├── UserBubble (右对齐, 可编辑)
│   │   └── AssistantBubble (左对齐, 流式渲染, 可展开YAML)
│   ├── MessageActions (撤回/修改三点菜单)
│   ├── TypingIndicator (生成中动画)
│   └── ChatInput (底部输入框)
│       ├── TextArea
│       ├── ImageUploadButton (多模态判定)
│       └── SendButton
├── DetailPanel (右侧, 可折叠)
│   ├── TaskProgress (进度条+阶段)
│   └── ScriptPreview (剧本全文)
└── NewConversationDialog (Modal)
    ├── Provider/Model 选择
    ├── 原文选择/上传
    └── 可选图片
```

### 4.4 状态管理扩展（appStore）

新增字段：
- `conversations: Conversation[]`
- `currentConversation: Conversation | null`
- `messages: Message[]`
- `isStreaming: boolean`
- `detailPanelOpen: boolean`
- `modelMultimodalCache: Record<string, boolean>`

### 4.5 交互细节

- **新建对话**：Modal 弹窗（标题/选原文或新上传/Provider/Model/图片）
- **撤回**：气泡右键菜单 → 撤回 → 二次确认 → 异步删消息
- **修改**：点击 user 气泡 → 编辑态 → 提交 → 删旧消息+重建+自动生成
- **导出**：工具栏导出按钮下拉（YAML/TXT/MD/批量ZIP）
- **图片按钮**：多模态探测失败时灰掉 + tooltip
- **对话状态徽章**：进行中(蓝)/完成(绿)/失败(红)

## 5. 后端实现要点

- 生成逻辑从 `script_generator.py` 改造：不再直接写文件，改为向 assistant message 写 delta
- SSE handler：新文件 `services/sse_handler.py` 管理 SSE 事件推送
- 多模态探测：`services/ai_client.py` 新增 `check_multimodal()` 函数
- ZIP 导出：用 `zipfile` 标准库，临时文件 → FileResponse → 清理
- 撤回/修改：CASCADE 删除该消息及之后所有消息；修改追加新 user 消息并触发新生成
