"""文件 API：读取本地文件 + 上传解析文件"""
import io
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel, Field
from pathlib import Path

router = APIRouter()


class ReadFileRequest(BaseModel):
    path: str = Field(..., min_length=1)


@router.post("/read")
async def read_local_file(data: ReadFileRequest):
    """读取本地文件（Electron IPC 路径直读）"""
    file_path = Path(data.path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    try:
        content = file_path.read_text(encoding="utf-8")
        return {"content": content, "filename": file_path.name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Read failed: {str(e)}")


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    上传文件并解析为文本。
    支持格式：.txt, .md, .docx, .pdf, .png, .jpg, .jpeg, .gif, .webp
    - 文本类：返回 content 字符串
    - 图片类：返回 base64 data URL
    """
    filename = file.filename or "unknown"
    ext = Path(filename).suffix.lower()
    contents = await file.read()

    # 文本文件
    if ext in (".txt", ".md", ".yaml", ".yml", ".json", ".py", ".js", ".ts", ".html", ".css"):
        try:
            text = contents.decode("utf-8")
        except UnicodeDecodeError:
            text = contents.decode("gbk", errors="replace")
        return {"content": text, "filename": filename, "type": "text"}

    # Word 文档
    if ext == ".docx":
        from docx import Document
        doc = Document(io.BytesIO(contents))
        text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        return {"content": text, "filename": filename, "type": "text"}

    # PDF
    if ext == ".pdf":
        from PyPDF2 import PdfReader
        reader = PdfReader(io.BytesIO(contents))
        text = "\n".join(
            page.extract_text() or "" for page in reader.pages
        )
        return {"content": text, "filename": filename, "type": "text"}

    # 图片
    if ext in (".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"):
        import base64
        mime_map = {
            ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
            ".gif": "image/gif", ".webp": "image/webp", ".bmp": "image/bmp",
        }
        mime = mime_map.get(ext, "image/png")
        b64 = base64.b64encode(contents).decode()
        return {"content": f"data:{mime};base64,{b64}", "filename": filename, "type": "image"}

    raise HTTPException(status_code=400, detail=f"不支持的文件格式: {ext}")
