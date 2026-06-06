import asyncio
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import async_session
from app.models.task import ConversionTask
from app.models.provider import AIProvider
from app.schemas.novel import ConvertRequest, ConvertResponse, TaskStatus
from app.services.script_generator import generate_script

router = APIRouter()


async def get_db():
    async with async_session() as session:
        yield session


@router.post("", response_model=ConvertResponse)
async def create_convert_task(data: ConvertRequest, db: AsyncSession = Depends(get_db)):
    # 校验 provider
    result = await db.execute(
        select(AIProvider).where(AIProvider.id == data.provider_id)
    )
    provider = result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=400, detail="Provider not found")

    # 创建任务
    task = ConversionTask(status="pending")
    db.add(task)
    await db.commit()
    await db.refresh(task)

    # 后台执行（桌面版用 asyncio.create_task）
    asyncio.create_task(
        generate_script(task.id, data, provider)
    )

    return ConvertResponse(task_id=task.id, status=task.status)


@router.get("/{task_id}", response_model=TaskStatus)
async def get_task_status(task_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ConversionTask).where(ConversionTask.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskStatus(
        task_id=task.id,
        status=task.status,
        progress=task.progress,
        detail=task.detail,
        error_code=task.error_code,
        error_message=task.error_message,
        result_path=task.result_path,
    )


@router.get("/{task_id}/stream")
async def stream_task_status(task_id: str, db: AsyncSession = Depends(get_db)):
    async def event_generator():
        while True:
            async with async_session() as session:
                result = await session.execute(
                    select(ConversionTask).where(ConversionTask.id == task_id)
                )
                task = result.scalar_one_or_none()
                if not task:
                    yield f"data: {{\"error\": \"Task not found\"}}\n\n"
                    break

                import json
                data = {
                    "status": task.status,
                    "progress": task.progress,
                    "detail": task.detail,
                    "error_code": task.error_code,
                    "error_message": task.error_message,
                    "result_path": task.result_path,
                }
                yield f"data: {json.dumps(data, ensure_ascii=False)}\n\n"

                if task.status in ("completed", "failed"):
                    break

            await asyncio.sleep(1)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
    )


@router.get("/{task_id}/download")
async def download_result(task_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ConversionTask).where(ConversionTask.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task or not task.result_path:
        raise HTTPException(status_code=404, detail="Result not found")
    return FileResponse(task.result_path, filename=f"{task_id}.yaml")
