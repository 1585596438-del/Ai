from pydantic import BaseModel, Field
from datetime import datetime


class ProviderBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    base_url: str = Field(..., pattern=r"^https?://")
    models: list[str] = Field(default_factory=list)
    is_default: bool = False
    is_active: bool = True


class ProviderCreate(ProviderBase):
    api_key: str = Field(..., min_length=1)


class ProviderUpdate(BaseModel):
    name: str | None = None
    base_url: str | None = Field(None, pattern=r"^https?://")
    api_key: str | None = None
    models: list[str] | None = None
    is_default: bool | None = None
    is_active: bool | None = None


class ProviderOut(ProviderBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True
