import json
import asyncio
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.task import ConversionTask
from app.models.message import Message
from app.models.conversation import Conversation
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


def _merge_system_prompt(base_prompt: str, custom_prompt: str | None) -> str:
    """将用户自定义提示词追加合并到基础系统提示词中"""
    if not custom_prompt:
        return base_prompt
    return f"{base_prompt}\n\n## 用户自定义补充指令\n{custom_prompt}\n\n请严格遵守以上所有指令（包括基础指令和自定义补充指令），自定义指令与基础指令冲突时以自定义指令为准。"


async def generate_script(task_id: str, request: ConvertRequest, provider):
    """主生成流程"""
    stage_prompts = request.stage_prompts
    char_custom = stage_prompts.character_extraction if stage_prompts else None
    scene_custom = stage_prompts.scene_generation if stage_prompts else None
    dialogue_custom = stage_prompts.dialogue_generation if stage_prompts else None

    try:
        # Step 1: 解析章节
        await update_task(task_id, status="parsing", progress=5, detail="正在解析章节结构...")
        chapters = split_chapters(request.novel.text)
        total_chapters = len(chapters)
        await update_task(task_id, progress=10, detail=f"解析完成，共 {total_chapters} 章")

        # Step 2: 提取角色
        await update_task(task_id, status="extracting_characters", progress=15, detail="正在提取角色信息...")
        client = get_client(provider.base_url, provider.api_key)
        characters = await _extract_characters(
            client, request.model, request.novel.text,
            custom_prompt=char_custom,
        )
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
                client, request.model, chapter, characters,
                custom_prompt=scene_custom,
            )
            all_scenes.extend(chapter_scenes)
            await asyncio.sleep(0.5)

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
            await _generate_scene_dialogue(
                client, request.model, scene, characters,
                custom_prompt=dialogue_custom,
            )
            await asyncio.sleep(0.5)

        # Step 5: 组装 YAML
        await update_task(task_id, status="assembling", progress=95, detail="正在组装剧本...")
        for i, scene in enumerate(all_scenes):
            scene.scene_number = i + 1

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


_CHARACTER_SYSTEM_PROMPT = """你是一位资深的小说分析与剧本改编专家，擅长从小说文本中精准提取角色信息。

## 核心任务
从提供的小说文本中提取所有对剧情有推动作用的重要角色。

## 输出格式（严格 JSON 数组）
每个角色对象必须包含以下字段：
- id: 字符串，格式为 "char_001", "char_002"，按出场重要性排序
- name: 字符串，角色的正式姓名
- aliases: 字符串数组，角色的别名、昵称、外号
- description: 字符串，50字以内的角色简介（身份、与主角关系、在故事中的作用）
- age: 整数或 null，角色的年龄（如能推断）
- gender: 字符串或 null，"男" / "女" / "未知"
- traits: 字符串数组，3-5个中文性格标签，如 ["善良", "坚韧", "内向"]

## 提取原则
1. 只提取有台词或有重要行为推动剧情的角色，路人甲乙丙不要提取
2. 主角必须排在最前面（char_001, char_002）
3. description 要体现角色在故事中的功能定位，不要只写外貌
4. traits 要用具体性格词，避免空泛的"好人""坏人"
5. 如果角色有多个称呼，把最常用的作为 name，其余放入 aliases

## 负面约束（严禁）
- 严禁输出任何 JSON 之外的文字、解释、markdown 代码块标记
- 严禁编造文本中没有的角色
- 严禁遗漏对剧情有明显推动作用的角色
- 严禁输出空数组（至少提取主角）

## 输出示例
[
  {"id": "char_001", "name": "林晓", "aliases": ["晓晓"], "description": "转学生，故事女主角，善良努力", "age": 17, "gender": "女", "traits": ["善良", "努力", "敏感", "乐观"]},
  {"id": "char_002", "name": "周宇", "aliases": [], "description": "年级第一，表面冷漠内心温柔，男主角", "age": 17, "gender": "男", "traits": ["冷漠", "优秀", "内敛", "温柔"]}
]"""


