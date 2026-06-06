import uuid
from sqlalchemy import Column, String, Integer, DateTime, Text
from sqlalchemy.sql import func
from app.database import Base


class ConversionTask(Base):
    __tablename__ = "conversion_tasks"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    status = Column(String, default="pending")  # pending/parsing/extracting_characters/generating_scenes/generating_dialogues/assembling/completed/failed
    progress = Column(Integer, default=0)
    detail = Column(String, default="")
    error_code = Column(String, nullable=True)
    error_message = Column(String, nullable=True)
    result_path = Column(String, nullable=True)  # 生成的 YAML 文件路径
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
