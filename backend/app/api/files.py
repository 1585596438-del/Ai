from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from pathlib import Path

router = APIRouter()


class ReadFileRequest(BaseModel):
    path: str = Field(..., min_length=1)


@router.post("/read")
async def read_local_file(data: ReadFileRequest):
    file_path = Path(data.path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    try:
        content = file_path.read_text(encoding="utf-8")
        return {"content": content, "filename": file_path.name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Read failed: {str(e)}")
