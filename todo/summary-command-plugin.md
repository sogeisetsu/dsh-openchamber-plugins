---
title: /summary 斜杠命令插件（OpenChamber summary magic prompt）
status: done
created: 2026-11-15
last_reviewed: 2026-11-15
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
  - 从「前端组装 prompt 注入」改为 **DSH 原生斜杠命令**：用
    `ctx.commands.register` 注册 `/summary [topic]`；
  - 用 `agent.followup()` 把「可见请求 + 隐藏指令」作为**一条用户消息**投回
    当前会话：空闲 agent 会被唤醒，运行中则排队在当前轮之后；
  - 输入带附件时拒绝并给出 usage 提示；
  - 中英文案（`locale/zh.json` + `locale/en.json`）与插件图标/清单齐全。

## 实现位置

- 仓库：`plugins/dsh-summary-command/`（`index.js`、`package.json`、
  `cordis.patch.yml`、`locale/zh.json`、`locale/en.json`、`icon.svg`）。
- 本机安装：desktop profile 的 `node_modules/dsh-summary-command` 是
  **junction（开发期 link）**，指向本仓库该目录；profile 的 `package.json` 里
  记录为指向本仓库 `plugins/dsh-summary-command/` 的 `link:` 依赖。

## 验证

- `node --check index.js` 通过；`package.json` 与两份 locale JSON 解析通过。
- `cordis.patch.yml` 只插入一条 Host 行（`summary-command`），注释说明了用途。
- 本机安装副本与本仓库 `index.js` 的 SHA-256 一致（link 安装，读的是同一份文件）。
- 用户已在本机 DSH 中安装并确认可用。

## 遗留

- 按本仓库 AGENTS.md 的安装模型：完成的功能必须用**打包后的 tarball** 做真正
  安装（`pnpm pack` → `install_bundle`），不能停留在开发期 `link:`。当前是
  link 安装，发布安装与重新验收待补。
- 插件目录内没有 README；仓库根 README 的 Plugins 表已有该插件的说明。

## 实现记录

- 2026-11-15 —— 确认实现位于 `plugins/dsh-summary-command/`，本机以 link 方式
  安装于 desktop profile；归档并记录为已完成（打包安装为遗留项）。
