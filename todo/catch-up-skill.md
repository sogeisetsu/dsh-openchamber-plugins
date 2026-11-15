---
title: 移植 OpenChamber 的 /catch-up 技能（我回来了，项目到哪了）
status: backlog
created: 2026-11-15
last_reviewed: 2026-11-15
owner: 我
related: []
---

# 移植 OpenChamber 的 /catch-up 技能（我回来了，项目到哪了）

## 想法

把 OpenChamber 的 `/catch-up` 斜杠命令移植成 DSH 的用户级技能：
`~/.dsh/skills/catch-up/SKILL.md`，用 `/catch-up` 调用（或 description 里的
中文触发词：「我回来了 / 我们做到哪了 / 接着干什么 / 同步进度」）。

触发后静默查一遍仓库状态，用几句话告诉你「项目现在到哪了、下一步做什么」，
而不是甩一份 git 报告。这是回到一个放下一段时间的项目时最常用的入口。

> 结论来自方案：**不需要插件、不需要脚本**，一个 SKILL.md 就能落地。与原
> OpenChamber 的形态不同——它是「可见消息 + 隐藏指令」的 magic prompt，DSH 的
> 斜杠技能直接把正文注入，所以只保留隐藏指令那一半。

## 为什么重要

- DSH 原生只有一半：官方 `session search` 能回答「以前怎么做的」，但**不读
  git 工作区状态**，也不给「下一步做什么」；上下文压缩/checkpoint 压的是当前
  会话，也不是项目级 orientation。
- 直接复用原生 `session_search` 补历史层，不重复造轮子。
- 只读、零风险，写完立刻能用。

## 来源与形态

- OpenChamber 侧原文在本地仓库
  `openchamber/packages/ui/src/lib/magicPrompts.ts`：
  - `session.catchup.visible`（约 699–704 行）：可见用户消息
    「Catch me up on where this project is right now.」；
  - `session.catchup.instructions`（约 706–731 行）：隐藏指令，真正的正文。
- DSH 形态：用户级技能（rank 400，`~/.dsh/skills/catch-up/SKILL.md`），
  `/catch-up` 调用；**不需要 visible 那一半**——技能正文本身就是注入内容。
- 参考文档：OpenChamber Magic Prompts 页（`/magic-prompts/`）。

## 保留的核心（来自隐藏指令）

- 静默查 git：当前分支、是否默认分支、未提交 status + diff、最近提交、与
  remote 的 ahead/behind；过程不说命令流水账，只给结论。
- 分层理解：未提交改动是焦点，但要透过分支/PR 上下文看它在「完成什么」；
  干净树才从分支工作/最近提交讲起。
- 先讲未提交改动（「看起来你正在做 X…」）；结尾给**一个实质性下一步**，而
  不是收尾杂活（推送、开 PR、跑检查只在确实没活可做时才提）。
- 硬规则：只谈当前分支和它自己的活；不倒 git 机械细节；短而可扫读；用用户
  的语言。

## DSH 适配（4 点）

1. 用 pwsh 跑 git；`gh 2.100.0` 已实测安装，feature 分支可查本分支 PR
   （`gh pr view --json`），失败就静默跳过。
2. **加一层 OpenChamber 没有的**：工作区干净或提交看不出意图时，用原生
   `session_search` 查本工作区最近 1–2 个会话，补「上次聊到哪」——只取结论，
   不倒历史。
3. **非 git 目录优雅降级**：当前 `default-workspace` 就不是 repo；改为读
   `AGENTS.md` / README / 最近改动文件，或直说「这里没有 git 上下文」。
4. **防 token 爆炸**：先 `git diff --stat`，文件数/行数超阈值就只看 stat +
   关键片段。

## 输出模板（写进技能，避免话痨）

一句定位 → 3–4 行要点 → 下一步；一屏内。

## 落地顺序与验收

1. **先做 catch-up**（只读、零风险、立刻能用）。三例验收：
   - 脏工作区（有未提交改动）；
   - 干净 feature 分支（有 PR）；
   - 非 git 目录。
   三者都必须一屏内，且事实来自真实 git 输出。
2. 再回 `simplify-skill.md` 那条。
3. 可选：如果 pwsh 下 git 采集不稳定，再给 catch-up 加
   `scripts/collect.mjs` 输出固定 JSON（像 reflect 的 miner）；**先不写**，
   避免过度工程。

## 不做

- 不做插件（装、审、维护成本高，收益低）；
- 不做「会话开始时自动触发」——那属于 recap 类插件，要写 plugin，先不做；
- 不给它挂 reviewer agent（DSH 没有 oracle 角色，也不需要）。

## 待解决问题

- `gh` 是否已登录（能查 PR 的前提）；未登录时静默跳过 PR 层的降级要写清。
- 工作区识别：当前 cwd 是 git repo 才走 git 层；非 git 目录的降级顺序
  （AGENTS.md → README → 最近改动文件）要定下来。
- 最近会话怎么「只取结论」：`session_search` 的结果摘要策略、只查本工作区、
  最多 2 条。
- 技能里的 git 命令要按 Windows/pwsh 写法，避免 `/` 路径和引号问题。
- 输出长度的硬约束最好用示例写死（一句定位 + 3–4 行 + 下一步）。
- 触发词不要和「总结会话」（summary 命令）混淆。

## 实现记录

- 2026-11-15 —— 创建。
