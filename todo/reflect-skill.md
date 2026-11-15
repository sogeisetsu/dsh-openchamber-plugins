---
title: reflect 技能（复盘 → 最小可复用改进）
status: done
created: 2026-11-15
last_reviewed: 2026-11-15
owner: 我
related:
  - skills/reflect/
---

# reflect 技能（复盘 → 最小可复用改进）

## 想法

把 OMO Slim 的 `reflect` 移植成 DSH 用户级技能：从真实使用证据里找重复的
摩擦，提出**最小可用**的改进；核心立场是「什么都不做」也是一个成功结论，没有
证据就不要造资产。

## 为什么重要

- 同一个请求、同一套手工步骤反复出现时，把重复劳动沉淀成规则/技能/设置，
  比每次重新解释便宜。
- 作用域是这类建议最容易出错的地方：单工作区的证据被写成全局规则会污染所有
  项目；这个技能把「证据覆盖范围 → 允许写 project 还是 global」做成了硬门槛。

## 移植内容与改动

- 原型：**OMO Slim**（[alvinunreal/oh-my-opencode-slim](https://github.com/alvinunreal/oh-my-opencode-slim)）
  的 `reflect`（MIT）。
- 借用的部分：
  - 工作流：复盘 → 建议最小改进（技能 / agent / 命令 / 配置 / 手册 / 不改）；
  - 证据源清单（当前会话、项目约定、历史会话、外部文档，先便宜后昂贵）；
  - 作用域分类：`global` / `cross-repo` / `project-specific` 三类；
  - `--last N` 的语义与 `/reflect` 的触发方式。
- 为 DSH 改的部分：
  - DSH 没有 OpenCode 的斜杠命令参数机制，改为**对话式解析**（把用户的话映射成
    `reflect --sessions`、`--last N`、`--workspace auto|all|<slug>`、`--since`、
    `--focus`、`--dry-run` 等形态，缺省按最保守解释）；
  - 新增 `scripts/mine-sessions.mjs`：零第三方依赖、只读，解压多帧 zstd 会话
    日志并产出摘要，缓存到 `~/.dsh/reflect-cache/`；
  - 新增**阶段 3.5 前置校验**：如果证据只覆盖单个工作区，就禁止写全局
    `~/.dsh/AGENTS.md`，优先写项目级；全局改动必须用户显式批准。

## 实现位置

- 仓库：`skills/reflect/`（`SKILL.md` + `scripts/mine-sessions.mjs`）。
- 本机安装：`~/.dsh/skills/reflect/`（用户级技能，rank 400）。

## 验证

- 仓库副本与本机安装副本逐文件 SHA-256 一致。
- `node --check scripts/mine-sessions.mjs` 通过。
- DSH 技能目录会被自动发现（无需重启）；用户已在本机 DSH 中安装并确认可用。

## 实现记录

- 2026-11-15 —— 归档到仓库 `skills/reflect/`；本机安装于
  `~/.dsh/skills/reflect/`，并记录为已完成。
