from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.ai_client import fetch_models

router = APIRouter()


class FetchModelsRequest(BaseModel):
    base_url: str = Field(..., pattern=r"^https?://")
    api_key: str = Field(..., min_length=1)


@router.post("/fetch")
async def fetch_models_endpoint(data: FetchModelsRequest):
    base_url = data.base_url.rstrip("/") + "/v1"
    models, error = await fetch_models(base_url, data.api_key)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return {"models": models}
