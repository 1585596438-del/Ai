# 对话式历史记录 & 存储功能 — 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 Novel2Script 改为 DeepSeek 式对话界面，支持多轮对话、流式输出、历史管理、多模态图片、导出

**Architecture:** 后端新增 3 张 SQLite 表（uploaded_novels/conversations/messages）+ 对话 CRUD/SSE/导出 API；前端重写为 ChatPage 三栏布局，移除旧页面，用 Zustand 管理对话状态

**Tech Stack:** FastAPI + SQLAlchemy Async + SSE，React 18 + TypeScript + Zustand + TailwindCSS + shadcn/ui

**关联文档：** `docs/plans/2026-07-07-conversation-history-design.md`

---

### Task 1: 后端 — 新数据库模型

**Files:**
- Create: `backend/app/models/conversation.py`
- Create: `backend/app/models/uploaded_novel.py`
- Create: `backend/app/models/message.py`
- Modify: `backend/app/models/__init__.py`

**Step 1: 创建 `uploaded_novel.py`**

```python
"""原文上传快照模型 — 被对话引用，可复用"""
import uuid
import hashlib
from sqlalchemy import Column, String, Integer, DateTime, Text
from sqlalchemy.sql import func
from app.database import Base


class UploadedNovel(Base):
    __tablename__ = "uploaded_novels"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, default="")
    author = Column(String, default="")
    content = Column(Text, default="")
    content_hash = Column(String, default="")  # SHA256
    char_count = Column(Integer, default=0)
    chapter_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    @staticmethod
    def compute_hash(text: str) -> str:
        return hashlib.sha256(text.encode("utf-8")).hexdigest()
```

**Step 2: 创建 `conversation.py`**

```python
"""对话模型 — 一次"开始转换"对应一条 Conversation"""
import uuid
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, default="新对话")
    novel_id = Column(String, ForeignKey("uploaded_novels.id"), nullable=True)
    provider_id = Column(String, default="")
    model_name = Column(String, default="")
    status = Column(String, default="pending")
    progress = Column(Integer, default=0)
    detail = Column(String, default="")
    error_code = Column(String, nullable=True)
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 关系
    novel = relationship("UploadedNovel", lazy="joined")
    messages = relationship(
        "Message", back_populates="conversation",
        order_by="Message.created_at", cascade="all, delete-orphan"
    )
```

**Step 3: 创建 `message.py`**

```python
"""消息模型 — 对话中的每条 user/assistant/system 消息"""
import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, default="user")  # user / assistant / system
    content = Column(Text, default="")
    has_image = Column(Boolean, default=False)
    image_paths = Column(String, nullable=True)  # JSON 数组字符串
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 反向引用
    conversation = relationship("Conversation", back_populates="messages")
```

**Step 4: 更新 `models/__init__.py`**

```python
from app.database import Base
from app.models.provider import AIProvider
from app.models.task import ConversionTask
from app.models.uploaded_novel import UploadedNovel
from app.models.conversation import Conversation
from app.models.message import Message

__all__ = ["Base", "AIProvider", "ConversionTask", "UploadedNovel", "Conversation", "Message"]
```

**Step 5: 验证**

Run: `cd backend && python -c "from app.models import UploadedNovel, Conversation, Message; print('models OK')"`
Expected: `models OK` (需先安装依赖)

**Step 6: Commit**

```bash
git add backend/app/models/conversation.py backend/app/models/uploaded_novel.py backend/app/models/message.py backend/app/models/__init__.py
git commit -m "feat(backend): add UploadedNovel, Conversation, Message models"
```

---

### Task 2: 后端 — 对话 Schema 定义

**Files:**
- Create: `backend/app/schemas/conversation.py`

**Step 1: 创建 Schema 文件**

```python
"""对话相关 Pydantic Schemas"""
from __future__ import annotations
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class NovelInput(BaseModel):
    """新建对话时的原文输入"""
    title: str = ""
    author: str = ""
    text: str = Field(..., min_length=1)


class CreateConversationRequest(BaseModel):
    """POST /api/conversations 请求体"""
    title: str = Field(default="新对话", max_length=200)
    novel: NovelInput
    provider_id: str = Field(..., min_length=1)
    model_name: str = Field(..., min_length=1)
    image_paths: Optional[List[str]] = None  # 可选图片（需多模态模型）


class AddMessageRequest(BaseModel):
    """POST /api/conversations/{id}/messages 请求体"""
    text: str = Field(..., min_length=1)
    image_paths: Optional[List[str]] = None


class UpdateMessageRequest(BaseModel):
    """PUT /api/conversations/{id}/messages/{msg_id} 请求体"""
    text: str = Field(..., min_length=1)
    image_paths: Optional[List[str]] = None


class RenameConversationRequest(BaseModel):
    """PUT /api/conversations/{id} 请求体"""
    title: str = Field(..., min_length=1, max_length=200)


class MessageOut(BaseModel):
    """单条消息输出"""
    id: str
    conversation_id: str
    role: str
    content: str
    has_image: bool = False
    image_paths: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ConversationOut(BaseModel):
    """对话列表项（不含消息）"""
    id: str
    title: str
    novel_id: Optional[str] = None
    novel_title: str = ""
    novel_author: str = ""
    provider_id: str = ""
    model_name: str = ""
    status: str
    progress: int = 0
    detail: str = ""
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    message_count: int = 0
    last_message_preview: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ConversationDetail(BaseModel):
    """对话详情（含消息列表）"""
    id: str
    title: str
    novel_id: Optional[str] = None
    novel_title: str = ""
    novel_author: str = ""
    provider_id: str = ""
    model_name: str = ""
    status: str
    progress: int = 0
    detail: str = ""
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    messages: List[MessageOut] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ConversationListResponse(BaseModel):
    """分页列表响应"""
    items: List[ConversationOut]
    total: int
    page: int
    size: int
    pages: int


class ExportZipRequest(BaseModel):
    """POST /api/conversations/export-zip 请求体"""
    ids: List[str] = Field(..., min_length=1)
    format: str = Field(default="yaml")  # yaml / txt / md


class CheckMultimodalRequest(BaseModel):
    """POST /api/models/check-multimodal 请求体"""
    provider_id: str = Field(..., min_length=1)
    model_name: str = Field(..., min_length=1)
```

**Step 2: Commit**

```bash
git add backend/app/schemas/conversation.py
git commit -m "feat(backend): add conversation schemas"
```

---

### Task 3: 后端 — AI Client 扩展（SSE handler + 多模态探测）

**Files:**
- Create: `backend/app/services/sse_handler.py`
- Modify: `backend/app/services/ai_client.py`

**Step 1: 创建 `sse_handler.py`**

```python
"""SSE 事件推送管理器 — 在异步生成任务中用来广播进度和文本"""
import asyncio
import json
import time
from typing import Optional


class SSEHandler:
    """SSE 事件队列：生成任务往里放事件，/stream 端点往外取"""

    def __init__(self):
        self._queue: asyncio.Queue[Optional[str]] = asyncio.Queue()
        self._start_time = time.time()

    def progress(self, stage: str, progress: int, detail: str = ""):
        """推送进度事件"""
        payload = json.dumps({
            "event": "progress",
            "data": {"stage": stage, "progress": progress, "detail": detail}
        }, ensure_ascii=False)
        self._queue.put_nowait(f"event: progress\ndata: {payload}\n\n")

    def message_delta(self, message_id: str, delta: str):
        """推送消息文本增量"""
        payload = json.dumps({
            "event": "message",
            "data": {"message_id": message_id, "delta": delta}
        }, ensure_ascii=False)
        self._queue.put_nowait(f"event: message\ndata: {payload}\n\n")

    def done(self, conversation_id: str, message_id: str, status: str = "completed"):
        """推送完成事件"""
        duration_ms = int((time.time() - self._start_time) * 1000)
        payload = json.dumps({
            "event": "done",
            "data": {
                "conversation_id": conversation_id,
                "message_id": message_id,
                "status": status,
                "duration_ms": duration_ms
            }
        }, ensure_ascii=False)
        self._queue.put_nowait(f"event: done\ndata: {payload}\n\n")
        self._queue.put_nowait(None)  # 结束信号

    def error(self, error_code: str, error_message: str):
        """推送错误事件"""
        payload = json.dumps({
            "event": "error",
            "data": {"error_code": error_code, "error_message": error_message}
        }, ensure_ascii=False)
        self._queue.put_nowait(f"event: error\ndata: {payload}\n\n")
        self._queue.put_nowait(None)

    async def __aiter__(self):
        while True:
            item = await self._queue.get()
            if item is None:
                break
            yield item


# 全局注册表：conversation_id → SSEHandler
_handlers: dict[str, SSEHandler] = {}

def get_handler(conversation_id: str) -> SSEHandler:
    handler = SSEHandler()
    _handlers[conversation_id] = handler
    return handler

def remove_handler(conversation_id: str):
    _handlers.pop(conversation_id, None)

def get_existing_handler(conversation_id: str) -> Optional[SSEHandler]:
    return _handlers.get(conversation_id)
```

