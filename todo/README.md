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

目前还没有记录任何想法。开始记录时：

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
