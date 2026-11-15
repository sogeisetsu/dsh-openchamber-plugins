---
title: BtW 侧问：fork 一个临时会话顺便问一句
status: backlog
created: 2026-11-15
last_reviewed: 2026-11-15
owner: 我
related: []
---

# BtW 侧问：fork 一个临时会话顺便问一句

## 想法

复刻 OpenChamber 的 BtW（`/btw`，By the way「顺便问一句」）：在主会话里输入
`/btw <问题>`（或选中一段文字后用「By the way…」），从一个**临时 fork 出来的
会话**里回答这个问题——fork 继承主会话的完整上下文，所以模型知道前面在聊
什么；但它同时被告知「继承的历史只是参考资料，不是你的当前任务」，于是只回答
这个侧问，不会接着执行主线的计划。

回答流式显示在输入框上方的浮层面板里，面板可以收起成一条小条、可以「保留为
正式会话」、也可以直接丢弃（销毁 fork）。临时会话在保留之前不出现在侧边栏，
主会话本身的内容和状态完全不受影响。

## 为什么重要

- 主线上正跑着一个任务时，「顺便问一句」很常见（这段代码什么意思、这个报错
  怎么回事、换个思路会怎样），直接在主会话里问会带偏主线、污染上下文，还会
  让 agent 把侧问当成新指令去执行。
- fork 保证了上下文完整，回答质量接近主线；边界指令保证它不越权执行历史里的
  计划、工具调用和子代理。
- 不打断当前输入：面板贴在 composer 上方，答完收起，草稿和主线原样保留。

## 草稿 / 待解决问题

### OpenChamber 的实现（只读参考）

- **触发**：`/btw <question>` 命令；或选中消息文本后选择菜单里的
  「By the way…」；也支持文件/图片附件（1.24.1）。
- **fork 点**：父会话**最后一个已完成的 assistant turn** 之后（不是 HEAD）。
  这样在主线还在流式输出时输入 `/btw`，不会 fork 到半截回答
  （`findLastCompletedAssistantMessageID`，`packages/ui/src/lib/btw.ts`）。
- **边界指令**：`BTW_BOUNDARY_INSTRUCTION` —— 继承历史只作参考、不是当前任务、
  不执行历史里出现的计划/工具调用/审批/子代理、不在未经要求时改工作区。它
  **随 btw 会话的每一条消息发送**，而不是 fork 时钉一次；因为 fork 带过来的
  计划每一轮都还在上下文里，需要持续压住。
- **会话元数据**（`sessionBtwMetadata.ts`）：父会话挂
  `openchamber.btwSessionID` 指向 fork；fork 标 `kind: 'btw'`、
  `originalSessionID`、`btwBoundaryMessageID`（继承到的最后一条消息 id）。
  面板靠这个边界只渲染 fork 尾巴（侧问的 Q&A），不重复显示继承的历史；
  会话列表也按 `kind` 把 btw fork 藏起来，直到 promote。
- **面板**（`BtwPanel.tsx` + `useBtwPanelState.ts`）：挂在 composer 浮动面板
  框架里，三阶段：draft（`/btw` 已输入但会话还没建）/ creating / sheet。
  展开时显示侧问的问答流（含权限卡、表单卡、错误提示、忙碌指示），可折叠成
  header 条（忙碌时标题旁显示 spinner）。三个出口：
  - **收起**：面板变窄条，composer 交还主会话；
  - **保留**（`promoteBtwSession`）：去掉 btw 标记、解除父链接、跳到该会话，
    它从此是普通会话；
  - **丢弃**（`destroyBtwSession`）：解除链接并删除 fork，主会话不动。
- **细节**：
  - 折叠状态下如果 btw 会话的 agent 在等权限/表单，必须能在折叠条上看到，
    否则 agent 会卡在一个没人能答的请求上；折叠时如果父会话自己有请求，
    composer 优先给父会话（`btwHoldsDock`）。
  - btw 有自己的 composer 草稿、模型、thinking level（1.23.0 起），支持附件
    （1.24.1），回答结束有通知（2.6.0）。
  - promote 之后，历史里的边界指令仍在记录里无法删除，所以后续每条消息带
    `BTW_PROMOTION_NOTICE` 说明「这些 btw 约束已经解除」。
  - fork 的标题为 `btw: <question>`。

