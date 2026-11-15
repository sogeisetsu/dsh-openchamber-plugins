---
title: 提示词历史（↑↓ 回溯 + 可搜索历史面板）
status: backlog
created: 2026-11-16
last_reviewed: 2026-11-16
owner: 我
related:
  - todo/prompt-enhance-button.md
---

# 提示词历史（↑↓ 回溯 + 可搜索历史面板）

## 想法

在输入框里用 `↑` / `↓` 回溯之前发过的提示词，再用一个快捷键（如 `Alt+R`）
打开可搜索的历史面板：输入关键词过滤，Enter 采纳，Esc 恢复打开前的草稿。
这样重复的提示词、调试命令、模板句不用每次重新打。

- `↑` / `↓`：只在输入框内、且没有其他菜单占用这两个键时，逐条替换当前草稿；
  从最近一条开始；再往下回到空草稿。
- 搜索面板：列出历史（时间/会话来源/前几行预览），支持过滤与键盘选择。
- 范围：先按**当前会话**的历史（从会话里已发送的用户消息派生，不需要新存储）；
  全局跨会话历史需要插件自己的存储，作为第二阶段。
- 冲突处理：多行草稿时 `↑` 只在首行、`↓` 只在末行触发；斜杠/引用/技能补全
  菜单打开时不抢键；输入法组合中不响应；`Esc` 恢复原草稿；同一句话连续发送
  只记一条（去重）。

## 为什么重要

- 重复写同一类提示词（修 bug、写测试、让 agent 解释报错）每天都会发生；
  DSH 现在没有历史回溯，草稿发出去就没了。
- 用户已经明确提到这个能力（在移植建议里也是 P0），而且 OpenChamber 和
  `dsh-agent-enhancer` 都有成熟实现可以参考。
- 实现成本小：composer 已经通过 slot 暴露草稿读写，历史可以从会话消息派生。

## 参考实现

### OpenChamber

- `packages/ui/src/components/chat/composer/ui/PromptHistorySearchPanel.tsx`
  —— 可搜索的历史面板（过滤、键盘选择、无匹配提示）。
- composer 的 `↑↓` 回溯与 `Alt+R` 打开搜索的键盘逻辑在 `ChatInput.tsx` /
  composer state 里；历史来源是已发送的用户消息。

### dsh-agent-enhancer（本机已装，可读参考）

- `lib/client/prompt/history.js` / `ledger.js` / `coordinator.js`（bundle 内）
  —— 记录了完整的「历史列表 + ↑↓ 状态机 + 搜索 + 采纳」：
  - 从会话 chat 节点里筛出 `source.kind === 'user'` 的用户消息作为历史；
  - ↑↓ 只在编辑器中处理，按草稿与选区状态判断是否接管；
  - 打开搜索时先保存原草稿，Esc/关闭恢复；
  - 采纳后把光标放到末尾。
- 它是自己实现的独立机制，没有依赖 DSH 内置的历史设施。

## DSH 侧接入

- composer slot 已经提供：
  - `conversation.input.overlay` 的 `useInput`（`draft`、`draftRev`、
    `occurrences`）和 `inputActions`（`setDraft` / `insertText` /
    `persistDraft`）——`dsh-agent-enhancer` 就是这样读写草稿的；
  - DOM 锚点 `[data-composer-card]` → `[data-composer-input]`，可以在编辑器上
    挂 `keydown` 监听（同上，agent-enhancer 的做法）。
- 历史数据：
  - 第一步从当前会话的 chat view 里取已发送用户消息（`data.source.kind ===
    'user'`），按时间倒序；不需要新增存储；
  - 跨会话需要 host 侧存储（plugin-data 或 DSH storage），作为后续阶段。
- UI：
  - 搜索面板可以挂在 `conversation.input.overlay` 上（浮在 composer 上方），
    或 `shell.overlay`；样式沿用 composer 弹层的 token，不 import Harness
    client 包（本仓库约定）。
- 插件形态：纯 client 插件即可（不需要 host 路由，除非做跨会话持久化）；
  与「提示词增强」插件共用同一套 composer slot 适配层，可以考虑做成同一个
  `dsh-composer-tools` 插件里的两个功能。
- 按键仲裁：
  - 只在 composer 获得焦点、且没有 `role="menu"` / `role="listbox"` 打开时
    接管；
  - 多行用 `Shift+Enter` 时按行边界判断；
  - 输入法组合（`compositionstart` 后）不响应；
  - 与 DSH 快捷键服务（`dsh-client-ui-shortcuts`）的冲突要先查清楚。

## 待解决问题

- 历史范围：先做当前会话；跨会话历史是否值得（需要持久化 + 隐私考虑）。
- `↑↓` 与 DSH composer 现有行为（自动补全、引用菜单、多行编辑）的优先级：
  实现前用 `cordis_inspect_query` 查 Client `Slots`，或直接在真机上试。
- 历史条数上限、去重（连续相同只留一条）、超长消息截断展示。
- 搜索面板的快捷键（`Alt+R` 还是 `Ctrl/Cmd+R`；DSH 已有快捷键是否冲突）。
- 采纳后是否保留光标位置/末尾、是否触发草稿持久化。
- 是否记录发送失败的提示词（以什么为准：会话事件 or UI 提交成功）。
- 和「提示词增强」共用插件还是分开：两个都依赖 composer slot props，建议
  同一插件内分两个模块。

## 实现记录

- 2026-11-16 —— 创建（方案阶段，尚未实现）。
