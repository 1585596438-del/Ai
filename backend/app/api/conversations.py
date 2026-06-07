"""对话 & 消息 API — 核心 CRUD + SSE 流 + 导出"""
import asyncio
import json
import tempfile
import zipfile
import io

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.database import async_session
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.uploaded_novel import UploadedNovel
from app.models.provider import AIProvider
from app.schemas.conversation import (
    CreateConversationRequest, AddMessageRequest, UpdateMessageRequest,
    RenameConversationRequest, ExportZipRequest
)
from app.services.sse_handler import get_handler, get_existing_handler, remove_handler

router = APIRouter()


async def get_db():
    async with async_session() as session:
        yield session


# ──────────────────── 对话列表 ────────────────────

@router.get("")
async def list_conversations(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    q: str = Query(default=""),
    status: str = Query(default=""),
    db: AsyncSession = Depends(get_db),
):
    """分页列出所有对话，支持搜索和状态筛选"""
    base_query = select(Conversation)
    if q:
        base_query = base_query.where(Conversation.title.ilike(f"%{q}%"))
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

    # 组装输出
    items = []
    for conv in rows:
        # 消息数量
        msg_count = (await db.execute(
            select(func.count()).select_from(Message).where(
                Message.conversation_id == conv.id
            )
        )).scalar() or 0

        # 最后消息预览
        last_msg = (await db.execute(
            select(Message).where(Message.conversation_id == conv.id)
            .order_by(Message.created_at.desc()).limit(1)
        )).scalar_one_or_none()

        items.append({
            "id": conv.id,
            "title": conv.title,
            "novel_id": conv.novel_id,
            "novel_title": getattr(conv.novel, "title", ""),
            "novel_author": getattr(conv.novel, "author", ""),
            "provider_id": conv.provider_id,
            "model_name": conv.model_name,
            "status": conv.status,
            "progress": conv.progress,
            "detail": conv.detail,
            "error_code": conv.error_code,
            "error_message": conv.error_message,
            "mode": getattr(conv, "mode", "default"),
            "message_count": msg_count,
            "last_message_preview": last_msg.content[:100] if last_msg else "",
            "created_at": conv.created_at.isoformat() if conv.created_at else None,
            "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
        })

    pages = max(1, (total + size - 1) // size)
    return {"items": items, "total": total, "page": page, "size": size, "pages": pages}


# ──────────────────── 对话详情 ────────────────────

@router.get("/{conversation_id}")
async def get_conversation(conversation_id: str, db: AsyncSession = Depends(get_db)):
    """获取对话详情（含全部消息）"""
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail={
            "error_code": "NOT_FOUND", "error_message": "对话不存在"
        })

    msgs_result = await db.execute(
        select(Message).where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    messages = [
        {
            "id": m.id, "conversation_id": m.conversation_id,
            "role": m.role, "content": m.content,
            "has_image": m.has_image, "image_paths": m.image_paths,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in msgs_result.scalars().all()
    ]

    return {
        "id": conv.id,
        "title": conv.title,
        "novel_id": conv.novel_id,
        "novel_title": getattr(conv.novel, "title", ""),
        "novel_author": getattr(conv.novel, "author", ""),
        "provider_id": conv.provider_id,
        "model_name": conv.model_name,
        "status": conv.status,
        "progress": conv.progress,
        "detail": conv.detail,
        "error_code": conv.error_code,
        "error_message": conv.error_message,
        "mode": getattr(conv, "mode", "default"),
        "messages": messages,
        "created_at": conv.created_at.isoformat() if conv.created_at else None,
        "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
    }


# ──────────────────── 新建对话 ────────────────────

@router.post("", status_code=201)
async def create_conversation(
    data: CreateConversationRequest, db: AsyncSession = Depends(get_db)
):
    """新建对话：存原文 → 创建对话 + user 消息 → 后台跑任务"""
    # 校验 Provider
    provider_result = await db.execute(
        select(AIProvider).where(AIProvider.id == data.provider_id)
    )
    provider = provider_result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=400, detail={
            "error_code": "PROVIDER_NOT_FOUND", "error_message": "Provider 不存在"
        })
    if not provider.is_active:
        raise HTTPException(status_code=400, detail={
            "error_code": "PROVIDER_INACTIVE", "error_message": "Provider 未激活"
        })

    # 创建原文记录
    novel = UploadedNovel(
        title=data.novel.title or data.title,
        author=data.novel.author,
        content=data.novel.text,
        content_hash=UploadedNovel.compute_hash(data.novel.text),
        char_count=len(data.novel.text),
        chapter_count=0,
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
        mode=data.mode,
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

    # 创建 assistant 消息（占位）
    assistant_msg = Message(
        conversation_id=conv.id, role="assistant", content=""
    )
    db.add(assistant_msg)
    await db.commit()

    # 创建 SSE handler 并启动后台任务
    handler = get_handler(conv.id)

    from app.services.script_generator import generate_script_for_conversation
    asyncio.create_task(
        generate_script_for_conversation(
            conv.id, assistant_msg.id, data.novel.text,
            provider, handler,
            mode=data.mode,
            model_name=data.model_name,
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
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail={
            "error_code": "NOT_FOUND", "error_message": "对话不存在"
        })

    conv.title = data.title
    await db.commit()
    return {"ok": True}


# ──────────────────── 复制 ────────────────────

@router.post("/{conversation_id}/copy", status_code=201)
async def copy_conversation(
    conversation_id: str, db: AsyncSession = Depends(get_db)
):
    """深拷贝整个对话（原文 + 全部消息），标题加「的副本」后缀"""
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail={
            "error_code": "NOT_FOUND", "error_message": "对话不存在"
        })

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
async def delete_conversation(
    conversation_id: str, db: AsyncSession = Depends(get_db)
):
    """删除对话及所有消息"""
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail={
            "error_code": "NOT_FOUND", "error_message": "对话不存在"
        })

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
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail={
            "error_code": "NOT_FOUND", "error_message": "对话不存在"
        })

    # 校验 Provider 仍可用
    provider_result = await db.execute(
        select(AIProvider).where(AIProvider.id == conv.provider_id)
    )
    provider = provider_result.scalar_one_or_none()
    if not provider or not provider.is_active:
        raise HTTPException(status_code=400, detail={
            "error_code": "PROVIDER_INACTIVE", "error_message": "Provider 不可用"
        })

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
    assistant_msg = Message(
        conversation_id=conv.id, role="assistant", content=""
    )
    db.add(assistant_msg)

    # 重置对话状态
    conv.status = "pending"
    conv.progress = 0
    conv.detail = ""
    conv.error_code = None
    conv.error_message = None
    await db.commit()

    # 获取多轮历史上下文
    all_msgs = (await db.execute(
        select(Message).where(Message.conversation_id == conv.id)
        .order_by(Message.created_at.asc())
    )).scalars().all()

    context_messages = []
    for m in all_msgs:
        if m.id == assistant_msg.id:
            break
        context_messages.append({"role": m.role, "content": m.content})

    # 启动生成：从数据库取原始小说文本（后续消息不应使用用户输入的文本）
    original_novel_text = conv.novel.content if conv.novel else data.text
    handler = get_handler(conv.id)
    from app.services.script_generator import generate_script_for_conversation
    asyncio.create_task(
        generate_script_for_conversation(
            conv.id, assistant_msg.id, original_novel_text,
            provider, handler,
            context_messages=context_messages,
            mode=getattr(conv, 'mode', 'default'),
            model_name=getattr(conv, 'model_name', ''),
        )
    )

    return {
        "user_message_id": user_msg.id,
        "assistant_message_id": assistant_msg.id,
    }