async def _extract_characters(client, model: str, text: str, custom_prompt: str | None = None) -> list[Character]:
    """调用 AI 提取角色列表"""
    sample = extract_sample_for_characters(text)
    system_prompt = _merge_system_prompt(_CHARACTER_SYSTEM_PROMPT, custom_prompt)
    user_prompt = f"""请从以下小说文本中提取所有重要角色，严格按系统提示的格式返回 JSON 数组。

小说文本（前 {len(sample)} 字）：
{sample}

请记住：
1. 只返回 JSON 数组，不要任何其他文字
2. 主角排在最前
3. 不要遗漏重要角色"""

    content = await chat_completion(
        client,
        model,
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
    )
    content = _clean_json_response(content)
    data = json.loads(content)
    return [Character(**item) for item in data]


_SCENE_SYSTEM_PROMPT = """你是一位专业的影视分镜师和剧本改编专家，擅长将小说章节拆解为适合舞台/影视呈现的场景。

## 核心任务
将小说章节内容按照戏剧节奏和视觉呈现需求，拆解为多个独立场景。

## 场景拆分原则
1. **地点变化必分场景**：角色从一个地点移动到另一个地点，必须拆分为不同场景
2. **时间跳跃必分场景**：时间有明显间隔（如"第二天""放学后"），必须拆分
3. **情绪转折处分场景**：在同一地点但情绪发生重大转折时，可分场景以强化戏剧效果
4. **视角切换可分场景**：不同角色视角的叙事，可分场景呈现
5. **每个场景必须有戏剧目的**：推动情节、揭示人物、制造冲突、或铺垫悬念

## 输出格式（严格 JSON 数组）
每个场景对象必须包含：
- scene_id: 字符串，格式 "scene_章节号序号"，如 "scene_101", "scene_102"
- title: 字符串，15字以内的场景标题，概括本场核心事件
- location: 字符串，具体地点，如 "高二(3)班教室" "学校图书馆" "林晓家客厅"
- time_of_day: 字符串，必须是以下之一："日" "夜" "晨" "昏" "内" "外"
  - "日"/"夜"/"晨"/"昏" 用于有明确时间感的室外场景
  - "内"/"外" 用于时间模糊或重点在空间内外的场景
- characters_present: 字符串数组，本场实际出场的角色 id 列表

## 分镜质量要求
1. 场景标题要有画面感，避免"对话""交流"等空泛词汇
2. location 要具体到可布置的场景，不要写"街上"而要写"星辰高中校门口"
3. 每个场景控制在 3-8 个元素以内，场景过多会稀释戏剧张力
4. 场景之间要有起承转合，避免平铺直叙

## 负面约束（严禁）
- 严禁输出 JSON 之外的任何文字、解释、markdown 代码块
- 严禁 scene_id 重复
- 严禁包含未在本章出场的角色
- 严禁将整章合并为 1 个场景（至少 2 个）
- 严禁输出空数组

## 输出示例
[
  {"scene_id": "scene_101", "title": "转学生报到", "location": "星辰高中教务处", "time_of_day": "日", "characters_present": ["char_001", "char_005"]},
  {"scene_id": "scene_102", "title": "初见冰山同桌", "location": "高二(3)班教室", "time_of_day": "内", "characters_present": ["char_001", "char_002", "char_003"]},
  {"scene_id": "scene_103", "title": "文艺委员的热情", "location": "高二(3)班教室走廊", "time_of_day": "内", "characters_present": ["char_001", "char_004"]}
]"""