**Step 2: 在 `ai_client.py` 中追加多模态探测函数**

在 `backend/app/services/ai_client.py` 末尾追加：

```python
# 追加在文件末尾

def _make_empty_png_base64() -> str:
    """生成一个 1×1 透明 PNG 的 base64（最小探测图）"""
    # 最小的透明 PNG: 68 字节
    import base64
    # 1x1 transparent PNG
    raw = (
        b"\x89PNG\r\n\x1a\n"          # PNG signature
        b"\x00\x00\x00\rIHDR"         # IHDR chunk
        b"\x00\x00\x00\x01\x00\x00\x00\x01"  # 1x1
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
        b"\x00\x00\x00\x0aIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01"
        b"\r\n\xe2\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    return base64.b64encode(raw).decode()


async def check_multimodal(base_url: str, api_key: str, model_name: str) -> bool:
    """
    探测模型是否支持多模态（图片输入）。
    发送一个最小图片 + 文本请求，成功返回 True，失败返回 False。
    """
    import httpx

    url = base_url.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model_name,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": "Reply with exactly: OK"},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{_make_empty_png_base64()}"}},
            ]
        }],
        "max_tokens": 5,
        "temperature": 0,
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                return "OK" in content
            return False
    except Exception:
        return False


# 多模态探测结果缓存（按 model_name 缓存，避免重复探测）
_multimodal_cache: dict[str, bool] = {}

async def check_multimodal_cached(base_url: str, api_key: str, model_name: str) -> bool:
    """带缓存的多模态探测"""
    if model_name in _multimodal_cache:
        return _multimodal_cache[model_name]
    result = await check_multimodal(base_url, api_key, model_name)
    _multimodal_cache[model_name] = result
    return result
```

**Step 3: Commit**

```bash
git add backend/app/services/sse_handler.py backend/app/services/ai_client.py
git commit -m "feat(backend): add SSEHandler and multimodal detection"
```

---

### Task 4: 后端 — 对话 CRUD API

**Files:**
- Create: `backend/app/api/conversations.py`

**Step 1: 创建完整 API 路由文件**

这是最大的一个文件，需要包含所有对话 CRUD + 消息操作 + SSE 流 + 导出。详见下方代码：

