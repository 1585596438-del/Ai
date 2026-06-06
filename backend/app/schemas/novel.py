from pydantic import BaseModel, Field


class NovelInput(BaseModel):
    text: str = Field(..., min_length=1000, description="小说全文文本")
    title: str = ""
    author: str = ""


class ConvertRequest(BaseModel):
    novel: NovelInput
    provider_id: str
    model: str
    # 可选：用户自定义提示词覆盖
    custom_prompt: str | None = None


class ConvertResponse(BaseModel):
    task_id: str
    status: str


class TaskStatus(BaseModel):
    task_id: str
    status: str
    progress: int
    detail: str
    error_code: str | None = None
    error_message: str | None = None
    result_path: str | None = None