async def _generate_chapter_scenes(
    client, model: str, chapter, characters: list[Character], custom_prompt: str | None = None
) -> list[Scene]:
    """为单章生成场景列表"""
    char_desc = "\n".join([f"- {c.id} {c.name}: {c.description}" for c in characters])
    system_prompt = _merge_system_prompt(_SCENE_SYSTEM_PROMPT, custom_prompt)
    user_prompt = f"""请将以下小说章节拆解为剧本场景列表，严格按系统提示的格式返回 JSON 数组。

## 角色信息（仅使用以下角色ID）
{char_desc}

## 章节信息
- 章节编号：第 {chapter.index} 章
- 章节标题：{chapter.title}

## 章节内容
{chapter.content[:4000]}

## 请记住
1. 只返回 JSON 数组，不要任何其他文字
2. scene_id 格式为 scene_{chapter.index}01, scene_{chapter.index}02 等
3. 每个场景必须有明确的地点、时间和出场角色
4. 按情节自然分场景，地点或时间变化必须拆分"""

    content = await chat_completion(
        client,
        model,
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.3,
        max_tokens=2000,
    )
    content = _clean_json_response(content)
    data = json.loads(content)
    scenes = []
    for item in data:
        scenes.append(Scene(
            scene_id=item["scene_id"],
            chapter_ref=f"chapter_{chapter.index}",
            scene_number=0,
            title=item.get("title", ""),
            location=item.get("location", ""),
            time_of_day=item.get("time_of_day", ""),
            characters_present=item.get("characters_present", []),
        ))
    return scenes


_DIALOGUE_SYSTEM_PROMPT = """你是一位资深的戏剧编剧和台词创作专家，擅长为剧本场景撰写富有张力的舞台指示和人物台词。

## 核心任务
根据场景设定和角色信息，生成完整的场景内容，包括舞台指示和角色台词。

## 元素类型说明
- **stage_direction**（舞台指示）：描述环境、动作、表情、镜头感。text 为描述文字。用于开头交代环境、中间推动动作、结尾收束场景。
- **dialogue**（对白）：角色的直接台词。必须指定 character（说话角色id）和 emotion（情绪状态）。台词要口语化、有潜台词、符合人物性格。
- **transition**（转场）：场景之间的过渡描述。text 为过渡文字。用于需要暗示时间/空间跳跃时。
- **voiceover**（旁白/画外音）：角色内心独白或叙事性旁白。必须指定 character。
- **sound**（音效）：环境音、配乐提示。text 为音效描述。

## 台词创作原则
1. **口语化**：台词要像真人说话，避免书面语和说教
2. **潜台词**：话里有话，不说透，留余味。表面说A，实际意思是B
3. **性格化**：每个角色的说话方式要独特，换个人说不出同样的话
4. **动作化**：台词要推动动作，不要静态聊天。说完话要有行为反应
5. **节制**：能用动作表达就不用台词，能用半句说完就不用整句
6. **情绪层次**：同一场景中情绪要有起伏，不要一条直线

## 舞台指示原则
1. 开头必须交代环境氛围（光线、声音、空间感）
2. 对白之间插入动作指示，避免"站桩对话"
3. 用具体细节而非抽象描述，如"手指绞着衣角"而非"她很紧张"
4. 结尾要有画面收束感，可留白、可定格

## 输出格式（严格 JSON 数组）
每个元素对象必须包含：
- type: 字符串，必须是 "stage_direction" / "dialogue" / "transition" / "voiceover" / "sound"
- text: 字符串，内容文字
- character: 字符串或 null，说话角色id（仅 dialogue/voiceover 必填）
- emotion: 字符串或 null，情绪标签（仅 dialogue 必填）
- target_scene: 字符串或 null，转场目标场景id（仅 transition 可用）
- description: 字符串或 null，额外说明

## 情绪标签参考
开心、难过、愤怒、紧张、尴尬、冷漠、温柔、惊讶、失望、期待、嘲讽、害羞、坚定、犹豫、痛苦、释然

## 负面约束（严禁）
- 严禁输出 JSON 之外的任何文字、解释、markdown 代码块
- 严禁让角色说出不符合其性格的话
- 严禁台词变成小说叙事体（"他想""她觉得"等心理描写要转为 voiceover 或 stage_direction）
- 严禁 dialogue 不指定 character 或 emotion
- 严禁连续超过 3 个 dialogue 没有 stage_direction 间隔
- 严禁输出空数组

## 输出示例
[
  {"type": "stage_direction", "text": "清晨的阳光斜斜地切进教室，粉笔灰在光柱里缓慢浮沉。周宇的座位空着，窗台上搁着一本翻开的《百年孤独》。"},
  {"type": "dialogue", "text": "这书……是你的？", "character": "char_001", "emotion": "犹豫"},
  {"type": "stage_direction", "text": "身后传来椅子轻响。林晓回头，周宇不知何时已经站在她身后，手里拎着两杯豆浆。"},
  {"type": "dialogue", "text": "嗯。别碰。", "character": "char_002", "emotion": "冷漠"},
  {"type": "stage_direction", "text": "他把豆浆放在桌上，杯壁凝着水珠，洇湿了一小片桌面。"},
  {"type": "dialogue", "text": "对不起，我只是……", "character": "char_001", "emotion": "尴尬"},
  {"type": "dialogue", "text": "坐过去。", "character": "char_002", "emotion": "冷淡"},
  {"type": "stage_direction", "text": "林晓默默退回自己的座位。周宇坐下，把书合上，封面朝上——那上面贴着一张泛黄的照片，一个女人的侧脸。"}
]"""