# ──────────────────── 撤回消息 ────────────────────

@router.delete("/{conversation_id}/messages/{message_id}")
async def retract_message(
    conversation_id: str,
    message_id: str,
    db: AsyncSession = Depends(get_db),
):
    """撤回消息：删除该消息及之后所有消息"""
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail={
            "error_code": "NOT_FOUND", "error_message": "对话不存在"
        })

    target = (await db.execute(
        select(Message).where(
            and_(Message.id == message_id, Message.conversation_id == conversation_id)
        )
    )).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail={
            "error_code": "MSG_NOT_FOUND", "error_message": "消息不存在"
        })

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
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail={
            "error_code": "NOT_FOUND", "error_message": "对话不存在"
        })

    target = (await db.execute(
        select(Message).where(
            and_(Message.id == message_id, Message.conversation_id == conversation_id)
        )
    )).scalar_one_or_none()
    if not target or target.role != "user":
        raise HTTPException(status_code=400, detail={
            "error_code": "INVALID_MSG", "error_message": "只能修改 user 消息"
        })

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
    assistant_msg = Message(
        conversation_id=conv.id, role="assistant", content=""
    )
    db.add(assistant_msg)

    # 重置对话状态
    conv.status = "pending"
    conv.progress = 0
    conv.detail = ""
    conv.error_code = None
    conv.error_message = None
    await db.commit()

    # 校验 Provider
    provider_result = await db.execute(
        select(AIProvider).where(AIProvider.id == conv.provider_id)
    )
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

    # 启动生成：从数据库取原始小说文本（修改消息不应使用用户输入的文本）
    original_novel_text = conv.novel.content if conv.novel else data.text
    if provider and provider.is_active:
        handler = get_handler(conv.id)
        from app.services.script_generator import generate_script_for_conversation
        asyncio.create_task(
            generate_script_for_conversation(
                conv.id, assistant_msg.id, original_novel_text,
                provider, handler,
                context_messages=context_messages,
                mode=getattr(conv, 'mode', 'default'),
                model_name=getattr(conv, 'model_name', ''),
            )
        )

    return {
        "user_message_id": new_user_msg.id,
        "assistant_message_id": assistant_msg.id,
    }


