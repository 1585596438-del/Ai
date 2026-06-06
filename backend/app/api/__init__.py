from fastapi import APIRouter
from app.api import providers, models, convert, files

api_router = APIRouter(prefix="/api")
api_router.include_router(providers.router, prefix="/providers", tags=["providers"])
api_router.include_router(models.router, prefix="/models", tags=["models"])
api_router.include_router(convert.router, prefix="/convert", tags=["convert"])
api_router.include_router(files.router, prefix="/files", tags=["files"])
