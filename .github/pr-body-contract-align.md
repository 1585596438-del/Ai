# PR Body: fix(frontend): align types and UI with backend Pydantic schema

> 复制下方整段 Markdown（从 `## 标题` 到 `🤖 本 PR 由...`）粘贴到 GitHub PR 描述框。

## 标题（Title）

fix(frontend): align types and UI with backend Pydantic schema

## 描述（Description）

本次 PR 修复 3 个 P0 前后端契约不一致 Bug，均由前端集成时与后端 Pydantic Schema 对齐不当导致。修复后端到端能跑通「提交小说 → SSE 推进 → 预览 YAML 剧本」的全链路。

| 编号 | 问题 | 修复 |
|---|---|---|
| BUG-1 | 前端 `ConvertRequest` 字段平铺到顶层（`title/author/text`），后端 Pydantic 期望嵌套 `novel: {text, title?, author?}`，导致 `POST /api/convert` 直接被 Pydantic 422 拒掉 | 改为 `novel` 嵌套，匹配后端 Schema |
| BUG-2 | 前端任务状态枚举写的是 `extracting`，后端实际是 `extracting_characters`，SSE 推到该状态时前端会落到 `STAGE_LABEL[status] ?? status` 的 fallback，UI 显示原始字符串 | 枚举值修正，与后端 `script_generator.update_task()` 状态值一致 |
| BUG-3 | `ResultPage` 用了一套自创的 `ScriptDoc`（`title/author/scenes[].id/location/time/characters/action/dialogues`）解析 YAML，与后端 `Script` Schema（`metadata/characters/scenes[].scene_id/location/time_of_day/characters_present/content`）完全对不上，预览永远显示「共 0 个场景」 | 整套解析重写，类型与后端 1:1，新增元信息卡 + 角色库卡 + 场景预览（5 种 `SceneContent.type` 分别渲染） |

## 变更类型（Type of Change）

- [x] Bug 修复（fix）

## 影响范围（Scope）

### 后端模块影响

