import pytest
from datetime import datetime
from app.schemas.script import Script, ScriptMetadata, Character, Scene, SceneContent
from app.schemas.novel import NovelInput, ConvertRequest


def test_character_creation():
    c = Character(id="char_001", name="林晓", description="女主角")
    assert c.id == "char_001"
    assert c.name == "林晓"
    assert c.aliases == []


def test_character_invalid_id():
    with pytest.raises(Exception):
        Character(id="invalid", name="test")


def test_scene_creation():
    s = Scene(
        scene_id="scene_001",
        scene_number=1,
        title="初遇",
        location="教室",
        time_of_day="日",
        characters_present=["char_001", "char_002"],
    )
    assert s.scene_id == "scene_001"
    assert s.time_of_day == "日"


def test_scene_invalid_id():
    with pytest.raises(Exception):
        Scene(scene_id="bad_id", scene_number=1)


def test_scene_content_types():
    sd = SceneContent(type="stage_direction", text="阳光洒进教室")
    dia = SceneContent(type="dialogue", text="你好", character="char_001", emotion="开心")
    assert sd.type == "stage_direction"
    assert dia.character == "char_001"


def test_script_to_yaml():
    script = Script(
        metadata=ScriptMetadata(title="测试剧本", total_scenes=1, total_characters=2),
        characters=[
            Character(id="char_001", name="林晓"),
            Character(id="char_002", name="周宇"),
        ],
        scenes=[
            Scene(
                scene_id="scene_001",
                scene_number=1,
                title="初遇",
                location="教室",
                time_of_day="日",
                characters_present=["char_001", "char_002"],
                content=[
                    SceneContent(type="stage_direction", text="清晨"),
                    SceneContent(type="dialogue", text="你好", character="char_001", emotion="紧张"),
                ],
            )
        ],
    )
    yaml_str = script.to_yaml()
    assert "测试剧本" in yaml_str
    assert "林晓" in yaml_str
    assert "scene_001" in yaml_str


def test_novel_input_validation():
    with pytest.raises(Exception):
        NovelInput(text="太短")


def test_convert_request():
    novel = NovelInput(text="A" * 2000, title="测试小说", author="作者")
    req = ConvertRequest(novel=novel, provider_id="p1", model="gpt-4")
    assert req.novel.title == "测试小说"
    assert req.model == "gpt-4"