```python
"""对话 & 消息 API — 核心 CRUD + SSE 流 + 导出"""
import asyncio
import json
import tempfile
import zipfile
import io
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete, and_

from app.database import async_session
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.uploaded_novel import UploadedNovel
from app.models.provider import AIProvider
from app.schemas.conversation import (
    CreateConversationRequest, AddMessageRequest, UpdateMessageRequest,
    RenameConversationRequest, ExportZipRequest, CheckMultimodalRequest,
    ConversationOut, ConversationDetail, ConversationListResponse,
    MessageOut,
)
from app.services.sse_handler import get_handler, get_existing_handler, remove_handler
from app.services.ai_client import check_multimodal_cached

router = APIRouter()


async def get_db():
    async with async_session() as session:
        yield session


# ──────────────────── 多模态探测 ────────────────────

@router.post("/check-multimodal")
async def check_multimodal_endpoint(data: CheckMultimodalRequest, db: AsyncSession = Depends(get_db)):
    """探测指定模型是否支持多模态"""
    result = await db.execute(select(AIProvider).where(AIProvider.id == data.provider_id))
    provider = result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=400, detail={"error_code": "PROVIDER_NOT_FOUND", "error_message": "Provider 不存在"})

    base_url = provider.base_url.rstrip("/") + "/v1"
    is_multimodal = await check_multimodal_cached(base_url, provider.api_key, data.model_name)
    return {"is_multimodal": is_multimodal, "model_name": data.model_name}


# ──────────────────── 对话列表 ────────────────────

@router.get("", response_model=ConversationListResponse)
async def list_conversations(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    q: str = Query(default=""),      # 搜索关键词
    status: str = Query(default=""), # 按状态筛选
    db: AsyncSession = Depends(get_db),
):
    """分页列出所有对话，支持搜索和状态筛选"""
    base_query = select(Conversation)

    # 搜索：匹配标题
    if q:
        base_query = base_query.where(Conversation.title.ilike(f"%{q}%"))

    # 状态筛选
    if status:
        base_query = base_query.where(Conversation.status == status)

    # 总数
    count_query = select(func.count()).select_from(base_query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # 分页
    offset = (page - 1) * size
    rows = (await db.execute(
        base_query.order_by(Conversation.updated_at.desc()).offset(offset).limit(size)
    )).scalars().all()

    # 组装输出（含原文标题、消息数、最后消息预览）
    items = []
    for conv in rows:
        # 消息数量
        msg_count = (await db.execute(
            select(func.count()).select_from(Message).where(Message.conversation_id == conv.id)
        )).scalar() or 0

        # 最后消息预览
        last_msg = (await db.execute(
            select(Message).where(Message.conversation_id == conv.id)
            .order_by(Message.created_at.desc()).limit(1)
        )).scalar_one_or_none()

        items.append(ConversationOut(
            id=conv.id,
            title=conv.title,
            novel_id=conv.novel_id,
            novel_title=getattr(conv.novel, "title", ""),
            novel_author=getattr(conv.novel, "author", ""),
            provider_id=conv.provider_id,
            model_name=conv.model_name,
            status=conv.status,
            progress=conv.progress,
            detail=conv.detail,
            error_code=conv.error_code,
            error_message=conv.error_message,
            message_count=msg_count,
            last_message_preview=last_msg.content[:100] if last_msg else "",
            created_at=conv.created_at,
            updated_at=conv.updated_at,
        ))

    pages = max(1, (total + size - 1) // size)
    return ConversationListResponse(items=items, total=total, page=page, size=size, pages=pages)


# ──────────────────── 对话详情 ────────────────────

@router.get("/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(conversation_id: str, db: AsyncSession = Depends(get_db)):
    """获取对话详情（含全部消息）"""
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail={"error_code": "NOT_FOUND", "error_message": "对话不存在"})

    # 获取消息列表
    msgs_result = await db.execute(
        select(Message).where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    messages = [
        MessageOut(
            id=m.id, conversation_id=m.conversation_id, role=m.role,
            content=m.content, has_image=m.has_image,
            image_paths=m.image_paths, created_at=m.created_at,
        )
        for m in msgs_result.scalars().all()
    ]

    return ConversationDetail(
        id=conv.id, title=conv.title,
        novel_id=conv.novel_id,
        novel_title=getattr(conv.novel, "title", ""),
        novel_author=getattr(conv.novel, "author", ""),
        provider_id=conv.provider_id, model_name=conv.model_name,
        status=conv.status, progress=conv.progress,
        detail=conv.detail, error_code=conv.error_code,
        error_message=conv.error_message,
        messages=messages,
        created_at=conv.created_at, updated_at=conv.updated_at,
    )


# ──────────────────── 新建对话 ────────────────────

@router.post("", status_code=201)
async def create_conversation(data: CreateConversationRequest, db: AsyncSession = Depends(get_db)):
    """新建对话：存原文 → 创建对话 + user 消息 → 后台跑任务"""
    # 校验 Provider
    provider_result = await db.execute(
        select(AIProvider).where(AIProvider.id == data.provider_id)
    )
    provider = provider_result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=400, detail={"error_code": "PROVIDER_NOT_FOUND", "error_message": "Provider 不存在"})
    if not provider.is_active:
        raise HTTPException(status_code=400, detail={"error_code": "PROVIDER_INACTIVE", "error_message": "Provider 未激活"})

    # 创建原文记录
    novel = UploadedNovel(
        title=data.novel.title or data.title,
        author=data.novel.author,
        content=data.novel.text,
        content_hash=UploadedNovel.compute_hash(data.novel.text),
        char_count=len(data.novel.text),
        chapter_count=0,  # 由生成器解析
    )
    db.add(novel)
    await db.flush()

    # 创建对话
    conv = Conversation(
        title=data.title or data.novel.title or "新对话",
        novel_id=novel.id,
        provider_id=data.provider_id,
        model_name=data.model_name,
        status="pending",
    )
    db.add(conv)
    await db.flush()

    # 创建 user 消息
    user_msg = Message(
        conversation_id=conv.id,
        role="user",
        content=data.novel.text,
        has_image=bool(data.image_paths),
        image_paths=json.dumps(data.image_paths) if data.image_paths else None,
    )
    db.add(user_msg)

    # 创建 assistant 消息（占位，生成时填充）
    assistant_msg = Message(
        conversation_id=conv.id,
        role="assistant",
        content="",
    )
    db.add(assistant_msg)
    await db.commit()

    # 创建 SSE handler 并启动后台任务
    handler = get_handler(conv.id)

    from app.services.script_generator import generate_script_for_conversation
    asyncio.create_task(
        generate_script_for_conversation(
            conv.id, assistant_msg.id, data.novel.text,
            provider, handler, data.image_paths,
        )
    )

    return {
        "conversation_id": conv.id,
        "user_message_id": user_msg.id,
        "assistant_message_id": assistant_msg.id,
    }


# ──────────────────── 重命名 ────────────────────

@router.put("/{conversation_id}")
async def rename_conversation(
    conversation_id: str,
    data: RenameConversationRequest,
    db: AsyncSession = Depends(get_db),
):
    """重命名对话"""
    result = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail={"error_code": "NOT_FOUND", "error_message": "对话不存在"})

    conv.title = data.title
    await db.commit()
    return {"ok": True}


# ──────────────────── 复制 ────────────────────

@router.post("/{conversation_id}/copy", status_code=201)
async def copy_conversation(conversation_id: str, db: AsyncSession = Depends(get_db)):
    """深拷贝整个对话（原文 + 全部消息），标题加「的副本」后缀"""
    result = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail={"error_code": "NOT_FOUND", "error_message": "对话不存在"})

    # 创建新对话
    new_conv = Conversation(
        title=f"{conv.title} 的副本",
        novel_id=conv.novel_id,
        provider_id=conv.provider_id,
        model_name=conv.model_name,
        status="completed" if conv.status in ("completed", "failed") else "pending",
    )
    db.add(new_conv)
    await db.flush()

    # 复制消息
    msgs = (await db.execute(
        select(Message).where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )).scalars().all()

    for msg in msgs:
        new_msg = Message(
            conversation_id=new_conv.id,
            role=msg.role,
            content=msg.content,
            has_image=msg.has_image,
            image_paths=msg.image_paths,
        )
        db.add(new_msg)

    await db.commit()
    return {"conversation_id": new_conv.id}


# ──────────────────── 删除对话 ────────────────────

@router.delete("/{conversation_id}")
async def delete_conversation(conversation_id: str, db: AsyncSession = Depends(get_db)):
    """删除对话及所有消息"""
    result = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail={"error_code": "NOT_FOUND", "error_message": "对话不存在"})

    await db.delete(conv)
    await db.commit()
    remove_handler(conversation_id)
    return {"ok": True}


# ──────────────────── 追加消息（多轮修改） ────────────────────

@router.post("/{conversation_id}/messages", status_code=201)
async def add_message(
    conversation_id: str,
    data: AddMessageRequest,
    db: AsyncSession = Depends(get_db),
):
    """在已有对话中追加 user 消息，触发新生成"""
    result = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail={"error_code": "NOT_FOUND", "error_message": "对话不存在"})

    # 校验 Provider 仍可用
    provider_result = await db.execute(select(AIProvider).where(AIProvider.id == conv.provider_id))
    provider = provider_result.scalar_one_or_none()
    if not provider or not provider.is_active:
        raise HTTPException(status_code=400, detail={"error_code": "PROVIDER_INACTIVE", "error_message": "Provider 不可用"})

    # 创建 user 消息
    user_msg = Message(
        conversation_id=conv.id,
        role="user",
        content=data.text,
        has_image=bool(data.image_paths),
        image_paths=json.dumps(data.image_paths) if data.image_paths else None,
    )
    db.add(user_msg)

    # 创建 assistant 消息
    assistant_msg = Message(conversation_id=conv.id, role="assistant", content="")
    db.add(assistant_msg)

    # 重置对话状态
    conv.status = "pending"
    conv.progress = 0
    conv.detail = ""
    conv.error_code = None
    conv.error_message = None
    await db.commit()

    # 启动生成
    # 获取原文内容（从第一条 user 消息取）
    first_msg = (await db.execute(
        select(Message).where(
            and_(Message.conversation_id == conv.id, Message.role == "user")
        ).order_by(Message.created_at.asc()).limit(1)
    )).scalar_one_or_none()

    # 获取多轮历史上下文
    all_msgs = (await db.execute(
        select(Message).where(Message.conversation_id == conv.id)
        .order_by(Message.created_at.asc())
    )).scalars().all()

    # 构建上下文
    context_messages = []
    for m in all_msgs:
        if m.id == assistant_msg.id:
            break  # 不包括当前 assistant
        context_messages.append({"role": m.role, "content": m.content})

    handler = get_handler(conv.id)
    from app.services.script_generator import generate_script_for_conversation
    asyncio.create_task(
        generate_script_for_conversation(
            conv.id, assistant_msg.id,
            first_msg.content if first_msg else data.text,
            provider, handler, data.image_paths,
            context_messages=context_messages,
        )
    )

    return {"user_message_id": user_msg.id, "assistant_message_id": assistant_msg.id}


# ──────────────────── 撤回消息 ────────────────────

@router.delete("/{conversation_id}/messages/{message_id}")
async def retract_message(
    conversation_id: str,
    message_id: str,
    db: AsyncSession = Depends(get_db),
):
    """撤回消息：删除该消息及之后所有消息"""
    result = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail={"error_code": "NOT_FOUND", "error_message": "对话不存在"})

    target = (await db.execute(
        select(Message).where(
            and_(Message.id == message_id, Message.conversation_id == conversation_id)
        )
    )).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail={"error_code": "MSG_NOT_FOUND", "error_message": "消息不存在"})

    # 删除该消息及之后的所有消息
    later_msgs = (await db.execute(
        select(Message).where(
            and_(
                Message.conversation_id == conversation_id,
                Message.created_at >= target.created_at,
            )
        )
    )).scalars().all()
    for m in later_msgs:
        await db.delete(m)

    # 更新对话状态
    conv.status = "completed"
    conv.progress = 0
    conv.detail = ""
    await db.commit()
    return {"ok": True, "deleted_count": len(later_msgs)}


# ──────────────────── 修改消息 ────────────────────

@router.put("/{conversation_id}/messages/{message_id}")
async def edit_message(
    conversation_id: str,
    message_id: str,
    data: UpdateMessageRequest,
    db: AsyncSession = Depends(get_db),
):
    """修改 user 消息：删除旧消息及之后 → 用新内容重建 → 触发重新生成"""
    result = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail={"error_code": "NOT_FOUND", "error_message": "对话不存在"})

    target = (await db.execute(
        select(Message).where(
            and_(Message.id == message_id, Message.conversation_id == conversation_id)
        )
    )).scalar_one_or_none()
    if not target or target.role != "user":
        raise HTTPException(status_code=400, detail={"error_code": "INVALID_MSG", "error_message": "只能修改 user 消息"})

    # 删除该消息及之后的消息
    later_msgs = (await db.execute(
        select(Message).where(
            and_(
                Message.conversation_id == conversation_id,
                Message.created_at >= target.created_at,
            )
        )
    )).scalars().all()
    for m in later_msgs:
        await db.delete(m)
    await db.flush()

    # 重建 user 消息
    new_user_msg = Message(
        conversation_id=conv.id,
        role="user",
        content=data.text,
        has_image=bool(data.image_paths),
        image_paths=json.dumps(data.image_paths) if data.image_paths else None,
    )
    db.add(new_user_msg)

    # 创建 assistant 消息
    assistant_msg = Message(conversation_id=conv.id, role="assistant", content="")
    db.add(assistant_msg)

    # 重置对话状态
    conv.status = "pending"
    conv.progress = 0
    conv.detail = ""
    conv.error_code = None
    conv.error_message = None
    await db.commit()

    # 校验 Provider
    provider_result = await db.execute(select(AIProvider).where(AIProvider.id == conv.provider_id))
    provider = provider_result.scalar_one_or_none()

    # 获取多轮上下文
    all_msgs = (await db.execute(
        select(Message).where(Message.conversation_id == conv.id)
        .order_by(Message.created_at.asc())
    )).scalars().all()
    context_messages = []
    for m in all_msgs:
        if m.id == assistant_msg.id:
            break
        context_messages.append({"role": m.role, "content": m.content})

    # 启动生成
    if provider and provider.is_active:
        handler = get_handler(conv.id)
        from app.services.script_generator import generate_script_for_conversation
        asyncio.create_task(
            generate_script_for_conversation(
                conv.id, assistant_msg.id, data.text,
                provider, handler, data.image_paths,
                context_messages=context_messages,
            )
        )

    return {"user_message_id": new_user_msg.id, "assistant_message_id": assistant_msg.id}


# ──────────────────── SSE 流 ────────────────────

@router.get("/{conversation_id}/stream")
async def stream_conversation(conversation_id: str):
    """SSE 流式推送对话生成进度和文本"""
    handler = get_existing_handler(conversation_id)
    if not handler:
        # 如果 handler 不存在，说明任务已经完成/不存在，返回空流
        async def empty_gen():
            yield "event: error\ndata: {\"error_code\":\"NOT_STREAMING\",\"error_message\":\"No active stream\"}\n\n"
        return StreamingResponse(empty_gen(), media_type="text/event-stream")

    return StreamingResponse(handler, media_type="text/event-stream")


# ──────────────────── 导出 ────────────────────

@router.get("/{conversation_id}/export")
async def export_conversation(
    conversation_id: str,
    format: str = Query("yaml"),
    db: AsyncSession = Depends(get_db),
):
    """单条导出对话为 YAML/TXT/MD"""
    result = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail={"error_code": "NOT_FOUND", "error_message": "对话不存在"})

    msgs = (await db.execute(
        select(Message).where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )).scalars().all()

    content, ext, media_type = _build_export_content(conv, msgs, format)

    with tempfile.NamedTemporaryFile(mode="w", suffix=f".{ext}", delete=False, encoding="utf-8") as f:
        f.write(content)
        tmp_path = f.name

    filename = f"{conv.title}.{ext}"
    return FileResponse(tmp_path, filename=filename, media_type=media_type)


@router.post("/export-zip")
async def export_zip(data: ExportZipRequest, db: AsyncSession = Depends(get_db)):
    """批量导出选中的对话为 ZIP"""
    # 必须用独立 session 因为 FileResponse 在 context 外
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        async with async_session() as session:
            for cid in data.ids:
                result = await session.execute(select(Conversation).where(Conversation.id == cid))
                conv = result.scalar_one_or_none()
                if not conv:
                    continue

                msgs_result = await session.execute(
                    select(Message).where(Message.conversation_id == cid)
                    .order_by(Message.created_at.asc())
                )
                msgs = msgs_result.scalars().all()

                content, ext, _ = _build_export_content(conv, msgs, data.format)
                zf.writestr(f"{conv.title}.{ext}", content)

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=conversations.zip"}
    )


# ──────────────────── 导出辅助函数 ────────────────────

def _build_export_content(conv, msgs, fmt: str) -> tuple[str, str, str]:
    """根据格式构建导出内容和元信息 返回 (content, ext, media_type)"""
    if fmt == "yaml":
        content = f"# {conv.title}\n"
        content += f"# 模型: {conv.model_name}\n"
        content += f"# 时间: {conv.created_at}\n\n"
        for m in msgs:
            content += f"# --- {m.role} ---\n{m.content}\n\n"
        return content, "yaml", "application/x-yaml"

    elif fmt == "md":
        content = f"# {conv.title}\n\n"
        content += f"> 模型: {conv.model_name} | 时间: {conv.created_at}\n\n"
        for m in msgs:
            role_label = "**用户**" if m.role == "user" else "**AI 助手**"
            content += f"### {role_label}\n\n{m.content}\n\n---\n\n"
        return content, "md", "text/markdown"

    else:  # txt
        content = f"{'='*60}\n{conv.title}\n{'='*60}\n\n"
        for m in msgs:
            role_label = "[用户]" if m.role == "user" else "[AI 助手]"
            content += f"{role_label}:\n{m.content}\n\n"
        return content, "txt", "text/plain"
```

