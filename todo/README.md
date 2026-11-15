# todo/

本仓库的想法清单：想做的事、想尝试的东西、想记住的点子。每条想法单独一个
Markdown 文件。本 README 是索引和状态看板——用它看清有哪些文件、每个文件是
做什么的、是否过时，以及对应想法有没有在实现。

本文件夹由 Git 跟踪，且必须保持如此。不要把 `todo/` 加进 `.gitignore`。

## 基本规则

1. **一个文件只记一条想法。** 文件名用英文小写短横线形式
   （`kebab-case-title.md`，例如 `sidebar-search-history.md`），不要把新想法
   追加到已有文件里。
2. **每条想法文件都从 [`_TEMPLATE.md`](_TEMPLATE.md) 复制。** 保留 front
   matter，下面的表格靠它核对。
3. **新增文件、改变状态、标记过时或关联实现时，必须在同一次改动里更新本
   README。**
4. **想法文件是事实来源，本 README 是看板。** 两者不一致就同时修正。
5. 本文件夹下的 README、模板和想法文件一律用**简体中文**书写；技术名词、
   代码路径和命令可以保留英文。

## 文件状态

front matter 和表格中使用以下状态：

| 状态 | 含义 |
| --- | --- |
| `backlog` | 已记录，未排期、未开始。 |
| `in-progress` | 正在实现；文件必须链接实现位置（插件目录、分支或 PR）。 |
| `blocked` | 被明确的阻塞项卡住，解决前无法推进。 |
| `done` | 已实现并交付/合并；文件保留作历史记录。 |
| `dropped` | 已明确不做；文件保留并写明原因。 |

`_TEMPLATE.md` 不是想法，状态为 `template`。

## 过时判定

满足任一条件，想法文件即视为**过时**：

- `last_reviewed` 比下面记录的上次全面检查日期早 **90 天**以上；
- 状态为 `backlog`，且 **180 天**内没有任何变化。

过时是提醒重新决策，不是删除。检查时要么重申这条想法（更新
`last_reviewed` 和表格），要么设 `status: dropped` 并写明原因。标为
`in-progress` 却没有链接实现，属于登记错误，不算“新鲜”。

## 文件

上次全面检查：**2026-11-15**。

