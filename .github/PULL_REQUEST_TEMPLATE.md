## 标题（Title）

<!-- 一句话说明本次 PR 变更/修改了什么，例如： -->
<!-- feat(backend): add /api/convert SSE streaming endpoint -->

## 描述（Description）

<!-- 简短说明本次的作用与使用方式 -->

## 变更类型（Type of Change）

请勾选符合的一项：

- [ ] 新功能（feat）
- [ ] Bug 修复（fix）
- [ ] 文档更新（docs）
- [ ] 代码重构（refactor）
- [ ] 测试用例（test）
- [ ] 构建/工具链（chore）
- [ ] 性能优化（perf）
- [ ] 样式调整（style）

## 影响范围（Scope）

<!-- 涉及哪些模块/目录：backend、frontend、docs、.github 等 -->
<!--
  🔴 必填：必须引用 docs/MODULE_REFERENCE.md 的对应章节，说明本次改动影响的后端模块
  🔴 必填：必须列出本次修改 / 新增 / 删除的具体函数 / 类 / 行号
-->

### 后端模块影响（引用 [MODULE_REFERENCE](../../docs/MODULE_REFERENCE.md)）

- [ ] `app/main.py` — 入口 / CORS / health check（[§1.1](../../docs/MODULE_REFERENCE.md#11-appmainpy--fastapi-应用入口)）
- [ ] `app/config.py` — 配置（[§1.2](../../docs/MODULE_REFERENCE.md#12-appconfigpy--全局配置)）
- [ ] `app/database.py` — 数据库（[§1.3](../../docs/MODULE_REFERENCE.md#13-appdatabasepy--数据库初始化)）
- [ ] `app/api/__init__.py` — 路由聚合（[§2.1](../../docs/MODULE_REFERENCE.md#21-appapi__init__py--路由聚合)）
- [ ] `app/api/providers.py` — Provider 管理（[§2.2](../../docs/MODULE_REFERENCE.md#22-appapiproviderspy--ai-provider-管理)）
- [ ] `app/api/models.py` — 远端模型（[§2.3](../../docs/MODULE_REFERENCE.md#23-appapimodelspy--远端模型列表)）
- [ ] `app/api/convert.py` — 任务管理（[§2.4](../../docs/MODULE_REFERENCE.md#24-appapiconvertpy--转换任务管理)）
- [ ] `app/api/files.py` — 文件读取（[§2.5](../../docs/MODULE_REFERENCE.md#25-appapifilespy--本地文件读取)）
- [ ] `app/models/` — ORM 模型（[§3](../../docs/MODULE_REFERENCE.md#3-orm-模型-backendappmodels)）
- [ ] `app/schemas/` — Pydantic Schema（[§4](../../docs/MODULE_REFERENCE.md#4-pydantic-schema-backendappschemas)）
- [ ] `app/services/ai_client.py` — AI 客户端（[§5.1](../../docs/MODULE_REFERENCE.md#51-appservicesai_clientpy--openai-异步客户端封装)）
- [ ] `app/services/novel_parser.py` — 章节拆分（[§5.2](../../docs/MODULE_REFERENCE.md#52-appservicesnovel_parserpy--章节拆分)）
- [ ] `app/services/script_generator.py` — 剧本生成（[§5.3](../../docs/MODULE_REFERENCE.md#53-appservicesscript_generatorpy--剧本生成主流程)）
- [ ] `requirements.txt` / `backend.spec` — 依赖与打包（[§6](../../docs/MODULE_REFERENCE.md#6-打包与依赖)）

### 前端模块影响

- [ ] `frontend/` 目录下的某个文件（前端同事按需勾选）

### 其他

- [ ] `docs/` 文档变更
- [ ] `.github/` 模板变更
- [ ] `README.md` / `SUBMISSION.md` 变更
- [ ] 根目录配置变更

## 改动明细（按文件分组）

<!-- 🔴 必填：列出本次修改 / 新增 / 删除的函数、类、行号范围 -->

### 文件 1：`path/to/file.py`

- 修改 `function_name()`（L10-L25）：xxx
- 新增 `helper_function()`（L30-L40）：xxx
- 删除 `deprecated_function()`：原因 xxx

### 文件 2：`path/to/another.py`

- 修改 `class Foo.bar()`（L50-L60）：xxx


## 截图 / 录屏（Screenshots / Recordings）

<!-- 用截图或录屏说明本次的使用与对应结果 -->
<!-- Demo 视频可附 B 站 / 云盘链接 -->

## 测试方式（How to Test）

<!-- 简明写出验证本次功能与体验的步骤 -->

```bash
# 示例：启动后端
cd backend
uvicorn app.main:app --reload --port 8000

# 验证：
curl http://localhost:8000/health
```

## 关联 Issue

<!-- 关联的 Issue 编号，例如：Fixes #123、Refs #45 -->

## 检查清单（Checklist）

- [ ] 一个 PR 只做一件事（符合规则 3.3）
- [ ] 已在本地自测通过
- [ ] 主分支（main）合并后保持可运行状态
- [ ] 已更新相关文档（README / PRD / API 文档）
- [ ] Commit 信息已遵循 Conventional Commits 规范
- [ ] 未引入新的 linter / type-check 告警
- [ ] 未提交敏感信息（.env、密钥、数据库文件等）

## 评审关注点（Reviewer Notes）

<!-- 评审者需要重点关注的设计权衡、性能影响、向后兼容等 -->
