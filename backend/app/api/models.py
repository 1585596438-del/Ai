from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.services.ai_client import fetch_models, check_multimodal_cached
from app.models.provider import AIProvider
from app.database import async_session

router = APIRouter()


class FetchModelsRequest(BaseModel):
    base_url: str = Field(..., pattern=r"^https?://")
    api_key: str = Field(..., min_length=1)


class CheckMultimodalRequest(BaseModel):
    provider_id: str = Field(..., min_length=1)
    model_name: str = Field(..., min_length=1)


@router.post("/fetch")
async def fetch_models_endpoint(data: FetchModelsRequest):
    base_url = data.base_url.rstrip("/") + "/v1"
    models, error = await fetch_models(base_url, data.api_key)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return {"models": models}


@router.post("/check-multimodal")
async def check_multimodal_endpoint(data: CheckMultimodalRequest):
    """探测指定模型是否支持多模态，结果带缓存"""
    async with async_session() as session:
        result = await session.execute(
            select(AIProvider).where(AIProvider.id == data.provider_id)
        )
        provider = result.scalar_one_or_none()
        if not provider:
            raise HTTPException(status_code=400, detail="Provider not found")

        base_url = provider.base_url.rstrip("/") + "/v1"
        is_multimodal = await check_multimodal_cached(
            base_url, provider.api_key, data.model_name
        )
        return {"is_multimodal": is_multimodal, "model_name": data.model_name}
