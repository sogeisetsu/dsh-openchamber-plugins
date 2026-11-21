---
title: /summary 斜杠命令插件（OpenChamber summary magic prompt）
status: done
created: 2026-11-15
last_reviewed: 2026-11-21
owner: 我
related:
  - plugins/dsh-summary-command/
---

# /summary 斜杠命令插件（OpenChamber summary magic prompt）

## 想法

把 OpenChamber 的 `/summary` 能力移植成 DSH 插件：输入 `/summary`（可选
`/summary <topic>`）后，用一条「可见请求 + 隐藏指令」的用户消息让当前会话产出
一份**非破坏性、可交接**的会话摘要——做了什么、进度、改动文件、待决问题、
用户偏好、技术决策，带格式要求。

## 为什么重要

- 交接、压缩前留底、跨会话接手时都需要一份可信的摘要，手写既慢又漏；把
  OpenChamber 打磨过的指令搬过来，摘要结构稳定。
- 用原生斜杠命令投回当前会话，模型看到的就是一条普通用户消息，不会另起会话、
  不会污染历史之外的东西。

## 移植内容与改动

- 原型：**OpenChamber 的 `/summary` magic prompt**
  （[Magic Prompts 文档](https://docs.openchamber.dev/magic-prompts/)；实现见
  `openchamber/packages/ui/src/lib/magicPrompts.ts` 的 `session.summary.*`）。
- 借用的部分：
  - 可见用户消息（"Summarize this session." / 带 topic 的聚焦句）；
  - 隐藏指令全文（做了什么 / 当前进度 / 改动文件 / 待决问题 / 用户偏好 /
    技术决策 + 格式要求）；
  - 连 `{{topic_block}}` 占位与它的替换逻辑都保留。
- 为 DSH 改的部分：
  - 从「前端组装 prompt 注入」改为 **输入框斜杠菜单里的一行命令**：用
    `ctx.inputTriggers.registerSource` 注册 `/summary [topic]` 的 claim，
    `submit(args)` 走会话自己的 `session.prompt()`；
  - 用一条「可见请求 + 隐藏指令」的用户消息投回当前会话，不碰用户草稿与附件；
  - 输入带附件时拒绝并给出提示；
  - 中英文案（`locale/zh.json` + `locale/en.json`）与插件图标/清单齐全。

## 为什么改成客户端注册（2026-11-21）

菜单里官方那四行的图标和中文**不属于命令本身**：`@deepseek-ai/dsh-commands`
的 `CommandDefinition` 只有 `name` / `description` / `input`，而
`dsh-client-ui-commands` 用一张写死的 `HOST_FACES`（按 `definitionId` 匹配
`compact` / `permission` / `model` / `export` 等六个内置命令）才给出
`label`、`description` 和图标。所以走 Host 注册的第三方命令永远是英文名 +
英文描述 + 无图标。

第三方可用的补位入口有两个：`ctx.commandUi.register`（贡献行）与自建 `/`
触发器（`ctx.inputTriggers.registerSource`）。前者只接裸调用，会让
`/summary <主题>` 失效；本项目要保留主题参数，因此选自建触发器
（`dsh-btw` 是同一种做法的现成先例）。代价是 Host 命令撤掉，`/summary`
只存在于 Web/Desktop 会话。

## 实现位置

- 仓库：`plugins/dsh-summary-command/`（`client.js`、`index.js`、`package.json`、
  `cordis.patch.yml`、`README.md`、`locale/zh.json`、`locale/en.json`、`icon.svg`）。
- 本机安装：desktop profile 里记录为打包依赖
  `file:<repo>/.tmp/packs/dsh-summary-command-2.0.0.tgz`，
  `node_modules/dsh-summary-command` 是真实解包目录（不是 junction）。

## 验证

- `node --check client.js`、`node --check index.js` 通过；`package.json` 与两份
  locale JSON 解析通过。
- `cordis.patch.yml` 只插入一条 Host 行（`summary-command`），Host 半边是空壳
  `apply()`，仅用于让包进入 Web 启动图。
- 隔离 `DSH_HOME` + `dsh web` + bsk 截图验收：`/` 菜单里该行紧跟在
  「下载日志 export」之后、「技能」之前，图标、`总结 summary`、右对齐中文说明
  与官方四行一致（截图存 `.tmp/menu-3.png`）。
- 参数路径实测：`/summary handoff` 投出
  "Summarize this session, focused on: handoff."；裸 `/summary` 投出
  "Summarize this session."，`{{topic_block}}` 为空时无残留。隔离环境无 API Key，
  模型调用按预期报 `MISSING_CREDENTIAL`（不是插件问题）。
- 安装形态三项核对通过：依赖是 `file:` tarball、`node_modules` 条目 `LinkType`
  为空、bundle 列表包含该插件。

## 遗留

- 附件拒绝分支只有代码路径，未在预览里实测（claim 未声明 `attachments: true`，
  带附件的提交会在分发前被组合器拒绝）。
- 英文界面下的行文案未单独截图验证（走的是同一套 `ctx.locale` 绑定）。
- 由于不再是 Host 命令，CLI 等没有客户端模块的表面无法使用 `/summary`。

## 实现记录

- 2026-11-15 —— 确认实现位于 `plugins/dsh-summary-command/`，本机以 link 方式
  安装于 desktop profile；归档并记录为已完成（打包安装为遗留项）。
- 2026-11-21 —— 2.0.0：为对齐官方命令行的呈现（图标 + 中文标签 + 中文说明），
  把 `/summary` 从 Host 命令改成客户端 `/` 触发器（保留 `<topic>` 参数，提交走
  `session.prompt()`，不动草稿）；补 `client.js` 与插件 README；`pnpm pack`
  后按发布流程用 tarball 真正安装，替换开发期 link。