### DSH 侧现状与接入点（检查 2026-11-15 的安装包）

- **fork**：Host 有 `ctx.sessions.fork(source, boundary?, childSessionId?)`，
  按精确的 inclusive 事件前缀复制，带 `inheritedEventCount` / `isOwnSeq`
  （`dsh-session` 的「Fork a session」一节），是 OpenChamber fork 的对应物。
- **入口**：`/btw` 可以做成 human command（参考本仓库
  `plugins/dsh-summary-command` 的 `ctx.commands.register`）；「选中文字顺便
  问」可以用 DSH 的选择手势注册（`ctx.uiConversation.interactions`，见
  `dsh-client-ui-conversation` 的 selected-text 手势）。
- **面板位置**：`conversation.composer` / `conversation.composer.dock` /
  `conversation.input.dock` 等 composer slot 是挂浮层的位置；具体 props 和
  浮层约束（固定定位要 portal）实现前用 `cordis_inspect_query` 查 Client
  `Slots`，不要按猜测写。
- **只显示尾巴**：DSH fork 会带着继承历史，面板要按 `inheritedEventCount` /
  边界事件 id 裁剪，只渲染自己的 Q&A；DSH 的 `isOwnSeq` 正好能判定
  child-owned 事件。
- **边界指令（主要设计点）**：OpenChamber 靠每条消息带一段 synthetic 文本。
  DSH 里可选：
  - 每次发到 btw 会话时注入一条 sourced user message（和
    `dsh-agent-instructions` 的注入思路相同）；
  - 或用 system-prompt 的 section 机制，但要确认 section 是否是 session 级
    作用域（可能只有全局/agent 级），否则会误伤主会话。
- **隐藏 fork**：DSH 侧边栏的 session 列表能不能被插件过滤/标记隐藏需要
  确认；如果临时会话一定出现在列表里，体验会被破坏，这是要先验证的点。
- **创建与发送**：fork、往 fork 发消息、删除 fork 都需要 Host 能力；client
  如何调用 Host（typert/remote）和前两个想法一样要先确认。
- **模型 / thinking level**：fork 能不能单独设置模型和 thinking level（DSH
  的 per-session model selection）待确认。
- **权限**：btw 会话用什么权限策略、是否允许写工作区要定默认值；OpenChamber
  只是提示词软约束，DSH 可以用自己的 permission preset 做更硬的限制。

### 待解决问题（产品层面）

- 入口做几个：只做 `/btw` 命令，还是也做选中文本的「顺便问一句」？（后者体验
  更好，但依赖选择手势 API。）
- 三个出口是否都要：建议先做「收起 + 丢弃」，promote 后置。
- btw 会话里的工具/子代理/写文件要不要硬禁用；OpenChamber 用提示词约束，
  DSH 有权限层，可以更可靠，但会影响「顺便改一下」的用法。
- 丢弃/崩溃后的残留 fork 清理：OpenChamber 靠元数据链接恢复面板；DSH 重启
  后如何识别并回收孤儿 fork 要定策略。
- 回答完成后的提醒：DSH 有没有现成的通知机制，还是只在折叠条上标状态。
- 和 DSH 自带 subagent / steer / queue 的关系：btw 是「同一上下文里的侧问」，
  和 subagent（另起 agent）、steer（插入当前轮）语义不同，文档里要写清楚。
- 规模：可能是三个想法里最大的一个（Host 的 fork/send/id 管理 + Client 的
  命令、选择入口、面板、会话列表过滤）。建议先做最小闭环：`/btw` → fork →
  面板流式回答 → 收起/丢弃。

## 实现记录

- 2026-11-15 —— 创建。
