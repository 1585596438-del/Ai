from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import async_session
from app.models.provider import AIProvider
from app.schemas.provider import ProviderCreate, ProviderOut, ProviderUpdate

router = APIRouter()


async def get_db():
    async with async_session() as session:
        yield session


@router.get("", response_model=list[ProviderOut])
async def list_providers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AIProvider))
    providers = result.scalars().all()
    return [
        ProviderOut(
            id=p.id,
            name=p.name,
            base_url=p.base_url,
            models=p.models.split(",") if p.models else [],
            is_default=p.is_default,
            is_active=p.is_active,
            created_at=p.created_at,
        )
        for p in providers
    ]


@router.post("", response_model=ProviderOut)
async def create_provider(data: ProviderCreate, db: AsyncSession = Depends(get_db)):
    # 如果设为默认，取消其他默认
    if data.is_default:
        await db.execute(
            AIProvider.__table__.update().values(is_default=False)
        )

    provider = AIProvider(
        name=data.name,
        base_url=data.base_url.rstrip("/"),
        api_key=data.api_key,
        models=",".join(data.models),
        is_default=data.is_default,
        is_active=data.is_active,
    )
    db.add(provider)
    await db.commit()
    await db.refresh(provider)
    return ProviderOut(
        id=provider.id,
        name=provider.name,
        base_url=provider.base_url,
        models=provider.models.split(",") if provider.models else [],
        is_default=provider.is_default,
        is_active=provider.is_active,
        created_at=provider.created_at,
    )


@router.put("/{provider_id}", response_model=ProviderOut)
async def update_provider(
    provider_id: str, data: ProviderUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AIProvider).where(AIProvider.id == provider_id)
    )
    provider = result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    if data.is_default:
        await db.execute(
            AIProvider.__table__.update().values(is_default=False)
        )

    update_data = data.model_dump(exclude_unset=True)
    if "models" in update_data and update_data["models"] is not None:
        update_data["models"] = ",".join(update_data["models"])
    if "base_url" in update_data and update_data["base_url"]:
        update_data["base_url"] = update_data["base_url"].rstrip("/")

    for key, value in update_data.items():
        setattr(provider, key, value)

    await db.commit()
    await db.refresh(provider)
    return ProviderOut(
        id=provider.id,
        name=provider.name,
        base_url=provider.base_url,
        models=provider.models.split(",") if provider.models else [],
        is_default=provider.is_default,
        is_active=provider.is_active,
        created_at=provider.created_at,
    )


@router.delete("/{provider_id}")
async def delete_provider(provider_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AIProvider).where(AIProvider.id == provider_id)
    )
    provider = result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    await db.delete(provider)
    await db.commit()
    return {"ok": True}


@router.post("/{provider_id}/test")
async def test_provider(provider_id: str, db: AsyncSession = Depends(get_db)):
    from app.services.ai_client import test_connection

    result = await db.execute(
        select(AIProvider).where(AIProvider.id == provider_id)
    )
    provider = result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    ok, msg = await test_connection(provider.base_url, provider.api_key)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    return {"ok": True, "message": msg}
