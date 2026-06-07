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
    image_paths: Optional[List[str]] = None
    mode: str = Field(default="default")  # "default" 或 "novel_to_script"


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
