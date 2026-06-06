import json
import asyncio
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.task import ConversionTask
from app.schemas.novel import ConvertRequest
from app.schemas.script import Script, ScriptMetadata, Character, Scene, SceneContent
from app.services.ai_client import get_client, chat_completion
from app.services.novel_parser import split_chapters, extract_sample_for_characters
from app.config import OUTPUT_DIR


async def update_task(
    task_id: str,
    status: str | None = None,
    progress: int | None = None,
    detail: str | None = None,
    error_code: str | None = None,
    error_message: str | None = None,
    result_path: str | None = None,
):
    async with async_session() as db:
        result = await db.execute(
            select(ConversionTask).where(ConversionTask.id == task_id)
        )
        task = result.scalar_one_or_none()
        if task:
            if status is not None:
                task.status = status
            if progress is not None:
                task.progress = progress
            if detail is not None:
                task.detail = detail
            if error_code is not None:
                task.error_code = error_code
            if error_message is not None:
                task.error_message = error_message
            if result_path is not None:
                task.result_path = result_path
            await db.commit()


async def generate_script(task_id: str, request: ConvertRequest, provider):
    """主生成流程"""
    try:
        # Step 1: 解析章节
        await update_task(task_id, status="parsing", progress=5, detail="正在解析章节结构...")
        chapters = split_chapters(request.novel.text)
        total_chapters = len(chapters)
        await update_task(task_id, progress=10, detail=f"解析完成，共 {total_chapters} 章")

        # Step 2: 提取角色
        await update_task(task_id, status="extracting_characters", progress=15, detail="正在提取角色信息...")
        client = get_client(provider.base_url, provider.api_key)
        characters = await _extract_characters(client, request.model, request.novel.text)
        await update_task(task_id, progress=25, detail=f"提取完成，共 {len(characters)} 个角色")

        # Step 3: 逐章生成场景
        await update_task(task_id, status="generating_scenes", progress=30, detail="开始生成场景...")
        all_scenes = []
        for i, chapter in enumerate(chapters):
            progress = 30 + int((i / total_chapters) * 40)
            await update_task(
                task_id,
                progress=progress,
                detail=f"正在生成第 {i + 1}/{total_chapters} 章场景...",
            )
            chapter_scenes = await _generate_chapter_scenes(
                client, request.model, chapter, characters
            )
            all_scenes.extend(chapter_scenes)
            await asyncio.sleep(0.5)  # 避免速率限制

        # Step 4: 逐场景生成台词
        await update_task(task_id, status="generating_dialogues", progress=70, detail="开始生成台词...")
        total_scenes = len(all_scenes)
        for i, scene in enumerate(all_scenes):
            progress = 70 + int((i / total_scenes) * 20)
            await update_task(
                task_id,
                progress=progress,
                detail=f"正在生成场景 {i + 1}/{total_scenes} 的台词...",
            )
            await _generate_scene_dialogue(client, request.model, scene, characters)
            await asyncio.sleep(0.5)

        # Step 5: 组装 YAML
        await update_task(task_id, status="assembling", progress=95, detail="正在组装剧本...")
        script = Script(
            metadata=ScriptMetadata(
                title=request.novel.title or "未命名剧本",
                source_novel=request.novel.title or "",
                author=request.novel.author or "",
                total_scenes=len(all_scenes),
                total_characters=len(characters),
            ),
            characters=characters,
            scenes=all_scenes,
        )

        # 写入文件
        output_path = OUTPUT_DIR / f"{task_id}.yaml"
        output_path.write_text(script.to_yaml(), encoding="utf-8")

        await update_task(
            task_id,
            status="completed",
            progress=100,
            detail="转换完成",
            result_path=str(output_path),
        )

    except Exception as e:
        await update_task(
            task_id,
            status="failed",
            error_code="5003",
            error_message=str(e),
            detail=f"转换失败: {str(e)}",
        )


async def _extract_characters(client, model: str, text: str) -> list[Character]:
    """调用 AI 提取角色列表"""
    sample = extract_sample_for_characters(text)
    prompt = f"""请从以下小说文本中提取所有重要角色，返回 JSON 数组格式。
每个角色包含：id(如char_001), name, aliases(别名数组), description(简介), age, gender, traits(性格标签数组)。

文本：
{sample}

要求：
1. 只返回 JSON 数组，不要其他文字
2. id 按 char_001, char_002 编号
3. traits 用简短中文标签"""

    content = await chat_completion(
        client,
        model,
        [{"role": "user", "content": prompt}],
        temperature=0.3,
    )

    # 清理可能的 markdown 代码块
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1]
    if content.endswith("```"):
        content = content.rsplit("\n", 1)[0]
    content = content.strip()

    data = json.loads(content)
    return [Character(**item) for item in data]


async def _generate_chapter_scenes(
    client, model: str, chapter, characters: list[Character]
) -> list[Scene]:
    """为单章生成场景列表"""
    char_desc = "\n".join([f"- {c.name}: {c.description}" for c in characters])
    prompt = f"""请将以下小说章节转换为剧本场景列表，返回 JSON 数组格式。
每个场景包含：scene_id(如scene_001), title(场景标题), location(地点), time_of_day(日/夜/晨/昏/内/外), characters_present(出场角色id数组)。

角色信息：
{char_desc}

章节内容：
{chapter.content[:4000]}

要求：
1. 只返回 JSON 数组，不要其他文字
2. 根据情节自然分场景
3. scene_id 全局唯一，建议用章节号+序号如 scene_101"""

    content = await chat_completion(
        client,
        model,
        [{"role": "user", "content": prompt}],
        temperature=0.5,
        max_tokens=2000,
    )

    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1]
    if content.endswith("```"):
        content = content.rsplit("\n", 1)[0]
    content = content.strip()

    data = json.loads(content)
    scenes = []
    for item in data:
        scenes.append(
            Scene(
                scene_id=item["scene_id"],
                chapter_ref=f"chapter_{chapter.index}",
                scene_number=0,  # 后面统一编号
                title=item.get("title", ""),
                location=item.get("location", ""),
                time_of_day=item.get("time_of_day", ""),
                characters_present=item.get("characters_present", []),
            )
        )
    return scenes


async def _generate_scene_dialogue(
    client, model: str, scene: Scene, characters: list[Character]
):
    """为单个场景生成台词和舞台指示"""
    char_map = {c.id: c for c in characters}
    char_desc = "\n".join(
        [f"- {c.name}({c.id}): {c.description}" for c in characters if c.id in scene.characters_present]
    )

    prompt = f"""请为以下剧本场景生成详细的舞台指示和台词，返回 JSON 数组格式。
每个元素包含：type(stage_direction/dialogue/transition/voiceover/sound), text, character(角色id，仅dialogue/voiceover), emotion(情绪，仅dialogue)。

场景：{scene.title}
地点：{scene.location}
时间：{scene.time_of_day}

出场角色：
{char_desc}

情节概要：{scene.title}

要求：
1. 只返回 JSON 数组，不要其他文字
2. 按时间顺序排列，交替使用 stage_direction 和 dialogue
3. dialogue 必须指定 character 和 emotion
4. 开头和结尾用 stage_direction 交代环境"""

    content = await chat_completion(
        client,
        model,
        [{"role": "user", "content": prompt}],
        temperature=0.7,
        max_tokens=3000,
    )

    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1]
    if content.endswith("```"):
        content = content.rsplit("\n", 1)[0]
    content = content.strip()

    data = json.loads(content)
    scene.content = [SceneContent(**item) for item in data]