async def _generate_scene_dialogue(
    client, model: str, scene: Scene, characters: list[Character], custom_prompt: str | None = None
):
    """为单个场景生成台词和舞台指示"""
    present_chars = [c for c in characters if c.id in scene.characters_present]
    char_desc = "\n".join([f"- {c.id} {c.name}: {c.description} | 性格: {', '.join(c.traits)}" for c in present_chars])
    system_prompt = _merge_system_prompt(_DIALOGUE_SYSTEM_PROMPT, custom_prompt)
    user_prompt = f"""请为以下剧本场景生成舞台指示和台词，严格按系统提示的格式返回 JSON 数组。

## 场景信息
- 场景标题：{scene.title}
- 地点：{scene.location}
- 时间：{scene.time_of_day}
- 情节概要：{scene.title}

## 出场角色
{char_desc}

## 创作要求
1. 开头用 stage_direction 交代环境和氛围
2. 对白要口语化、有潜台词、符合角色性格
3. 对白之间用 stage_direction 插入动作和反应，避免站桩对话
4. 结尾用 stage_direction 收束，留下画面感
5. 如果场景涉及情绪转折，要在台词节奏中体现出来
6. 只返回 JSON 数组，不要任何其他文字"""

    content = await chat_completion(
        client,
        model,
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.6,
        max_tokens=3000,
    )
    content = _clean_json_response(content)
    data = json.loads(content)
    scene.content = [SceneContent(**item) for item in data]


def _clean_json_response(content: str) -> str:
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1]
    if content.endswith("```"):
        content = content.rsplit("\n", 1)[0]
    return content.strip()


# ════════════════════════════════════════════
# 对话模式生成器（流式 SSE 推送）
# ════════════════════════════════════════════