| 文件 | 用途 | 状态 | 是否过时 | 是否在实现 |
| --- | --- | --- | --- | --- |
| [`_TEMPLATE.md`](_TEMPLATE.md) | 新想法文件的复制模板。 | `template` | 不适用 | 不适用 |
| [`behavior-settings-global-agents-md.md`](behavior-settings-global-agents-md.md) | 在 Settings 里加「行为」分区：编辑全局 AGENTS.md（带 Markdown 预览小眼睛）并设置回复风格预设。 | `backlog` | 否 | 否 |
| [`collapse-long-user-messages.md`](collapse-long-user-messages.md) | 折叠超长的用户消息气泡，展开/收起按钮复刻 OpenChamber 的 Show more / Show less。 | `backlog` | 否 | 否 |
| [`btw-side-question.md`](btw-side-question.md) | 复刻 OpenChamber 的 `/btw` 侧问：fork 临时会话答题，composer 上方流式面板，可收起/保留/丢弃。 | `backlog` | 否 | 否 |
| [`session-delete-cascade-cleanup.md`](session-delete-cascade-cleanup.md) | 先行为不变地简化 `dsh-session-delete-cascade`，再加「删会话时按引用清理图片」能力。 | `backlog` | 否 | 否 |
| [`prompt-enhance-button.md`](prompt-enhance-button.md) | 从 `dsh-agent-enhancer` 提取提示词优化：输入框小星星按钮，一键增强草稿并可撤销。 | `backlog` | 否 | 否 |
| [`session-notifications.md`](session-notifications.md) | 类似 OpenChamber 的会话系统通知：完成/出错/提问/待批准时提醒，点击跳转会话，可配模板。 | `backlog` | 否 | 否 |
| [`large-text-paste-to-file.md`](large-text-paste-to-file.md) | 粘贴大段文字时按设置自动/询问转成 `.txt` 文件附件，保持输入框整洁。 | `backlog` | 否 | 否 |
| [`simplify-skill.md`](simplify-skill.md) | 移植 OMO Slim 的 simplify 技能：行为等价地简化代码，DSH 用户级 SKILL.md。 | `backlog` | 否 | 否 |
| [`catch-up-skill.md`](catch-up-skill.md) | 移植 OpenChamber 的 `/catch-up`：查 git 状态 + 会话历史，快速说清「项目现在到哪了」。 | `backlog` | 否 | 否 |
| [`in-conversation-find.md`](in-conversation-find.md) | Ctrl+F 搜索当前会话并跳转到命中消息，复刻 OpenChamber 的会话内搜索。 | `backlog` | 否 | 否 |
| [`table-copy-button.md`](table-copy-button.md) | 给对话里的 Markdown 表格加复制按钮，只复制这张表格（默认 Markdown）。 | `backlog` | 否 | 否 |
| [`handoff-review-shuttle.md`](handoff-review-shuttle.md) | 自动往返评审插件方案：`/handoff-review` 启动实现会话 ↔ 评审会话 shuttle，多轮直到通过/轮次上限。 | `backlog` | 否 | 否 |
| [`init-command.md`](init-command.md) | 实现 OpenCode 的 `/init`：扫描仓库并创建/更新项目 AGENTS.md（首选用户级技能）。 | `backlog` | 否 | 否 |
| [`ai-rename-session.md`](ai-rename-session.md) | 会话侧栏菜单「AI 重命名」：按最近几轮对话生成标题并重命名，带 pending/失败提示。 | `backlog` | 否 | 否 |
| [`reflect-skill.md`](reflect-skill.md) | OMO Slim 的 reflect 技能：复盘→最小可复用改进，DSH 化后归档（含会话 miner 与作用域门槛）。 | `done` | 否 | 已交付 |
| [`grilling-skill.md`](grilling-skill.md) | Matt Pocock 的 grilling 技能：设计树式追问评审，逐字移植归档。 | `done` | 否 | 已交付 |
| [`install-review-skill.md`](install-review-skill.md) | 合并 skill-vetter 与自建插件审查的安装前审查技能（PASS/WARN/BLOCK，含离线扫描脚本）。 | `done` | 否 | 已交付 |
| [`summary-command-plugin.md`](summary-command-plugin.md) | OpenChamber `/summary` 移植为 DSH 原生斜杠命令插件（`dsh-summary-command`）。 | `done` | 否 | 已交付（link 安装，打包安装待补） |

新增想法时：

1. 把 `_TEMPLATE.md` 复制为 `<kebab-case-title>.md`。
2. 填写 front matter 和正文。
3. 在上表新增一行。
4. 把新文件和本 README 一起提交。

## Front matter

```yaml
---
title: 侧边栏搜索快捷键
status: backlog
created: 2026-11-15
last_reviewed: 2026-11-15
owner: 我
related:
  - plugins/dsh-sidebar-search/
---
```

- `status` —— 上表列出的状态之一。
- `created` / `last_reviewed` —— ISO 日期（`YYYY-MM-DD`）；检查时只要动过
  文件，就更新 `last_reviewed`。
- `related` —— 相关代码、插件、issue 或 PR 的路径或链接；不确定就写 `[]`。
- `owner` —— 可选，负责思考这条想法的人。

正文通常按 `## 想法`、`## 为什么重要`、`## 草稿 / 待解决问题`、
`## 实现记录` 组织。有用的留下，没用的删掉。

## 实现追踪

只有表格里链接了工作发生的位置（例如 `plugins/dsh-summary-command/`、分支
或 PR），才算“正在实现”。`status: in-progress` 却没有链接是登记错误。工作
完成后，把状态设为 `done`，链接 merge/commit，并记录版本或日期。