**Step 2: 更新 `api/__init__.py` 注册路由**

```python
from fastapi import APIRouter
from app.api import providers, models, convert, files, conversations

api_router = APIRouter(prefix="/api")
api_router.include_router(providers.router, prefix="/providers", tags=["providers"])
api_router.include_router(models.router, prefix="/models", tags=["models"])
api_router.include_router(convert.router, prefix="/convert", tags=["convert"])
api_router.include_router(files.router, prefix="/files", tags=["files"])
api_router.include_router(conversations.router, prefix="/conversations", tags=["conversations"])
```

注意：多模态探测路由 `/check-multimodal` 需要加在 models router 中，或单独在 conversations router 里。由于它在 `POST /api/models/check-multimodal`，我需要更新 models API。

**Step 3: 在 `api/models.py` 追加多模态探测端点**

```python
# 追加在 models.py 末尾
from app.schemas.conversation import CheckMultimodalRequest
from app.services.ai_client import check_multimodal_cached
from app.models.provider import AIProvider
from sqlalchemy import select
from app.database import async_session

@router.post("/check-multimodal")
async def check_multimodal_endpoint(data: CheckMultimodalRequest):
    async with async_session() as session:
        result = await session.execute(select(AIProvider).where(AIProvider.id == data.provider_id))
        provider = result.scalar_one_or_none()
        if not provider:
            raise HTTPException(status_code=400, detail="Provider not found")
        base_url = provider.base_url.rstrip("/") + "/v1"
        is_multimodal = await check_multimodal_cached(base_url, provider.api_key, data.model_name)
        return {"is_multimodal": is_multimodal, "model_name": data.model_name}
```

**Step 4: 验证**

Run: `cd backend && python -c "from app.api.conversations import router; print('router OK')"` (需先装依赖)

**Step 5: Commit**

```bash
git add backend/app/api/conversations.py backend/app/api/__init__.py backend/app/api/models.py
git commit -m "feat(backend): add conversation CRUD, SSE stream, and export APIs"
```

---

### Task 5: 后端 — 改造生成器支持对话模式

**Files:**
- Modify: `backend/app/services/script_generator.py`

**Step 1: 新增 `generate_script_for_conversation` 函数**

在 `script_generator.py` 中新增函数（保留原有 `generate_script` 用于旧的 convert 流程）：

```python
"""为对话模式生成剧本：通过 SSE handler 推送进度和文本"""
import asyncio
from sqlalchemy import select
from app.database import async_session
from app.models.message import Message
from app.models.conversation import Conversation
from app.services.sse_handler import SSEHandler, remove_handler
from app.services.ai_client import stream_chat_completion


async def generate_script_for_conversation(
    conversation_id: str,
    assistant_message_id: str,
    novel_text: str,
    provider,
    handler: SSEHandler,
    image_paths: list[str] | None = None,
    context_messages: list[dict] | None = None,
):
    """
    对话模式剧本生成主流程：
    1. 通过 SSE handler 流式推送进度
    2. 通过 SSE handler 流式推送 assistant 文本
    3. 完成/失败时更新数据库和 SSE
    """
    try:
        # 阶段 1: 解析小说
        handler.progress("parsing", 10, "正在解析小说结构...")
        await asyncio.sleep(0.1)
        from app.services.novel_parser import parse_novel
        parsed = parse_novel(novel_text)

        # 阶段 2: 提取角色
        handler.progress("extracting_characters", 25, "正在提取角色信息...")
        await asyncio.sleep(0.1)
        characters_text = _build_characters_summary(parsed)

        # 阶段 3: 生成场景
        handler.progress("generating_scenes", 40, "正在生成场景框架...")

        # 搭建系统提示词
        system_prompt = _build_system_prompt(characters_text)

        # 构建消息列表（含上下文）
        messages = [{"role": "system", "content": system_prompt}]
        if context_messages:
            # 拼入历史上下文（最近 K 轮限制 20 条）
            messages.extend(context_messages[-20:])
        else:
            messages.append({"role": "user", "content": novel_text})

        # 如果有图片，拼入
        if image_paths:
            # 对最后一条 user 消息附加图片
            pass  # TODO: 支持多模态图片消息

        # 流式生成
        base_url = provider.base_url.rstrip("/") + "/v1"
        accumulated = ""

        handler.progress("generating_dialogues", 60, "AI 正在生成剧本...")

        async for delta in stream_chat_completion(
            base_url, provider.api_key, provider.default_model or "",
            messages,
        ):
            accumulated += delta
            handler.message_delta(assistant_message_id, delta)

        # 保存到数据库
        async with async_session() as session:
            result = await session.execute(
                select(Message).where(Message.id == assistant_message_id)
            )
            msg = result.scalar_one_or_none()
            if msg:
                msg.content = accumulated

            # 更新对话状态
            conv_result = await session.execute(
                select(Conversation).where(Conversation.id == conversation_id)
            )
            conv = conv_result.scalar_one_or_none()
            if conv:
                conv.status = "completed"
                conv.progress = 100
                conv.detail = "生成完成"

            await session.commit()

        handler.done(conversation_id, assistant_message_id, "completed")

    except Exception as e:
        # 处理错误
        error_msg = str(e)
        handler.error("GENERATION_FAILED", error_msg)

        async with async_session() as session:
            conv_result = await session.execute(
                select(Conversation).where(Conversation.id == conversation_id)
            )
            conv = conv_result.scalar_one_or_none()
            if conv:
                conv.status = "failed"
                conv.error_code = "GENERATION_FAILED"
                conv.error_message = error_msg
                await session.commit()

    finally:
        remove_handler(conversation_id)


def _build_system_prompt(characters_summary: str) -> str:
    """构建系统提示词"""
    return f"""你是一个专业的剧本改写 AI。请根据以下小说内容和角色信息，生成结构化的 YAML 格式剧本。

角色信息：
{characters_summary}

要求：
1. 按章节划分场景
2. 每个场景包含：场景名、地点、时间、角色列表、对话
3. 对话格式为角色名: 台词
4. 用 YAML 格式输出"""


def _build_characters_summary(parsed) -> str:
    """从解析结果构建角色摘要"""
    # 简化实现：直接用 parsed 数据
    if hasattr(parsed, "characters"):
        return "\n".join(f"- {c}" for c in parsed.characters[:20])
    return "（未提取到角色信息）"
```