# ──────────────────── SSE 流 ────────────────────

@router.get("/{conversation_id}/stream")
async def stream_conversation(conversation_id: str):
    """SSE 流式推送对话生成进度和文本"""
    handler = get_existing_handler(conversation_id)
    if handler:
        return StreamingResponse(handler, media_type="text/event-stream")

    # handler 不存在时，检查数据库回放已完成/失败的结果（竞态条件兜底）
    async def replay_events():
        async with async_session() as session:
            result = await session.execute(
                select(Conversation).where(Conversation.id == conversation_id)
            )
            conv = result.scalar_one_or_none()

            if conv and conv.status == "failed":
                payload = json.dumps({
                    "error_code": conv.error_code or "GENERATION_FAILED",
                    "error_message": conv.error_message or "生成失败"
                }, ensure_ascii=False)
                yield f"event: error\ndata: {payload}\n\n"
            elif conv and conv.status == "completed":
                # 获取最后一条 assistant 消息的内容
                msgs_result = await session.execute(
                    select(Message).where(
                        Message.conversation_id == conversation_id,
                        Message.role == "assistant"
                    ).order_by(Message.created_at.desc()).limit(1)
                )
                last_msg = msgs_result.scalar_one_or_none()
                if last_msg and last_msg.content:
                    payload = json.dumps({
                        "message_id": last_msg.id,
                        "delta": last_msg.content
                    }, ensure_ascii=False)
                    yield f"event: message\ndata: {payload}\n\n"
                done_payload = json.dumps({
                    "conversation_id": conversation_id,
                    "message_id": last_msg.id if last_msg else "",
                    "status": "completed",
                    "duration_ms": 0
                }, ensure_ascii=False)
                yield f"event: done\ndata: {done_payload}\n\n"
            elif conv and conv.status == "pending":
                # 任务可能即将启动，等待一下再让前端重试
                await asyncio.sleep(1.0)
                handler_retry = get_existing_handler(conversation_id)
                if handler_retry:
                    async for event in handler_retry:
                        yield event
                    return
                payload = json.dumps({
                    "error_code": "NOT_STREAMING",
                    "error_message": "模型响应超时，请检查 API 连接后重试"
                }, ensure_ascii=False)
                yield f"event: error\ndata: {payload}\n\n"
            else:
                payload = json.dumps({
                    "error_code": "NOT_STREAMING",
                    "error_message": "No active stream"
                }, ensure_ascii=False)
                yield f"event: error\ndata: {payload}\n\n"

    return StreamingResponse(replay_events(), media_type="text/event-stream")


# ──────────────────── 导出 ────────────────────

def _build_export_content(conv: Conversation, msgs, fmt: str) -> tuple:
    """根据格式构建导出内容和元信息，返回 (content, ext, media_type)"""
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
        content = f"{'=' * 60}\n{conv.title}\n{'=' * 60}\n\n"
        for m in msgs:
            role_label = "[用户]" if m.role == "user" else "[AI 助手]"
            content += f"{role_label}:\n{m.content}\n\n"
        return content, "txt", "text/plain"


@router.get("/{conversation_id}/export")
async def export_conversation(
    conversation_id: str,
    format: str = Query("yaml"),
    db: AsyncSession = Depends(get_db),
):
    """单条导出对话为 YAML/TXT/MD"""
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail={
            "error_code": "NOT_FOUND", "error_message": "对话不存在"
        })

    msgs = (await db.execute(
        select(Message).where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )).scalars().all()

    content, ext, media_type = _build_export_content(conv, msgs, format)

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=f".{ext}", delete=False, encoding="utf-8"
    ) as f:
        f.write(content)
        tmp_path = f.name

    filename = f"{conv.title}.{ext}"
    return FileResponse(tmp_path, filename=filename, media_type=media_type)


@router.post("/export-zip")
async def export_zip(data: ExportZipRequest, db: AsyncSession = Depends(get_db)):
    """批量导出选中的对话为 ZIP"""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # 不能用同一个 session 跨 zip 循环使用，所以每个对话独立查
        for cid in data.ids:
            result = await db.execute(
                select(Conversation).where(Conversation.id == cid)
            )
            conv = result.scalar_one_or_none()
            if not conv:
                continue

            msgs_result = await db.execute(
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
        headers={"Content-Disposition": "attachment; filename=conversations.zip"},
    )
