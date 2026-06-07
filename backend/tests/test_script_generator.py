import pytest
import json
from unittest.mock import patch, AsyncMock
from app.services.script_generator import (
    _extract_characters,
    _generate_chapter_scenes,
    _generate_scene_dialogue,
    _clean_json_response,
    _merge_system_prompt,
    _CHARACTER_SYSTEM_PROMPT,
    _SCENE_SYSTEM_PROMPT,
    _DIALOGUE_SYSTEM_PROMPT,
)
from app.schemas.script import Character, Scene
from app.services.novel_parser import Chapter


@pytest.mark.asyncio
async def test_extract_characters():
    mock_response = json.dumps([
        {"id": "char_001", "name": "林晓", "description": "女主角", "aliases": [], "traits": ["善良", "努力"]},
        {"id": "char_002", "name": "周宇", "description": "男主角", "aliases": [], "traits": ["冷漠", "优秀"]},
    ])

    with patch("app.services.script_generator.chat_completion", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = mock_response
        chars = await _extract_characters(None, "model", "sample text")

    assert len(chars) == 2
    assert chars[0].id == "char_001"
    assert chars[0].name == "林晓"
    assert chars[1].id == "char_002"
    assert chars[1].name == "周宇"


@pytest.mark.asyncio
async def test_generate_chapter_scenes():
    mock_response = json.dumps([
        {"scene_id": "scene_101", "title": "初遇", "location": "教室", "time_of_day": "日", "characters_present": ["char_001", "char_002"]},
        {"scene_id": "scene_102", "title": "冲突", "location": "操场", "time_of_day": "日", "characters_present": ["char_001", "char_003"]},
    ])

    characters = [
        Character(id="char_001", name="林晓"),
        Character(id="char_002", name="周宇"),
        Character(id="char_003", name="张浩"),
    ]
    chapter = Chapter(index=1, title="第一章", content="some content")

    with patch("app.services.script_generator.chat_completion", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = mock_response
        scenes = await _generate_chapter_scenes(None, "model", chapter, characters)

    assert len(scenes) == 2
    assert scenes[0].scene_id == "scene_101"
    assert scenes[0].title == "初遇"
    assert scenes[1].scene_id == "scene_102"


@pytest.mark.asyncio
async def test_generate_scene_dialogue():
    mock_response = json.dumps([
        {"type": "stage_direction", "text": "清晨的阳光洒进教室"},
        {"type": "dialogue", "text": "你好，我叫林晓。", "character": "char_001", "emotion": "紧张"},
        {"type": "dialogue", "text": "嗯。", "character": "char_002", "emotion": "冷漠"},
        {"type": "stage_direction", "text": "周宇低下头继续看书。"},
    ])

    characters = [
        Character(id="char_001", name="林晓"),
        Character(id="char_002", name="周宇"),
    ]
    scene = Scene(
        scene_id="scene_001",
        scene_number=1,
        title="初遇",
        location="教室",
        time_of_day="日",
        characters_present=["char_001", "char_002"],
    )

    with patch("app.services.script_generator.chat_completion", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = mock_response
        await _generate_scene_dialogue(None, "model", scene, characters)

    assert len(scene.content) == 4
    assert scene.content[0].type == "stage_direction"
    assert scene.content[1].type == "dialogue"
    assert scene.content[1].character == "char_001"
    assert scene.content[1].emotion == "紧张"


def test_clean_json_response():
    assert _clean_json_response('```json\n{"a":1}\n```') == '{"a":1}'
    assert _clean_json_response('```\n[1,2,3]\n```') == '[1,2,3]'
    assert _clean_json_response('[1,2,3]') == '[1,2,3]'


def test_merge_system_prompt_without_custom():
    result = _merge_system_prompt(_CHARACTER_SYSTEM_PROMPT, None)
    assert result == _CHARACTER_SYSTEM_PROMPT


def test_merge_system_prompt_with_custom():
    custom = "这是一部武侠小说，重点关注门派和武功。"
    result = _merge_system_prompt(_CHARACTER_SYSTEM_PROMPT, custom)
    assert _CHARACTER_SYSTEM_PROMPT in result
    assert custom in result
    assert "用户自定义补充指令" in result


@pytest.mark.asyncio
async def test_extract_characters_with_custom_prompt():
    mock_response = json.dumps([
        {"id": "char_001", "name": "令狐冲", "description": "华山派大弟子", "aliases": [], "traits": ["洒脱", "重情义"]},
    ])

    custom = "这是一部武侠小说，角色要有门派和武功描述。"
    with patch("app.services.script_generator.chat_completion", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = mock_response
        chars = await _extract_characters(None, "model", "sample text", custom_prompt=custom)

    assert len(chars) == 1
    assert chars[0].name == "令狐冲"
    # 验证调用时 system_prompt 包含了自定义内容
    call_kwargs = mock_chat.call_args.kwargs
    messages = call_kwargs.get("messages", [])
    system_msg = next((m["content"] for m in messages if m.get("role") == "system"), "")
    assert custom in system_msg
    assert "用户自定义补充指令" in system_msg


@pytest.mark.asyncio
async def test_generate_chapter_scenes_with_custom_prompt():
    mock_response = json.dumps([
        {"scene_id": "scene_101", "title": "竹林决斗", "location": "华山后山竹林", "time_of_day": "日", "characters_present": ["char_001"]},
    ])

    characters = [Character(id="char_001", name="令狐冲")]
    chapter = Chapter(index=1, title="第一章", content="some content")
    custom = "场景要突出武侠风格，地点多用客栈、竹林、悬崖。"

    with patch("app.services.script_generator.chat_completion", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = mock_response
        scenes = await _generate_chapter_scenes(None, "model", chapter, characters, custom_prompt=custom)

    assert len(scenes) == 1
    call_kwargs = mock_chat.call_args.kwargs
    messages = call_kwargs.get("messages", [])
    system_msg = next((m["content"] for m in messages if m.get("role") == "system"), "")
    assert custom in system_msg


@pytest.mark.asyncio
async def test_generate_scene_dialogue_with_custom_prompt():
    mock_response = json.dumps([
        {"type": "stage_direction", "text": "剑光一闪"},
        {"type": "dialogue", "text": "看招！", "character": "char_001", "emotion": "愤怒"},
    ])

    characters = [Character(id="char_001", name="令狐冲", traits=["洒脱"])]
    scene = Scene(
        scene_id="scene_001",
        scene_number=1,
        title="决斗",
        location="竹林",
        time_of_day="日",
        characters_present=["char_001"],
    )
    custom = "对白要有古风韵味，适当使用文言词汇。"

    with patch("app.services.script_generator.chat_completion", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = mock_response
        await _generate_scene_dialogue(None, "model", scene, characters, custom_prompt=custom)

    assert len(scene.content) == 2
    call_kwargs = mock_chat.call_args.kwargs
    messages = call_kwargs.get("messages", [])
    system_msg = next((m["content"] for m in messages if m.get("role") == "system"), "")
    assert custom in system_msg