**注意**：`stream_chat_completion` 需要实现为异步生成器，逐步返回 token。需要检查 `ai_client.py` 是否已有此函数。

**Step 2: 在 `ai_client.py` 中追加 `stream_chat_completion`**

```python
# 追加在 ai_client.py 末尾
import httpx


async def stream_chat_completion(
    base_url: str,
    api_key: str,
    model: str,
    messages: list[dict],
    temperature: float = 0.7,
    max_tokens: int = 4096,
):
    """
    流式聊天补全：异步生成器，逐 token yield delta 内容。
    使用 httpx 的流式响应遍历 SSE 事件。
    """
    url = base_url.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
    }

    async with httpx.AsyncClient(timeout=300.0) as client:
        async with client.stream("POST", url, headers=headers, json=payload) as resp:
            if resp.status_code != 200:
                body = await resp.aread()
                raise RuntimeError(f"API error {resp.status_code}: {body.decode()[:500]}")

            async for line in resp.aiter_lines():
                if line.startswith("data: "):
                    data_str = line[6:]
                    if data_str == "[DONE]":
                        return
                    try:
                        data = json.loads(data_str)
                        delta = data.get("choices", [{}])[0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            yield content
                    except json.JSONDecodeError:
                        continue
```

**Step 3: 验证**

Run: `cd backend && python -c "from app.services.script_generator import generate_script_for_conversation; print('generator OK')"`

**Step 4: Commit**

```bash
git add backend/app/services/script_generator.py backend/app/services/ai_client.py
git commit -m "feat(backend): add conversation-mode generator with SSE streaming"
```

---

### Task 6: 后端 — 清理旧 ConversionTask 引用 & 验证后端

**Files:**
- Modify: `backend/app/api/convert.py`（保留但可标记 deprecated）
- 验证后端启动

**Step 1: 确保 `database.py` 能创建新表**

`database.py` 已经用 `Base.metadata.create_all` 自动建表，不需要改动。

**Step 2: 启动验证**

```bash
cd backend
pip install -r requirements.txt  # 确保 httpx 已在 requirements 中
python -c "from app.main import app; print('FastAPI app OK')"
```

Run: `cd backend && uvicorn app.main:app --port 8000 --reload`
Expected: Server starts on port 8000, visit http://localhost:8000/docs 可看到新 API

**Step 3: Commit**

```bash
git add backend/requirements.txt  # 如果加了 httpx
git commit -m "chore(backend): verify conversation APIs startup"
```

---

### Task 7: 前端 — 类型定义 & API 层

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/api/index.ts`

**Step 1: 更新类型定义**

在 `types/index.ts` 中追加：

```typescript
/** 原文记录 */
export interface UploadedNovel {
  id: string
  title: string
  author: string
  content: string
  content_hash: string
  char_count: number
  chapter_count: number
  created_at: string
}

/** 对话消息 */
export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  has_image: boolean
  image_paths: string | null
  created_at: string
}

/** 对话列表项 */
export interface Conversation {
  id: string
  title: string
  novel_id: string | null
  novel_title: string
  novel_author: string
  provider_id: string
  model_name: string
  status: ConversationStatus
  progress: number
  detail: string
  error_code: string | null
  error_message: string | null
  message_count: number
  last_message_preview: string
  created_at: string
  updated_at: string
}

/** 对话详情（含消息） */
export interface ConversationDetail extends Conversation {
  messages: Message[]
}

/** 对话状态 */
export type ConversationStatus =
  | 'pending'
  | 'parsing'
  | 'extracting_characters'
  | 'generating_scenes'
  | 'generating_dialogues'
  | 'assembling'
  | 'completed'
  | 'failed'

/** 分页响应 */
export interface ConversationListResponse {
  items: Conversation[]
  total: number
  page: number
  size: number
  pages: number
}

/** 新建对话请求 */
export interface CreateConversationRequest {
  title?: string
  novel: {
    title: string
    author: string
    text: string
  }
  provider_id: string
  model_name: string
  image_paths?: string[]
}

/** 追加消息请求 */
export interface AddMessageRequest {
  text: string
  image_paths?: string[]
}
```

**Step 2: 更新 API 层**

在 `api/index.ts` 追加：

```typescript
import type {
  // ...existing types...
  Conversation,
  ConversationDetail,
  ConversationListResponse,
  CreateConversationRequest,
  AddMessageRequest,
} from '@/types'

/* ───────────── Conversations ───────────── */

/** 获取对话列表 */
export const listConversations = (params: {
  page?: number
  size?: number
  q?: string
  status?: string
}) => apiGet<ConversationListResponse>('/conversations', params)

/** 获取对话详情 */
export const getConversation = (id: string) =>
  apiGet<ConversationDetail>(`/conversations/${id}`)

/** 新建对话 */
export const createConversation = (data: CreateConversationRequest) =>
  apiPost<{ conversation_id: string; user_message_id: string; assistant_message_id: string }>(
    '/conversations', data
  )

/** 重命名对话 */
export const renameConversation = (id: string, title: string) =>
  apiPut<{ ok: boolean }>(`/conversations/${id}`, { title })

/** 复制对话 */
export const copyConversation = (id: string) =>
  apiPost<{ conversation_id: string }>(`/conversations/${id}/copy`)

/** 删除对话 */
export const deleteConversation = (id: string) =>
  apiDelete<{ ok: boolean }>(`/conversations/${id}`)

/** 追加消息（多轮修改） */
export const addMessage = (convId: string, data: AddMessageRequest) =>
  apiPost<{ user_message_id: string; assistant_message_id: string }>(
    `/conversations/${convId}/messages`, data
  )

/** 撤回消息 */
export const retractMessage = (convId: string, msgId: string) =>
  apiDelete<{ ok: boolean }>(`/conversations/${convId}/messages/${msgId}`)

/** 修改消息 */
export const editMessage = (convId: string, msgId: string, data: AddMessageRequest) =>
  apiPut<{ user_message_id: string; assistant_message_id: string }>(
    `/conversations/${convId}/messages/${msgId}`, data
  )

/** 多模态探测 */
export const checkMultimodal = (providerId: string, modelName: string) =>
  apiPost<{ is_multimodal: boolean; model_name: string }>(
    '/models/check-multimodal', { provider_id: providerId, model_name: modelName }
  )

/** 导出单条对话 */
export const exportConversation = (convId: string, format: 'yaml' | 'txt' | 'md') => {
  const url = `${http.defaults.baseURL}/conversations/${convId}/export?format=${format}`
  window.open(url, '_blank')
}

