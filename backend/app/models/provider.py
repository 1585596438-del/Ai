import uuid
from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.sql import func
from app.database import Base


class AIProvider(Base):
    __tablename__ = "ai_providers"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    base_url = Column(String, nullable=False)
    api_key = Column(String, nullable=False)
    models = Column(String, default="")  # 逗号分隔的模型列表
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)  # Provider 是否激活可用
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    @property
    def default_model(self) -> str:
        """返回 models 列表中的第一个模型名，无模型时返回空字符串"""
        if self.models:
            first = self.models.split(",")[0].strip()
            return first
        return ""
