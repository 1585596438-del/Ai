"""消息模型 — 对话中的每条 user/assistant/system 消息"""
import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(
        String, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False
    )
    role = Column(String, default="user")  # user / assistant / system
    content = Column(Text, default="")
    has_image = Column(Boolean, default=False)
    image_paths = Column(String, nullable=True)  # JSON 数组字符串
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 反向引用
    conversation = relationship("Conversation", back_populates="messages")