/** 批量导出 ZIP */
export const exportConversationsZip = async (ids: string[], format: 'yaml' | 'txt' | 'md') => {
  const resp = await http.post('/conversations/export-zip', { ids, format }, { responseType: 'blob' })
  const blobUrl = URL.createObjectURL(resp.data as Blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = 'conversations.zip'
  a.click()
  URL.revokeObjectURL(blobUrl)
}

/**
 * 打开对话 SSE 流
 */
export function openConversationStream(
  convId: string,
  onProgress: (data: { stage: string; progress: number; detail: string }) => void,
  onMessage: (data: { message_id: string; delta: string }) => void,
  onDone: (data: { conversation_id: string; message_id: string; status: string; duration_ms: number }) => void,
  onError: (data: { error_code: string; error_message: string }) => void,
): () => void {
  const url = `${http.defaults.baseURL}/conversations/${convId}/stream`
  const es = new EventSource(url)

  es.addEventListener('progress', (e: MessageEvent) => {
    try { onProgress(JSON.parse(e.data)) } catch {}
  })
  es.addEventListener('message', (e: MessageEvent) => {
    try { onMessage(JSON.parse(e.data)) } catch {}
  })
  es.addEventListener('done', (e: MessageEvent) => {
    try { onDone(JSON.parse(e.data)); es.close() } catch {}
  })
  es.addEventListener('error', (e: MessageEvent) => {
    try {
      const d = JSON.parse(e.data)
      if (d.error_code) onError(d)
    } catch {}
    es.close()
  })

  return () => es.close()
}
```

**Step 3: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/api/index.ts
git commit -m "feat(frontend): add conversation types and API layer"
```

---

### Task 8: 前端 — 重写 Layout（新增历史记录导航）

**Files:**
- Modify: `frontend/src/components/Layout.tsx`

**Step 1: 更新导航项**

```typescript
// 将 navItems 改为：
import { Home, Settings, MessageSquare } from 'lucide-react'
// ...
const navItems: NavItem[] = [
  { to: '/', label: '对话', icon: MessageSquare },
  { to: '/providers', label: 'Provider 管理', icon: Settings },
]
```

**Step 2: Commit**

```bash
git add frontend/src/components/Layout.tsx
git commit -m "feat(frontend): update Layout nav for conversation mode"
```

---

### Task 9: 前端 — 重写 App 路由

**Files:**
- Modify: `frontend/src/App.tsx`

**Step 1: 替换为对话路由**

```typescript
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { ChatPage } from '@/pages/ChatPage'
import { ProvidersPage } from '@/pages/ProvidersPage'

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<ChatPage />} />
        <Route path="/providers" element={<ProvidersPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(frontend): rewrite App routes for conversation mode"
```

---

### Task 10: 前端 — ChatPage 主页面 & 对话列表组件

**Files:**
- Create: `frontend/src/pages/ChatPage.tsx`
- Create: `frontend/src/components/chat/ConversationList.tsx`
- Create: `frontend/src/components/chat/ChatArea.tsx`
- Create: `frontend/src/components/chat/MessageBubble.tsx`
- Create: `frontend/src/components/chat/ChatInput.tsx`
- Create: `frontend/src/components/chat/DetailPanel.tsx`
- Create: `frontend/src/components/chat/NewConversationDialog.tsx`

由于前端组件较多，这里给每个组件一个完整实现：

**Step 1: ConversationList.tsx**

```tsx
/**
 * 左侧对话列表栏：搜索框 + 对话项 + 新建按钮
 */
import { useState, useEffect, useCallback } from 'react'
import { Search, Plus, MessageSquare, Trash2, Copy, MoreVertical } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import * as api from '@/api'
import type { Conversation, ConversationStatus } from '@/types'

interface Props {
  selectedId: string | null
  onSelect: (conv: Conversation) => void
  onNewClick: () => void
  onRefresh: () => void
  refreshTrigger: number
}

const statusBadge: Record<string, { label: string; color: string }> = {
  pending: { label: '进行中', color: 'bg-blue-100 text-blue-700' },
  parsing: { label: '进行中', color: 'bg-blue-100 text-blue-700' },
  extracting_characters: { label: '进行中', color: 'bg-blue-100 text-blue-700' },
  generating_scenes: { label: '进行中', color: 'bg-blue-100 text-blue-700' },
  generating_dialogues: { label: '进行中', color: 'bg-blue-100 text-blue-700' },
  assembling: { label: '进行中', color: 'bg-blue-100 text-blue-700' },
  completed: { label: '完成', color: 'bg-green-100 text-green-700' },
  failed: { label: '失败', color: 'bg-red-100 text-red-700' },
}

export function ConversationList({ selectedId, onSelect, onNewClick, onRefresh, refreshTrigger }: Props) {
  const [items, setItems] = useState<Conversation[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.listConversations({ page: 1, size: 50, q: search })
      setItems(res.items)
    } catch { /* Toast 由 appStore 统一处理 */ }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => { fetchList() }, [fetchList, refreshTrigger])

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('确定删除此对话？')) return
    try {
      await api.deleteConversation(id)
      if (selectedId === id) onSelect(null as unknown as Conversation)
      fetchList()
      onRefresh()
    } catch {}
  }

  const handleCopy = async (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await api.copyConversation(conv.id)
      fetchList()
    } catch {}
  }

  return (
    <div className="flex flex-col h-full border-r border-slate-200 bg-white">
      {/* 搜索框 */}
      <div className="p-3 border-b border-slate-100">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            className="pl-8 h-9 text-sm"
            placeholder="搜索对话..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto">
        {loading && items.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">加载中...</p>
        )}
        {!loading && items.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">暂无对话</p>
        )}
        {items.map((conv) => {
          const badge = statusBadge[conv.status] ?? statusBadge.pending
          return (
            <div
              key={conv.id}
              onClick={() => onSelect(conv)}
              className={cn(
                'px-3 py-3 cursor-pointer border-b border-slate-50 hover:bg-slate-50 transition-colors',
                selectedId === conv.id && 'bg-slate-100',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{conv.title}</p>
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    {conv.last_message_preview || '暂无内容'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded', badge.color)}>
                    {badge.label}
                  </span>
                  <div className="relative group">
                    <MoreVertical className="h-3.5 w-3.5 text-slate-300 hover:text-slate-600" />
                    <div className="absolute right-0 top-4 hidden group-hover:flex flex-col bg-white border border-slate-200 rounded shadow-lg z-10 py-1 min-w-[80px]">
                      <button
                        onClick={(e) => handleCopy(conv, e)}
                        className="px-3 py-1.5 text-xs hover:bg-slate-50 flex items-center gap-1.5"
                      >
                        <Copy className="h-3 w-3" /> 复制
                      </button>
                      <button
                        onClick={(e) => handleDelete(conv.id, e)}
                        className="px-3 py-1.5 text-xs hover:bg-slate-50 text-red-600 flex items-center gap-1.5"
                      >
                        <Trash2 className="h-3 w-3" /> 删除
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 新建按钮 */}
      <div className="p-3 border-t border-slate-100">
        <Button onClick={onNewClick} className="w-full" size="sm">
          <Plus className="h-4 w-4" /> 新建对话
        </Button>
      </div>
    </div>
  )
}
```

**Step 2: MessageBubble.tsx**

```tsx
/**
 * 消息气泡组件：user(右对齐/可编辑) | assistant(左对齐/流式打字)
 */
import { useState } from 'react'
import { Pencil, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Message } from '@/types'

interface Props {
  msg: Message
  isStreaming?: boolean        // assistant 正在流式接收
  onRetract?: (msgId: string) => void
  onEdit?: (msgId: string, text: string) => void
}

export function MessageBubble({ msg, isStreaming, onRetract, onEdit }: Props) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(msg.content)
  const isUser = msg.role === 'user'

  const handleSaveEdit = () => {
    if (editText.trim() && editText !== msg.content) {
      onEdit?.(msg.id, editText)
    }
    setEditing(false)
  }

  return (
    <div className={cn('flex gap-2 mb-4', isUser ? 'justify-end' : 'justify-start')}>
      {/* 头像 */}
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
        isUser ? 'bg-blue-500 text-white order-2' : 'bg-slate-700 text-white order-1'
      )}>
        {isUser ? '我' : 'AI'}
      </div>

      {/* 气泡 */}
      <div className={cn(
        'max-w-[70%] rounded-lg px-4 py-2.5 text-sm',
        isUser ? 'bg-blue-500 text-white order-1' : 'bg-white border border-slate-200 order-2',
      )}>
        {isUser && editing ? (
          <div className="space-y-2">
            <textarea
              className="w-full min-h-[60px] p-2 rounded border border-blue-300 text-slate-900 text-sm resize-none"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              autoFocus
            />
            <div className="flex gap-1 justify-end">
              <button onClick={() => setEditing(false)} className="text-xs px-2 py-1 rounded bg-white/20 hover:bg-white/30">取消</button>
              <button onClick={handleSaveEdit} className="text-xs px-2 py-1 rounded bg-white/20 hover:bg-white/30">保存并重新生成</button>
            </div>
          </div>
        ) : (
          <>
            <div className="whitespace-pre-wrap break-words leading-relaxed">
              {msg.content || (isStreaming && '思考中...')}
              {isStreaming && msg.content && <span className="animate-pulse">▊</span>}
            </div>

            {/* 操作按钮 */}
            {!isStreaming && (
              <div className={cn('flex gap-1 mt-1.5', isUser ? 'justify-end' : 'justify-start')}>
                {isUser && (
                  <>
                    <button
                      onClick={() => { setEditing(true); setEditText(msg.content) }}
                      className="text-[10px] px-1.5 py-0.5 rounded opacity-60 hover:opacity-100 hover:bg-white/20 transition-opacity flex items-center gap-1"
                    >
                      <Pencil className="h-2.5 w-2.5" /> 修改
                    </button>
                  </>
                )}
                <button
                  onClick={() => onRetract?.(msg.id)}
                  className="text-[10px] px-1.5 py-0.5 rounded opacity-60 hover:opacity-100 hover:bg-white/20 transition-opacity flex items-center gap-1"
                >
                  <Undo2 className="h-2.5 w-2.5" /> 撤回
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

**Step 3: ChatInput.tsx**

```tsx
/**
 * 底部输入区域：文本输入 + 图片上传 + 发送按钮
 */
import { useState, useRef, useCallback } from 'react'
import { Send, ImagePlus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface Props {
  onSend: (text: string, imagePaths?: string[]) => void
  disabled?: boolean
  isStreaming?: boolean
  modelSupportsImage?: boolean
}

export function ChatInput({ onSend, disabled, isStreaming, modelSupportsImage = false }: Props) {
  const [text, setText] = useState('')
  const [imagePaths, setImagePaths] = useState<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    if (!text.trim() || isStreaming) return
    onSend(text.trim(), imagePaths.length > 0 ? imagePaths : undefined)
    setText('')
    setImagePaths([])
  }, [text, imagePaths, isStreaming, onSend])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // 通过 Electron IPC 读取路径
    const electronAPI = (window as any).electronAPI
    if (electronAPI) {
      const path = (file as any).path
      setImagePaths((prev) => [...prev, path])
    }
  }

  return (
    <div className="border-t border-slate-200 bg-white p-4">
      {/* 图片预览 */}
      {imagePaths.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap">
          {imagePaths.map((p, i) => (
            <div key={i} className="text-xs bg-slate-100 px-2 py-1 rounded flex items-center gap-1">
              🖼️ {p.split(/[/\\]/).pop()}
              <button
                onClick={() => setImagePaths((prev) => prev.filter((_, j) => j !== i))}
                className="text-red-500 hover:text-red-700"
              >×</button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* 图片上传按钮 */}
        <div className="shrink-0">
          <label
            className={cn(
              'flex items-center justify-center w-9 h-9 rounded-md border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors',
              !modelSupportsImage && 'opacity-40 cursor-not-allowed hover:bg-transparent',
            )}
            title={modelSupportsImage ? '上传图片' : '当前模型不支持图片'}
          >
            <ImagePlus className="h-4 w-4 text-slate-500" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
              disabled={!modelSupportsImage}
            />
          </label>
        </div>

        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isStreaming ? 'AI 正在生成中...' : '输入修改指令，或直接粘贴小说正文...'}
          className="min-h-[40px] max-h-[120px] resize-none"
          rows={1}
          disabled={disabled || isStreaming}
        />

        <Button
          onClick={handleSend}
          size="icon"
          disabled={!text.trim() || isStreaming}
          className="shrink-0"
        >
          {isStreaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}
```

**Step 4: ChatArea.tsx**

```tsx
/**
 * 中间对话区域：消息列表 + 输入框
 */
import { useEffect, useRef, useState } from 'react'
import { Download, FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'
import type { ConversationDetail, Message } from '@/types'
import * as api from '@/api'

interface Props {
  conversation: ConversationDetail | null
  streamingMessageId: string | null
  streamingContent: string
  onSend: (text: string, imagePaths?: string[]) => void
  onRetract: (msgId: string) => void
  onEdit: (msgId: string, text: string) => void
  isStreaming: boolean
  modelSupportsImage: boolean
}

export function ChatArea({
  conversation, streamingMessageId, streamingContent,
  onSend, onRetract, onEdit, isStreaming, modelSupportsImage,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation?.messages, streamingContent])

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400">
        <div className="text-center">
          <p className="text-lg">选择一个对话，或新建一个</p>
          <p className="text-sm mt-2">开始将小说转化为剧本</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-white">
        <div>
          <h2 className="text-sm font-semibold">{conversation.title}</h2>
          <p className="text-[11px] text-slate-400">
            {conversation.model_name} · {conversation.message_count} 条消息
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => api.exportConversation(conversation.id, 'md')}>
            <FileDown className="h-3.5 w-3.5" /> MD
          </Button>
          <Button variant="outline" size="sm" onClick={() => api.exportConversation(conversation.id, 'txt')}>
            <FileDown className="h-3.5 w-3.5" /> TXT
          </Button>
          <Button variant="outline" size="sm" onClick={() => api.exportConversation(conversation.id, 'yaml')}>
            <Download className="h-3.5 w-3.5" /> YAML
          </Button>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
        {conversation.messages.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-12">发送第一条消息开始</p>
        )}
        {conversation.messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            onRetract={onRetract}
            onEdit={onEdit}
          />
        ))}
        {/* 流式渲染中的 assistant 消息 */}
        {isStreaming && streamingMessageId && (
          <MessageBubble
            msg={{
              id: streamingMessageId,
              conversation_id: conversation.id,
              role: 'assistant',
              content: streamingContent,
              has_image: false,
              image_paths: null,
              created_at: new Date().toISOString(),
            }}
            isStreaming
          />
        )}
        <div ref={bottomRef} />
      </div>

      {/* 输入框 */}
      <ChatInput
        onSend={onSend}
        isStreaming={isStreaming}
        modelSupportsImage={modelSupportsImage}
      />
    </div>
  )
}
```

**Step 5: ChatPage.tsx（主页面组装）**

```tsx
/**
 * 对话主页面：三栏布局（对话列表 + 对话区 + 详情面板）
 */
