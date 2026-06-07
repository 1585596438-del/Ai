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

    # 关系：原文 + 消息列表
    novel = relationship("UploadedNovel", lazy="joined")
    messages = relationship(
        "Message", back_populates="conversation",
        order_by="Message.created_at", cascade="all, delete-orphan"
    )
