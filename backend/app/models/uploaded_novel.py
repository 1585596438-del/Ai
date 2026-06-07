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
    content_hash = Column(String, default="")
    char_count = Column(Integer, default=0)
    chapter_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    @staticmethod
    def compute_hash(text: str) -> str:
        """计算文本 SHA256 哈希，用于后续可选去重"""
        return hashlib.sha256(text.encode("utf-8")).hexdigest()