import { useState, useEffect, useCallback } from 'react'
import { ConversationList } from '@/components/chat/ConversationList'
import { ChatArea } from '@/components/chat/ChatArea'
import { NewConversationDialog } from '@/components/chat/NewConversationDialog'
import * as api from '@/api'
import { useToast } from '@/components/ui/toast'
import { useAppStore } from '@/stores/appStore'
import type { Conversation, ConversationDetail } from '@/types'

export function ChatPage(): JSX.Element {
  const { toast } = useToast()
  const { providers } = useAppStore()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [conversation, setConversation] = useState<ConversationDetail | null>(null)
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null)
  const [streamingContent, setStreamingContent] = useState('')
  const [modelSupportsImage, setModelSupportsImage] = useState(false)
  const [closeStreamFn, setCloseStreamFn] = useState<(() => void) | null>(null)

  // 选择对话
  const handleSelect = useCallback(async (conv: Conversation) => {
    setSelectedId(conv.id)
    try {
      const detail = await api.getConversation(conv.id)
      setConversation(detail)

      // 探测多模态
      if (conv.provider_id && conv.model_name) {
        try {
          const res = await api.checkMultimodal(conv.provider_id, conv.model_name)
          setModelSupportsImage(res.is_multimodal)
        } catch { setModelSupportsImage(false) }
      }
    } catch {
      toast({ title: '加载对话失败', variant: 'destructive' })
    }
  }, [toast])

  // 发送消息
  const handleSend = useCallback(async (text: string, imagePaths?: string[]) => {
    if (!conversation) return

    try {
      // 追加消息
      const { assistant_message_id } = await api.addMessage(conversation.id, { text, image_paths: imagePaths })

      // 打开 SSE 流
      setIsStreaming(true)
      setStreamingMsgId(assistant_message_id)
      setStreamingContent('')

      const close = api.openConversationStream(
        conversation.id,
        (progress) => {
          // 进度更新
        },
        (msg) => {
          if (msg.message_id === assistant_message_id) {
            setStreamingContent((prev) => prev + msg.delta)
          }
        },
        (done) => {
          setIsStreaming(false)
          setStreamingMsgId(null)
          // 刷新对话详情
          handleSelect({ id: conversation.id } as Conversation)
        },
        (err) => {
          setIsStreaming(false)
          setStreamingMsgId(null)
          toast({ title: '生成失败', description: err.error_message, variant: 'destructive' })
        },
      )
      setCloseStreamFn(() => close)
    } catch (err: any) {
      toast({
        title: '发送失败',
        description: err?.response?.data?.detail?.error_message || '请重试',
        variant: 'destructive',
      })
    }
  }, [conversation, toast, handleSelect])

  // 撤回消息
  const handleRetract = useCallback(async (msgId: string) => {
    if (!conversation) return
    if (!confirm('撤回将删除此消息及之后的所有消息，确定继续？')) return

    try {
      await api.retractMessage(conversation.id, msgId)
      handleSelect({ id: conversation.id } as Conversation)
      setRefreshTrigger((p) => p + 1)
    } catch {
      toast({ title: '撤回失败', variant: 'destructive' })
    }
  }, [conversation, toast, handleSelect])

  // 修改消息
  const handleEdit = useCallback(async (msgId: string, text: string) => {
    if (!conversation) return

    try {
      const { assistant_message_id } = await api.editMessage(conversation.id, msgId, { text })

      // 打开新 SSE 流
      setIsStreaming(true)
      setStreamingMsgId(assistant_message_id)
      setStreamingContent('')

      const close = api.openConversationStream(
        conversation.id,
        () => {},
        (msg) => {
          if (msg.message_id === assistant_message_id) {
            setStreamingContent((prev) => prev + msg.delta)
          }
        },
        () => {
          setIsStreaming(false)
          setStreamingMsgId(null)
          handleSelect({ id: conversation.id } as Conversation)
          setRefreshTrigger((p) => p + 1)
        },
        (err) => {
          setIsStreaming(false)
          setStreamingMsgId(null)
          toast({ title: '生成失败', description: err.error_message, variant: 'destructive' })
        },
      )
      setCloseStreamFn(() => close)
    } catch {
      toast({ title: '修改失败', variant: 'destructive' })
    }
  }, [conversation, toast, handleSelect])

  // 新建对话回调
  const handleCreate = useCallback(async (data: {
    title: string
    novel: { title: string; author: string; text: string }
    provider_id: string
    model_name: string
  }) => {
    try {
      const res = await api.createConversation(data)
      setShowNewDialog(false)
      setRefreshTrigger((p) => p + 1)

      // 自动选中并开始 SSE
      const { conversation_id, assistant_message_id } = res
      setSelectedId(conversation_id)

      // 探测多模态
      try {
        const mr = await api.checkMultimodal(data.provider_id, data.model_name)
        setModelSupportsImage(mr.is_multimodal)
      } catch { setModelSupportsImage(false) }

      // 打开流
      setIsStreaming(true)
      setStreamingMsgId(assistant_message_id)
      setStreamingContent('')

      const close = api.openConversationStream(
        conversation_id,
        () => {},
        (msg) => {
          if (msg.message_id === assistant_message_id) {
            setStreamingContent((prev) => prev + msg.delta)
          }
        },
        () => {
          setIsStreaming(false)
          setStreamingMsgId(null)
          handleSelect({ id: conversation_id } as Conversation)
        },
        (err) => {
          setIsStreaming(false)
          setStreamingMsgId(null)
          toast({ title: '生成失败', description: err.error_message, variant: 'destructive' })
        },
      )
      setCloseStreamFn(() => close)

    } catch (err: any) {
      toast({
        title: '创建失败',
        description: err?.response?.data?.detail?.error_message || '请重试',
        variant: 'destructive',
      })
    }
  }, [toast, handleSelect])

  // 清理
  useEffect(() => {
    return () => { closeStreamFn?.() }
  }, [closeStreamFn])

  return (
    <div className="flex h-[calc(100vh-0px)] -m-8">
      {/* 左侧：对话列表 */}
      <div className="w-64 shrink-0">
        <ConversationList
          selectedId={selectedId}
          onSelect={handleSelect}
          onNewClick={() => setShowNewDialog(true)}
          onRefresh={() => setRefreshTrigger((p) => p + 1)}
          refreshTrigger={refreshTrigger}
        />
      </div>

      {/* 中间：对话区 */}
      <ChatArea
        conversation={conversation}
        streamingMessageId={streamingMsgId}
        streamingContent={streamingContent}
        onSend={handleSend}
        onRetract={handleRetract}
        onEdit={handleEdit}
        isStreaming={isStreaming}
        modelSupportsImage={modelSupportsImage}
      />

      {/* 新建对话弹窗 */}
      {showNewDialog && (
        <NewConversationDialog
          onClose={() => setShowNewDialog(false)}
          onCreate={handleCreate}
          providers={providers}
        />
      )}
    </div>
  )
}
```

**Step 6: NewConversationDialog.tsx**

```tsx
/**
 * 新建对话弹窗：Provider/Model 选择 + 原文输入 + 可选图片
 */
