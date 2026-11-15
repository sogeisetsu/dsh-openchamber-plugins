---
title: install-review 技能（安装前审查：skill / 插件 / npm 包）
status: done
created: 2026-11-15
last_reviewed: 2026-11-15
owner: 我
related:
  - skills/install-review/
---

# install-review 技能（安装前审查：skill / 插件 / npm 包）

## 想法

把「安装前审查」合并成一个 DSH 技能：装任何第三方 skill、DSH 插件、npm 包或
tarball 之前，先查来源、通读全部文件、跑静态扫描，人工复核后给出
**PASS / WARN / BLOCK** 结论和安装建议。全程只读，绝不 import、绝不执行包内
脚本。

## 为什么重要

- 插件和 skill 都是进程内/提示层代码：装上就等于把当前权限或模型行为交给它；
  DSH 沙箱只约束模型发起的工具调用，不约束插件自己。
- 先审后装能把「来源不明 + 一装就生效 + 要凭据」这类风险挡在安装之前。

## 移植内容与改动

- 原型是两条轨：
  - **A 轨：`skill-vetter`**（第三方，ClawdHub 生态，未署名；本机在
    `~/.config/opencode/skills/` 下，标 `version: 1.0.0`，上游未声明许可证）；
  - **B 轨：自建 `plugin-security-review`**（非上游，为 DSH 插件/npm 包写的审查
    流程）。
- 借用的部分（A 轨）：来源检查（仓库星数 / 更新频率 / 作者）、通读全部文件、
  权限范围判断、红旗 grep 清单、分级结论。
- 为 DSH 改的部分：
  - 两条轨**合并成一个入口**：先分类目标 → 走对应轨道 → 共用红旗清单 →
    统一 `PASS / WARN / BLOCK` 输出模板；
  - 补了零依赖离线扫描脚本：`scripts/audit.mjs`、`scripts/rules.mjs`、
    `scripts/tar.mjs`（npm/GitHub tarball 下载校验）、`scripts/selftest.mjs`，
    以及 `scripts/review.ps1` 入口；
  - 支持 tarball / GitHub 仓库 / 本地目录作为审查目标，本地目录只读不删除；
  - 补 DSH 特有高危点：`cordis.patch.yml` 的 `!!js`、插件禁用其他插件、
    `ctx.systemPrompt`/工具描述、`dsh.client` 前端注入、安装脚本。
- 许可证说明：A 轨上游未声明许可证，合并内容在本仓库保留出处；对外分发前需
  重新确认授权。

## 实现位置

- 仓库：`skills/install-review/`（`SKILL.md` + `scripts/`）。
- 本机安装：`~/.dsh/skills/install-review/`。

## 验证

- 仓库副本与本机安装副本逐文件 SHA-256 一致。
- `node --check` 通过：`audit.mjs`、`rules.mjs`、`selftest.mjs`、`tar.mjs`。
- `scripts/review.ps1` 未在本仓库内执行（避免触发网络下载/执行动作）；用户已在
  本机 DSH 中安装并确认可用。

## 实现记录

- 2026-11-15 —— 归档到仓库 `skills/install-review/`；本机安装于
  `~/.dsh/skills/install-review/`，并记录为已完成。