async def generate_script_for_conversation(
    conversation_id: str,
    assistant_message_id: str,
    novel_text: str,
    provider,
    handler,
    context_messages: list[dict] | None = None,
    mode: str = "default",
    model_name: str = "",
):
    """
    对话模式剧本生成主流程：
    1. 通过 SSE handler 流式推送进度
    2. 流式调用 LLM 逐 token 推送给前端
    3. 完成/失败时更新数据库和 SSE
    4. mode="novel_to_script" 时使用小说转剧本专用 system prompt
    5. model_name 为用户选择的模型，为空时回退到 provider.default_model
    """
    from app.services.ai_client import stream_chat_completion

    # 优先使用传入的模型名，回退到 Provider 默认模型
    actual_model = model_name or provider.default_model
    from app.services.sse_handler import remove_handler
    from sqlalchemy import select

    try:
        # 等待前端 EventSource 连接就绪（避免竞态条件：任务完成时前端还未连接 SSE）
        await asyncio.sleep(0.5)

        # 阶段 1: 解析小说
        handler.progress("parsing", 10, "正在解析小说结构...")
        chapters = split_chapters(novel_text)

        # 阶段 2: 提取角色
        handler.progress("extracting_characters", 25, "正在提取角色信息...")
        client = get_client(provider.base_url, provider.api_key)

        characters = await _extract_characters(client, actual_model, novel_text)

        # 构建角色摘要
        char_desc = "\n".join([
            f"- {c.name}: {c.description} | 性格: {', '.join(c.traits)}"
            for c in characters
        ])

        # 阶段 3: 流式生成剧本
        handler.progress("generating_dialogues", 40, "AI 正在生成剧本...")

        # 根据 mode 选择 system prompt
        if mode == "novel_to_script":
            from app.services.novel_to_script_prompt import NOVEL_TO_SCRIPT_SYSTEM_PROMPT
            system_prompt = f"""{NOVEL_TO_SCRIPT_SYSTEM_PROMPT}

## 小说信息（供分析参考）
小说总字数：{len(novel_text)} 字
章节数量：{len(chapters)} 章

## 角色信息（AI 已提取）
{char_desc}

请根据以上信息，开始对小说进行解析和分析。"""
        else:
            system_prompt = f"""你是一个专业的剧本改写 AI。请根据以下小说内容和角色信息，生成结构化的 YAML 格式剧本。

角色信息：
{char_desc}

要求：
1. 按章节划分场景
2. 每个场景包含：场景名、地点、时间、角色列表、对话
3. 对话格式为角色名: 台词
4. 用 YAML 格式输出，结构清晰，缩进正确"""

        # 构建消息列表（含上下文）
        messages = [{"role": "system", "content": system_prompt}]
        if context_messages:
            # 拼入历史上下文（限制最近 20 条）
            messages.extend(context_messages[-20:])
        else:
            messages.append({"role": "user", "content": novel_text})

        # 流式生成（max_tokens 设为 16K，避免长文本输出被截断）
        accumulated = ""
        finish_reason = None
        async for delta, reason in stream_chat_completion(
            provider.base_url, provider.api_key, actual_model,
            messages,
            max_tokens=16384,
        ):
            accumulated += delta
            finish_reason = reason
            handler.message_delta(assistant_message_id, delta)

        # 检查 AI 是否返回了空内容
        if not accumulated.strip():
            raise RuntimeError(
                f"模型 {actual_model} 未返回任何内容，请检查模型是否可用或切换其他模型"
            )

        # 检查是否因 max_tokens 限制被截断
        if finish_reason == "length":
            accumulated += "\n\n[注意：输出因 token 限制被截断，请尝试缩短输入文本或切换支持更长输出的模型]"

        # 保存到数据库
        async with async_session() as session:
            result = await session.execute(
                select(Message).where(Message.id == assistant_message_id)
            )
            msg = result.scalar_one_or_none()
            if msg:
                msg.content = accumulated

            conv_result = await session.execute(
                select(Conversation).where(Conversation.id == conversation_id)
            )
            conv = conv_result.scalar_one_or_none()
            if conv:
                conv.status = "completed"
                conv.progress = 100
                conv.detail = "生成完成"

            await session.commit()

        handler.done(conversation_id, assistant_message_id, "completed")

    except Exception as e:
        error_msg = str(e)
        handler.error("GENERATION_FAILED", error_msg)

        async with async_session() as session:
            conv_result = await session.execute(
                select(Conversation).where(Conversation.id == conversation_id)
            )
            conv = conv_result.scalar_one_or_none()
            if conv:
                conv.status = "failed"
                conv.error_code = "GENERATION_FAILED"
                conv.error_message = error_msg
                await session.commit()

    finally:
        remove_handler(conversation_id)
