from pydantic import BaseModel, Field


class NovelInput(BaseModel):
    text: str = Field(..., min_length=1000, description="小说全文文本")
    title: str = ""
    author: str = ""


class StagePrompts(BaseModel):
    """分阶段自定义提示词，会追加合并到对应阶段的基础提示词中"""
    character_extraction: str | None = Field(
        None,
        description="角色提取阶段的额外指令，如：'这是一部武侠小说，重点关注门派、武功、江湖地位等身份标签'",
    )
    scene_generation: str | None = Field(
        None,
        description="场景生成阶段的额外指令，如：'场景要突出武侠风格，地点多用客栈、竹林、悬崖等江湖场景'",
    )
    dialogue_generation: str | None = Field(
        None,
        description="台词生成阶段的额外指令，如：'对白要有古风韵味，适当使用文言词汇；战斗场景的动作指示要详细描写招式'",
    )


class ConvertRequest(BaseModel):
    novel: NovelInput
    provider_id: str
    model: str
    custom_prompt: str | None = Field(
        None,
        description="全局补充提示词（已废弃，建议使用 stage_prompts 按阶段控制）",
    )
    stage_prompts: StagePrompts | None = Field(
        None,
        description="分阶段自定义提示词，用于覆盖或增强各阶段的系统提示词",
    )


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
