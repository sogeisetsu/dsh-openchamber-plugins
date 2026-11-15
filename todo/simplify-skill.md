---
title: 移植 OMO Slim 的 simplify 技能（行为等价地简化代码）
status: backlog
created: 2026-11-15
last_reviewed: 2026-11-15
owner: 我
related: []
---

# 移植 OMO Slim 的 simplify 技能（行为等价地简化代码）

## 想法

把 OMO Slim 内置的 `simplify` 技能移植成 DSH 的用户级技能：
`~/.dsh/skills/simplify/SKILL.md`，用 `/simplify` 调用（DSH 技能默认
`user-invocable: true`，会自动出现在 `/` 菜单），同时保留模型自动加载
（不写 `disable-model-invocation`，靠 description 里的触发词匹配）。

它做的事：在不改变行为的前提下，把代码里重复、耦合、写得不好的地方简化掉，
属于「行为等价的整理」，不是评审、不是重构功能、不改公共 API。

> 结论来自方案：这件事**不需要插件、不需要脚本**，一个 SKILL.md 就能落地。
> 与 catch-up 分开记，因为两者来源形态、验收方式和风险不同（见
> `catch-up-skill.md`）。

## 为什么重要

- DSH 现有技能里最接近的是 `codebuddy-second-opinion`（独立评审，不改码）和
  `reflect`（沉淀规则，不重构），没有「行为等价地简化」这个能力。
- 这个技能适合在功能写完后收尾，用固定流程防止「顺手重构」和「我觉得等价」。

## 来源与形态

- 来源：OMO Slim 内置技能（v3.0.6，与 master 一致），`SKILL.md` 纯文本，
  原名带 `allowedAgents: ["oracle"]`。
- 在 DSH 的对应物：普通用户级技能。**`allowedAgents` 不是 DSH 的 frontmatter
  字段，要删掉**——DSH 技能没有 agent 级作用域。
- 放置：用户级（rank 400，`~/.dsh/skills/simplify/SKILL.md`），因为这是通用
  能力，不该绑项目。技能根目录已在 DSH 文档里核对：
  `<dshHome>/skills` = user-dsh = rank 400。
- frontmatter 只保留 DSH 认识的字段：`name`、`description`（必填）、可选
  `whenToUse`；不写 `disable-model-invocation`、不写 `user-invocable`（默认
  即允许）。

## 移植方案

### 保留

- 五原则：行为等价、跟随项目约定、清晰优先、别过度简化、只改最近改动的部分；
- 四步流程（原文）与 final-state verification 的思想；
- 对「什么算简化、什么算越界」的边界感。

### 必须删 / 改

- 原文的 `## Guidance for This Repository` 一节是 OMO 写给**它自己的
  TypeScript 仓库**的（例如 "prefer straightforward TypeScript…"），直接搬会
  误导。替换成「先读本仓库 `AGENTS.md`，再照邻居代码的写法」。

### 为 DSH 增补的硬约束（移植的关键，否则它会顺手重构）

1. 用户没有明确要求简化时，不主动简化；一次只改一处；
2. 跨文件重命名、改公共 API 之前先停下确认；
3. 不动 `~/.dsh` 全局配置，不 commit / 不 push；
4. 验证必须落到**可复现证据**：跑仓库自己的 test / lint / typecheck，把命令和
   结果贴出来；仓库没有测试时，列行为等价清单并请用户确认，不允许「我觉得
   等价」；
5. 输出控制在「改动摘要 + 验证结果 + 风险」三块，别写长报告。

## 验收

1. 拿一个有测试的小模块跑：应通过测试、diff 收敛、不碰无关文件；
2. 再拿一个没测试的文件试：应拒绝或要求证据，而不是硬改。

## 待解决问题

- 拿到 OMO Slim 原文的准确路径（GitHub / npm 包），确认代码许可允许移植，
  并核对 v3.0.6 与 master 的差异（方案说一致，移植前再看一眼）。
- description 里的触发词怎么写（中文「简化一下 / 收拾一下代码 / 去去重」等），
  避免和 `codebuddy-second-opinion`、`reflect` 抢触发。
- `/simplify` 是否会和 DSH 宿主命令重名（DSH 的 `/name` 在技能与宿主命令同名
  时优先解析为宿主命令；按已装包核对目前没有 `simplify` 命令）。
- 是否要 `references/` 放检查清单；不建议加脚本（方案明确「simplify 不建议加
  脚本」）。
- 技能里写的验证命令要按仓库自适应（`package.json` scripts、pyproject 等），
  不要把某个仓库的命令写死。

## 实现记录

- 2026-11-15 —— 创建。