无（本 PR 仅前端，不动后端代码；引用的后端 Schema 全部来自已合入 main 的 [PR #2](https://github.com/1585596438-del/Ai/pull/2)）

### 前端模块影响

- [x] `frontend/src/types/index.ts` — 全局类型定义
- [x] `frontend/src/pages/ConvertPage.tsx` — 转换提交页
- [x] `frontend/src/pages/ProgressPage.tsx` — SSE 进度页
- [x] `frontend/src/pages/ResultPage.tsx` — 剧本结果预览页
- [x] `frontend/src/stores/appStore.ts` — Zustand 全局状态
- [x] `frontend/src/components/Stat.tsx` — 新增，复用卡片组件

## 改动明细（按文件分组）

### 文件 1：`frontend/src/types/index.ts`

- 修改 `TaskStatusValue`（L25-38）：枚举值 `extracting` → `extracting_characters`，与后端 `backend/app/services/script_generator.py` 第 68 行 `status="extracting_characters"` 一致
- 修改 `ConvertRequest`（L59-76）：字段嵌套到 `novel` 内，新增 `custom_prompt?` / `stage_prompts?` 字段占位
- 新增 `NovelInput`（L52-57）：与后端 Pydantic `NovelInput` 一致（`text` 必填、`title?/author?` 可选）
- 删除 重复的 `NovelInput` 定义（原 L72-77，与新增的定义冲突）

### 文件 2：`frontend/src/pages/ConvertPage.tsx`

- 修改 `onStart()`（L70-89）：提交 payload 改为 `{ novel: {text, title?, author?}, provider_id, model }`，匹配后端 Pydantic

### 文件 3：`frontend/src/pages/ProgressPage.tsx`

- 修改 `STAGE_LABEL`（L21-30）：`extracting` → `extracting_characters`，补全注释说明 key 严格匹配后端状态值

### 文件 4：`frontend/src/pages/ResultPage.tsx`

- 重写（整个文件）：删除自创 `ScriptDoc`/`ScriptScene`，按后端 `Script` Schema 重写
- 新增元信息卡（标题 / 作者 / 生成时间 / 版本 / 生成器 / 统计）
- 新增角色库卡（id / name / aliases / description / traits）
- 重写场景预览：5 种 `SceneContent.type`（`stage_direction` 斜体灰、`dialogue` 加粗角色+台词+情绪、`voiceover` 旁白、`transition` 转场+target_scene、`sound` 音效）分别渲染
- 新增 `charNameMap`（`useMemo` 缓存）把 `char_001` 替换为「林晓」
- 抽离 `Stat` 子组件到 `components/Stat.tsx`，主组件函数体 < 300 行

### 文件 5：`frontend/src/stores/appStore.ts`

- 新增 `NovelInputState`（L15-19）：区分传输用 `NovelInput`（title/author 可选），全局状态用 `NovelInputState`（title/author 必填空字符串），避免 `HomePage` 中访问 `novelInput.title/author` 到处判 `undefined`
- 修改 `AppState.novelInput` 类型（L43）：`NovelInput` → `NovelInputState`
- 修改 `setNovelInput` 签名（L44）：入参改为 `Partial<NovelInputState>`

### 文件 6：`frontend/src/components/Stat.tsx`（新增）

- 新增 `Stat` 组件：标签 + 值，支持 `mono` 模式（等宽字体，适合 ID / 路径 / 版本号）

## 实现思路（Implementation Approach）

### 技术选型

- **未引入新依赖**：所有改动都基于现有的 React 18 / TypeScript 5 / Zustand 5 / js-yaml 4 / lucide-react 技术栈
- **未变更新依赖版本**：`package.json` 零改动，PR 体积最小

### 核心设计

#### BUG-1：字段嵌套

后端 Pydantic：

```python
class ConvertRequest(BaseModel):
    novel: NovelInput  # 嵌套
    provider_id: str
    model: str
```

前端早期平铺是开发便利性的妥协，但生产环境会直接被 Pydantic 422 拒掉。修复：

- 拆分类型为 `NovelInput`（传输 / 与 Pydantic 对齐）和 `NovelInputState`（全局状态 / title/author 必填空串）
- `ConvertPage.onStart()` 提交时手动构造 `novel` 子对象

#### BUG-2：状态枚举

定位：

- 后端 `backend/app/services/script_generator.py:68` `status="extracting_characters"`
- 前端 `TaskStatusValue` 写的是 `extracting`

修复：枚举值与后端常量一一对应，并把 `STAGE_LABEL` 的 key 同步过来。两处都补了「与后端 script_generator 严格一致」的注释，下次维护时不容易再写错。

#### BUG-3：ResultPage 解析

问题根因：前端按自创结构解析，从一开始就拿不到数据（`parsed.scenes` 永远是 `undefined`）。

修复策略：

1. **类型先行**：把后端 `Script / ScriptMetadata / Character / Scene / SceneContent` 的字段逐字翻译成 TypeScript interface
2. **展示按字段**：把 YAML 字段名与 UI 文案解耦，未来后端改名也只改类型不改 UI
3. **id → name 翻译**：用 `useMemo` 构建 `Map<id, name>`，把 `char_001` 在 3 处（`characters_present` 徽章、`dialogue` 角色、`voiceover` 角色）替换为「林晓」
4. **5 种 `SceneContent.type` 分支渲染**：
   - `stage_direction` → 灰色斜体
   - `dialogue` → 加粗角色 + 台词 + 灰色情绪括号
   - `voiceover` → 「【旁白 · 角色】」前缀
   - `transition` → 居中「—— 文本 → 目标场景 ——」
   - `sound` → 「♪ 文本/描述」

### 权衡说明

- **不动后端**：3 个 bug 全部是前端问题，后端 Schema 是契约，前端必须 align，而不是反过来改后端
- **不拆 3 个 PR**：3 个 bug 同属「前后端契约对齐」这一件事，按规则 3.3「一事一议」合成 1 个 PR，方便评审
- **不抽 monaco-editor**：本期 PR 目标是契约对齐，Monaco 替换是独立优化项，留到下一个 `feat(frontend): replace textarea with monaco editor` PR
- **已知不足**：`setNovelInput` 仍接受 `Partial<NovelInputState>`，未加字段级校验（与后端 Pydantic 一样由调用方负责）；后续可在 store 层加 zod 校验

## 截图 / 录屏（Screenshots / Recordings）

无（无 UI 截图变化，仅字段对齐；端到端 Demo 视频待后端实跑后录制）

## 测试方式（How to Test）

### 1. 静态检查

```bash
cd frontend
npx tsc --noEmit  # ✅ 0 errors
npm run build     # ✅ CSS 16.89 kB / JS 372.92 kB / 7.70s
```

### 2. 端到端联调（需后端实跑）

```bash
# 后端
cd backend
uvicorn app.main:app --reload --port 8000

# 前端
cd frontend
npm run dev   # 浏览器打开 http://localhost:5173
```

操作步骤：

1. 进入「开始转换」页，输入小说标题 + 正文（≥ 1000 字）
2. 进入「AI Provider」页，配置一个 OpenAI 兼容 provider（含 base_url + api_key + 模型）
3. 进入「开始转换」页，选择 provider 和模型
4. 点「开始转换」→ 应跳转到 `/progress/<task_id>`，**SSE 不报错**（修 BUG-1 后 Pydantic 接受 payload）
5. 进度条依次显示：`等待中` → `解析章节` → `提取角色`（修 BUG-2 后中文正确） → `生成场景` → `生成台词` → `组装剧本` → `已完成`
6. 自动跳到「剧本结果」页，应看到：
   - 元信息卡：标题 / 作者 / 生成时间 / 总场景 / 总角色 / 解析到 N 场景 M 角色
   - 角色库卡：每个角色的 id / name / aliases / description / traits（修 BUG-3 后不再显示「共 0 个场景」）
   - 场景预览：按 `content[]` 逐项渲染 `stage_direction / dialogue / voiceover / transition / sound` 五种类型

### 3. 回归验证

- 改回 enum 任意一个值（比如把 `extracting_characters` 改回 `extracting`），tsc 应报错 `Type '"extracting"' is not assignable to type 'TaskStatusValue'`
- 改 `ConvertRequest` 去掉 `novel` 嵌套，tsc 应报错 `Property 'novel' is missing`

## 关联 Issue

无

## 检查清单（Checklist）

- [x] 一个 PR 只做一件事（3 个 bug 同属「前后端契约对齐」一件最小化的事）
- [x] PR 描述已包含 4 要素：标题、功能描述、实现思路、测试方式（规则 3.3）
- [x] 已在本地自测通过（`npx tsc --noEmit` + `npm run build`）
- [x] 主分支（main）合并后保持可运行状态（前端构建通过，未动后端）
- [x] 未引入新依赖 / 未变更依赖版本
- [x] 未引入新的 linter / type-check 告警
- [x] 未提交敏感信息
- [x] Commit 信息已遵循 Conventional Commits 规范

## 评审关注点（Reviewer Notes）

1. **契约注释**：`types/index.ts` 中 `TaskStatusValue` / `ConvertRequest` 都加了「与后端 XXX 严格一致」注释，请评审是否需要更明确的引用方式
2. **`NovelInputState` vs `NovelInput`**：拆分是否合理？备选方案是改用 zod schema 统一校验（更彻底但 PR 体积大）
3. **ResultPage 重写范围**：是否需要再拆 `SceneContent` 渲染逻辑到独立组件 `SceneContentRenderer`？（本期合并到 ResultPage 是因为内容 < 300 行）
4. **base 分支**：本分支 base 是 `origin/main`（`e6266ad`），与后端 PR #2 / 前端 PR #4 merge commit 同步，不会冲突

---

🤖 本 PR 由 SOLO Coder 修复 P0 契约 Bug。
