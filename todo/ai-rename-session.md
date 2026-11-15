---
title: 会话 AI 重命名（侧栏菜单「AI 重命名」）
status: backlog
created: 2026-11-16
last_reviewed: 2026-11-16
owner: 我
related: []
---

# 会话 AI 重命名（侧栏菜单「AI 重命名」）

## 想法

在左侧侧栏的会话行右键菜单 / 行尾「⋯」菜单里加一项「AI 重命名」。点一下，
根据这段会话最近几轮已完成的对话生成一个简短标题并重命名当前会话：

- 生成过程中菜单项/会话行显示 spinner；
- 没有已完成的轮次、没有可用的小模型时，菜单项置灰并给原因；
- 失败时 toast 提示，标题不变；
- 成功后侧栏标题立即更新。

最终效果就是用户描述的那条路径：侧栏对话 → 右键或「⋯」→「AI 重命名」→ 自动
改名。

## 为什么重要

- 会话标题通常来自第一条消息或自动生成，聊偏了以后不再贴切；AI 重命名可以按
  「最近在做什么」重新命名，方便在长会话列表里找回来。
- 比手动重命名省事，也比让 agent 自己编标题稳定（走专门的标题 prompt + 小模型）。

## OpenChamber 参考（只读）

- 菜单项：`packages/ui/src/components/session/SessionAiRenameMenuItem.tsx`
  —— 同时挂在侧栏会话菜单、Tab 右键菜单和单会话 Header 菜单；图标
  `ai-generate-2`，pending 时换成转圈；禁用时用 tooltip 说明原因（VS Code
  不支持 / 无目录 / 正在生成 / 没有小模型 / 没有已完成轮次）。
- 动作：`packages/ui/src/components/session/useSessionAiRenameAction.ts`
  —— 菜单打开时才检查可用性（历史上是否有已完成轮次），避免无谓请求；
  `run()` 触发重命名并把失败转成 toast。
- 实现：`packages/ui/src/sync/use-session-ai-rename.ts`
  —— `prepare()` 读会话与最近约 3 个**已完成**轮次（跳过 synthetic 上下文、
  尊重 revert 边界），`rename()` 调标题生成并保存为用户重命名。
- 标题生成：`packages/ui/src/lib/sessionTitle.ts`
  —— 系统提示词（改编自 OpenCode 的 title agent）要求：只输出标题；2–4 个词、
  最多 40 字符；用最近一条用户消息的语言；不以动词/-ing 开头；不含文件名、
  路径、函数名、commit hash、issue 号；「commit and push」这类收尾请求要命名
  它推进的那件工作，而不是步骤；输入是当前标题 + 最近 3 个已完成轮次（用户
  消息 + 助手最终回复，做了 excerpt 截断）。
  请求走 `/api/small-model/generate`，优先用最近助手消息的 provider/model；
  结果清洗 `<think>`、取首行、超 100 字符截断。
- 并发：同一会话的新请求会取代旧请求（AbortController），pending 状态按会话
  记录；旧结果不会覆盖新标题。

## DSH 侧现状与接入

- DSH 有会话标题服务 `ctx.sessionTitle`：
  - `get(session)` 读已接受标题；
  - `rename(session, title)` 显式用户重命名（会规范化、受 `maxTitleBytes`
    限制，要求 session 是 live）；
  - `refresh(session)` 显式重跑已注册的标题提供方；
  - 标题是 `session/title` 持久事件，客户端通过 `title` projection 显示，改名
    后侧栏自动更新。
- DSH 已自带自动标题提供方（`dsh-session-title-first-prompt-llm`、
  `dsh-session-title-all-prompts-llm`，桌面 profile 的
  experimental session-titles bundle），所以「AI 重命名」可以是**手动再生成**
  的入口。
- 客户端 `sessions` 服务有 `rename(sessionId, title)`；
  会话行菜单通过 `ctx.contextMenus.register({ target: 'session', ... })` 注入
  （`dsh-session-delete-cascade` 已经用同一套），右键与「⋯」共享同一份 action。
- 两条实现路线：
  - **A. 复用 DSH 标题提供方**：host 插件在菜单被点后调用
    `ctx.sessionTitle.refresh(session)`，让已配置的标题提供方重新生成。
    最省事，没有新 prompt；但用的是「首条消息 / 全部消息」提供方的逻辑，
    语义和 OpenChamber 的「最近 3 轮」不完全一致；refresh 也要求 session live。
  - **B. 对齐 OpenChamber**：host 插件取最近 ≤3 个已完成轮次（live 会话直接
    读；冷会话用 `ctx.sessionQuery.readSession` 回放日志），用改编的 title
    system prompt 调 `ctx.llm`（小模型，或跟随最近助手消息的 provider/model），
    清洗后写回：live 会话可用 `ctx.sessionTitle.rename`，冷会话可让 client 调
    `sessions.rename(sessionId, title)`。
- 客户端 UI 方案：新增一个 client 半（或并入 host 插件的 client 半），注册
  session 菜单项 + pending 状态 + toast；点菜单 → 调 host 的 HTTP 路由
  （`ctx.connection.fetch.register`，注销会话插件同款模式）→ 返回生成结果 →
  `sessions.rename` 应用标题并刷新列表。
- 可用性检查：没有已完成轮次、没有可用模型、正在生成时禁用并给 hint
  （对齐 OpenChamber 的五种 hint）；成功/失败用 DSH 既有 notice/toast 模式。
- 权限/边界：只改标题，不改会话内容；不生成新会话；失败不影响当前标题。

## 待解决问题

- 选 A 还是 B：A 最快但语义不完全对齐（而且 refresh 可能依赖 profile 是否装了
  标题提供方）；B 更接近 OpenChamber 但需要读历史 + 调模型 + 冷会话写回。
- 冷会话改名路径：`ctx.sessionTitle.rename` 要求 live session；session
  controller 的 `session/rename` RPC 是否覆盖未打开的会话、是否需要先
  materialize，需要 M0 式探针确认。
- 模型选择：用小模型（独立配置/跟随会话默认）还是最近助手消息的
  provider/model；没有小模型时是否回退到大模型或直接禁用。
- 「已完成轮次」怎么判定：DSH 的 `turn/end` + finish 状态；是否有 revert /
  rollback 边界要跳过；subagent / fork 会话是否允许 AI 重命名。
- 并发与取代：同一会话连点两次、生成中用户手动改名、生成中会话被删除时的
  行为（对齐 OpenChamber：新请求取代旧请求，旧结果不落盘）。
- UI 范围：先只做侧栏会话行（用户要求），是否也加到 Tab 右键 / Header 菜单。
- 菜单项的 pending 指示：侧栏行标题处显示 spinner 需要 client 侧状态；
  host 路由是同步等待还是先返回「已开始」再推送事件。
- 是否需要设置项（开关/模型选择）；默认行为先不设置。

## 实现记录

- 2026-11-16 —— 创建（方案阶段，尚未实现）。