import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import * as api from '@/api'
import type { Provider } from '@/types'
import { useAppStore } from '@/stores/appStore'

interface Props {
  onClose: () => void
  onCreate: (data: {
    title: string
    novel: { title: string; author: string; text: string }
    provider_id: string
    model_name: string
  }) => void
  providers: Provider[]
}

export function NewConversationDialog({ onClose, onCreate, providers }: Props) {
  const { novelInput } = useAppStore()
  const [title, setTitle] = useState(novelInput.title || '')
  const [author, setAuthor] = useState(novelInput.author || '')
  const [text, setText] = useState(novelInput.text || '')
  const [providerId, setProviderId] = useState('')
  const [modelName, setModelName] = useState('')
  const [models, setModels] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [modelsLoading, setModelsLoading] = useState(false)

  // 当切换 Provider 时拉取模型列表
  useEffect(() => {
    if (!providerId) return
    const provider = providers.find((p) => p.id === providerId)
    if (!provider) return

    setModelsLoading(true)
    api.fetchModels(provider.base_url, provider.api_key || '')
      .then((res) => setModels(res.models))
      .catch(() => setModels([]))
      .finally(() => setModelsLoading(false))
  }, [providerId, providers])

  const handleSubmit = () => {
    if (!text.trim()) return
    if (!providerId) return
    if (!modelName) return

    onCreate({
      title: title || novelInput.title || '新对话',
      novel: { title: title || '', author, text: text.trim() },
      provider_id: providerId,
      model_name: modelName,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">新建对话</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 标题 */}
        <div className="space-y-1.5">
          <Label>对话标题</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="可选，默认使用小说标题" />
        </div>

        {/* Provider 选择 */}
        <div className="space-y-1.5">
          <Label>AI Provider</Label>
          <select
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
            value={providerId}
            onChange={(e) => { setProviderId(e.target.value); setModelName('') }}
          >
            <option value="">-- 选择 Provider --</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.base_url})</option>
            ))}
          </select>
        </div>

        {/* Model 选择 */}
        <div className="space-y-1.5">
          <Label>模型</Label>
          <select
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            disabled={!providerId || modelsLoading}
          >
            <option value="">{modelsLoading ? '加载中...' : '-- 选择模型 --'}</option>
            {models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* 作者 */}
        <div className="space-y-1.5">
          <Label>作者（可选）</Label>
          <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="如：金庸" />
        </div>

        {/* 正文 */}
        <div className="space-y-1.5">
          <Label>小说正文 ({text.length} 字)</Label>
          <Textarea
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="请粘贴小说正文..."
            className="font-mono text-sm"
          />
        </div>

        {/* 按钮 */}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSubmit} disabled={!text.trim() || !providerId || !modelName}>
            开始转换
          </Button>
        </div>
      </div>
    </div>
  )
}
```

**Step 7: 移除旧页面文件**

```bash
git rm frontend/src/pages/HomePage.tsx
git rm frontend/src/pages/ConvertPage.tsx
git rm frontend/src/pages/ProgressPage.tsx
git rm frontend/src/pages/ResultPage.tsx
```

**Step 8: Commit**

```bash
git add frontend/src/pages/ChatPage.tsx frontend/src/components/chat/
git rm frontend/src/pages/HomePage.tsx frontend/src/pages/ConvertPage.tsx frontend/src/pages/ProgressPage.tsx frontend/src/pages/ResultPage.tsx
git commit -m "feat(frontend): implement ChatPage with conversation list, bubbles, and input"
```

---

### Task 11: 前端 — 清理 appStore & 旧引用，端到端验证

**Files:**
- Modify: `frontend/src/stores/appStore.ts`（移除旧 convert 相关字段）
- 验证：`npm run dev` + 后端联调

**Step 1: 精简 appStore**

移除 `currentTaskId`、`taskStatus`、`setCurrentTask`、`updateTaskStatus`、`clearTask`、`currentYaml`、`setCurrentYaml`（保留 novelInput、providers 相关）。

**Step 2: 端到端验证**

```bash
# 终端 1: 启动后端
cd backend && uvicorn app.main:app --port 8000

# 终端 2: 启动前端
cd frontend && npm run dev
```

测试流程：
1. 打开浏览器 http://localhost:5173
2. 确保 ProvidersPage 已配好至少一个 Provider
3. 点击「新建对话」→ 选 Provider / Model → 粘贴小说文本 → 开始转换
4. 验证 SSE 流式输出
5. 验证撤回/修改/删除/复制/导出功能

**Step 3: Commit**

```bash
git add frontend/src/stores/appStore.ts
git commit -m "refactor(frontend): clean up appStore for conversation mode"
```

---

### Task 12: 批量导出 ZIP & 前端导出 UI 完善

**Files:**
- Modify: `frontend/src/components/chat/ChatArea.tsx`（导出按钮加强）
- 后端 ZIP 已在 Task 4 实现

**Step 1: 添加批量导出交互**

在 ConversationList 中增加多选 + 批量导出按钮。

**Step 2: Commit**

---

### 验证清单

- [ ] 后端启动成功，`/docs` 可看到 conversations API
- [ ] POST `/api/conversations` 创建对话成功
- [ ] SSE `/api/conversations/{id}/stream` 流式推送正常
- [ ] 撤回 / 修改 / 删除 / 复制 均正确执行
- [ ] 导出 YAML/TXT/MD 内容正确
- [ ] 批量 ZIP 导出正确
- [ ] 多模态探测正常
- [ ] 前端 ChatPage 三栏布局正常
- [ ] 流式打字效果动画正常
- [ ] 旧页面已移除，路由不 404
