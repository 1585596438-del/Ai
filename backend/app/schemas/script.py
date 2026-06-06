from pydantic import BaseModel, Field
from typing import Literal
from datetime import datetime


class ScriptMetadata(BaseModel):
    title: str
    source_novel: str = ""
    author: str = ""
    generated_at: datetime = Field(default_factory=datetime.now)
    version: str = "1.0"
    total_scenes: int = 0
    total_characters: int = 0
    generator: str = "novel2script"


class Character(BaseModel):
    id: str = Field(..., pattern=r"^char_\d+$")
    name: str
    aliases: list[str] = Field(default_factory=list)
    description: str = ""
    age: int | None = None
    gender: str | None = None
    traits: list[str] = Field(default_factory=list)
    notes: str = ""


class SceneContent(BaseModel):
    type: Literal["stage_direction", "dialogue", "transition", "voiceover", "sound"]
    text: str = ""
    character: str | None = None  # for dialogue/voiceover
    emotion: str | None = None  # for dialogue
    target_scene: str | None = None  # for transition
    description: str = ""  # for sound


class Scene(BaseModel):
    scene_id: str = Field(..., pattern=r"^scene_\d+$")
    chapter_ref: str = ""
    scene_number: int
    title: str = ""
    location: str = ""
    time_of_day: Literal["日", "夜", "晨", "昏", "内", "外", ""] = ""
    characters_present: list[str] = Field(default_factory=list)
    content: list[SceneContent] = Field(default_factory=list)
    notes: str = ""


class Script(BaseModel):
    metadata: ScriptMetadata
    characters: list[Character] = Field(default_factory=list)
    scenes: list[Scene] = Field(default_factory=list)

    def to_yaml(self) -> str:
        import yaml
        # 使用自定义 representer 保持顺序和格式
        return yaml.dump(
            self.model_dump(mode="json", exclude_none=True),
            allow_unicode=True,
            sort_keys=False,
            width=1000,
        )
