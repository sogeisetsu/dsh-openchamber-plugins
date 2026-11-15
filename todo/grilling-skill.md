---
title: grilling 技能（设计树式追问评审）
status: done
created: 2026-11-15
last_reviewed: 2026-11-15
owner: 我
related:
  - skills/grilling/
---

# grilling 技能（设计树式追问评审）

## 想法

移植 `grilling` 技能：当你有一个计划、决定或想法时，把用户的思考按**设计树**
拆开，一轮一轮地追问，直到达成共识；每一轮只问「前置条件已经确定」的
frontier 问题，每个问题都给出推荐答案，frontier 为空即完成。

## 为什么重要

- 计划阶段最贵的错误是「没问出来的假设」；这个技能强制把假设逐个变成明确的
  决定，并阻止用户在没想清楚前就开始实现。
- 事实由 agent 自己查（子代理去查文件/工具），决策留给用户，避免把「查一下
  就知道」的负担丢给用户。

## 移植内容与改动

- 原型：**Matt Pocock 的 `grilling`**（[mattpocock/skills](https://github.com/mattpocock/skills)，MIT）。
- 借用的部分（基本逐字移植）：
  - 设计树与 **frontier 轮次机制**：只问前置条件已定的问题，下一轮再往下走；
  - `❓ Q1 / ➡️ 推荐答案` 的输出格式；
  - 「把问题写成 yes 即接受推荐答案」；
  - 事实由**子代理**去查，不阻塞其他问题的推进；
  - frontier 空 = 完成，用户确认前不开始动手。
- 为 DSH 改的部分：无实质改动（OpenCode 里的 `grill-me` 只是转调 `grilling`
  的空壳，同一作者）。DSH 有 subagent 工具，可直接承载「派子代理查事实」。

## 实现位置

- 仓库：`skills/grilling/`（只有一个 `SKILL.md`）。
- 本机安装：`~/.dsh/skills/grilling/`。

## 验证

- 仓库副本与本机安装副本 SHA-256 一致。
- 内容与上游逐字对照（除 DSH 技能 frontmatter 外无改动）。
- 用户已在本机 DSH 中安装并确认可用。

## 实现记录

- 2026-11-15 —— 归档到仓库 `skills/grilling/`；本机安装于
  `~/.dsh/skills/grilling/`，并记录为已完成。
