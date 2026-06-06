# 剧本 YAML Schema 定义与设计说明

## 1. Schema 设计目标

1. **结构化**: 将非结构化小说文本转为机器可读、可校验的剧本格式
2. **可编辑**: 作者可直接修改 YAML，字段语义清晰
3. **可溯源**: 保留与原小说的章节映射，方便对照修改
4. **可扩展**: 预留字段支持舞台指示、情绪标注、备注等打磨需求

## 2. 为什么选 YAML

- **人类可读**: 比 JSON 更适合作者手动编辑
- **注释支持**: 作者可添加修改备注
- **层级清晰**: 场景嵌套对话的结构天然适合缩进表达
- **Pydantic 原生支持**: FastAPI 生态可直接 `model_dump_yaml()`

## 3. 完整 Schema 定义

```yaml
# 剧本根节点
script:
  # ── 元数据 ───────────────────────────────────────
  metadata:
    title: string              # 剧本标题（默认取自小说名）
    source_novel: string       # 原小说名称
    author: string             # 原作者
    generated_at: string       # ISO 8601 生成时间
    version: string            # 剧本版本，作者修改后递增
    total_scenes: integer      # 场景总数（便于快速概览）
    total_characters: integer  # 角色总数
    generator: string          # 生成工具标识

  # ── 角色库 ───────────────────────────────────────
  # 设计原因：角色信息全局统一管理，避免每场重复定义。
  # 作者可在此统一调整角色名、补充背景，后续场景通过 id 引用。
  characters:
    - id: string               # 全局唯一标识，如 "char_001"
      name: string             # 角色名
      aliases: [string]        # 别名/昵称，用于匹配原文
      description: string      # 角色简介（外貌、性格、背景）
      age: integer             # 年龄（可选）
      gender: string           # 性别（可选）
      traits: [string]         # 性格标签，如 ["勇敢", "固执"]
      notes: string            # 作者备注（可选）

  # ── 场景列表 ─────────────────────────────────────
  # 设计原因：场景是剧本的基本单元，按时间顺序排列。
  # 每场包含地点、时间、出场角色、以及时序化的内容块。
  scenes:
    - scene_id: string         # 唯一标识，如 "scene_001"
      chapter_ref: string      # 关联原小说章节号，如 "chapter_3"
      scene_number: integer    # 全场顺序编号，从 1 开始
      title: string            # 场景标题（AI生成或原文提炼）
      
      # 场景头（Scene Heading）
      location: string         # 地点，如 "长安城·醉仙楼"
      time_of_day: string      # 时间，枚举: 日 / 夜 / 晨 / 昏 / 内 / 外
      
      # 出场角色（引用角色库 id）
      characters_present: [string]
      
      # 场景内容：按时间顺序排列的内容块数组
      # 设计原因：混合舞台指示与台词，数组顺序即演出顺序，避免歧义
      content:
        # 类型 1: 舞台指示（环境、动作、转场）
        - type: "stage_direction"
          text: string          # 指示文本
          
        # 类型 2: 台词
        - type: "dialogue"
          character: string     # 引用 characters.id
          text: string          # 台词内容
          emotion: string       # 情绪标注，如 "愤怒"、"低声"（可选）
          
        # 类型 3: 转场
        - type: "transition"
          text: string          # 如 "切至:"、"淡入:"、"闪回"
          target_scene: string  # 目标场景 id（可选）
          
        # 类型 4: 旁白/画外音
        - type: "voiceover"
          character: string     # 发声角色（可选，无则留空）
          text: string
          
        # 类型 5: 音效指示
        - type: "sound"
          description: string   # 如 "雷声轰鸣"、"电话铃响"
          
      # 作者备注（整场景级别）
      notes: string
```

## 4. 设计决策详解

### 4.1 角色库独立设计 (`characters`)

**问题**: 如果角色信息散落在每个场景里，改名需要全局替换。  
**解决**: 集中定义，场景内通过 `id` 引用。作者改一处，全局生效。

### 4.2 `content` 用时序数组而非嵌套结构

**对比方案**:
```yaml
# 方案 A（嵌套）：语义混乱，舞台指示与台词层级不统一
 dialogue:
   - character: A
     lines: [...]
     actions: [...]

# 方案 B（时序数组）：清晰表达"先发生什么，后发生什么"
 content:
   - type: stage_direction  # 他走进房间
   - type: dialogue         # A: "你来了"
   - type: stage_direction  # B点头
   - type: dialogue         # B: "嗯"
```

### 4.3 `chapter_ref` 保留章节映射

**原因**: 作者需要对照原文修改。生成后看到 scene_005 有问题，能直接翻到小说第三章定位。

### 4.4 `emotion` 与 `notes` 字段

**原因**: AI 初稿只是起点。`emotion` 帮助演员/导演理解语气；`notes` 让作者记录修改意图（"此处需加强冲突"）。

### 4.5 `type` 枚举扩展性

当前定义 5 种内容块，未来可扩展：
- `lighting`: 灯光指示
- `camera`: 镜头指示（影视剧本）
- `music`: 配乐指示

## 5. 示例片段

```yaml
script:
  metadata:
    title: "笑傲江湖·剧本初稿"
    source_novel: "笑傲江湖"
    author: "金庸"
    generated_at: "2026-06-06T14:30:00+08:00"
    version: "1.0"
    total_scenes: 3
    total_characters: 2
    generator: "novel2script"

  characters:
    - id: "char_001"
      name: "令狐冲"
      aliases: ["冲儿", "大师兄"]
      description: "华山派大弟子，洒脱不羁，重情重义"
      age: 25
      gender: "男"
      traits: ["洒脱", "重情义", "好酒"]

    - id: "char_002"
      name: "岳灵珊"
      aliases: ["灵珊", "小师妹"]
      description: "岳不群之女，令狐冲师妹，活泼娇俏"
      age: 18
      gender: "女"
      traits: ["活泼", "娇俏", "痴情"]

  scenes:
    - scene_id: "scene_001"
      chapter_ref: "chapter_1"
      scene_number: 1
      title: "思过崖面壁"
      location: "华山·思过崖"
      time_of_day: "日"
      characters_present: ["char_001"]
      content:
        - type: "stage_direction"
          text: "思过崖上，风雪交加。令狐冲独坐石壁前，手中握着一只酒葫芦。"
        - type: "dialogue"
          character: "char_001"
          text: "师父罚我面壁一年，却不知这一年间，江湖上又生出多少事端。"
          emotion: "自嘲"
        - type: "stage_direction"
          text: "他仰头灌了一口酒，目光投向远方群峰。"
      notes: "开场需突出孤独感，可考虑增加环境音效"
```

## 6. Pydantic 校验模型

后端使用 Pydantic 定义上述结构，确保输出严格符合 Schema。
关键模型见 `app/schemas/script.py`。
