---
title: 实现 OpenCode 的 /init 命令（初始化项目 AGENTS.md）
status: backlog
created: 2026-11-16
last_reviewed: 2026-11-16
owner: 我
related: []
---

# 实现 OpenCode 的 /init 命令（初始化项目 AGENTS.md）

## 想法

复刻 OpenCode 的 `/init`：一条命令扫描仓库里的关键文件，必要时问一两个
**真正无法从代码回答**的问题，然后创建或更新项目根目录的 `AGENTS.md`，把
后续 agent 会话最需要的项目知识写进去。

聚焦内容（与 OpenCode 一致）：

- build / lint / test 命令，以及命令的执行顺序和验证步骤；
- 从文件名看不出来的架构与目录结构；
- 项目特有的约定、环境坑、初始化怪癖；
- 引用已有的指令来源（Cursor / Copilot / `CLAUDE.md` 规则），而不是复制一遍；
- 已有 `AGENTS.md` 时**原地改进**，不盲目覆盖。

## 为什么重要

- DSH 现在没有「项目指令文件初始化」入口：新仓库要 handoff 给 agent，得手写
  `AGENTS.md` 或每次重复解释构建/测试/约定。
- 一次 `/init` 之后，后续会话都能自动加载项目规则（`dsh-agent-instructions`
  会加载项目链），少踩坑。
- OpenCode 用户已经习惯 `/init`，移植过来降低切换成本。

## OpenCode 参考

- 官方文档：[Rules → Initialize](https://opencode.ai/docs/rules)（以及
  `anomalyco/opencode` 仓库的 `rules.mdx`）。
- 行为要点：`/init` 扫描重要文件，代码库回答不了时问少量针对性问题，然后
  创建/更新 `AGENTS.md`；已有就改进而不是替换。
- OpenChamber 侧只是把 `init` 列进命令面板（内置命令，描述
  “Create/update AGENTS.md file”），真正的执行由 OpenCode 负责。

## DSH 实现方案（两个选项，倾向 A）

### A. 用户级技能（推荐，零插件）

`~/.dsh/skills/init/SKILL.md`，用 `/init` 调用（DSH 技能默认
`user-invocable: true`，会出现在 `/` 菜单）。技能正文规定：

1. 先看仓库根：`package.json` / `pnpm-workspace.yaml` / `pyproject.toml` /
   `Cargo.toml` / `go.mod` / `Makefile` / CI 配置 / README / 现有 `AGENTS.md`
   / `CLAUDE.md` / `.cursor/rules` / `.github/copilot-instructions.md`。
2. 从 manifest 和 CI 里**核实**命令真实存在，再写进 `AGENTS.md`；不要猜。
3. 列出架构、目录职责、项目约定、环境坑；只写对未来会话有用的，不写显然的
   文件清单。
4. 最多问 1–2 个代码库回答不了的问题（例如部署环境、外部服务依赖）；能查就
   自己查，不把查事实的活丢给用户。
5. 写**项目根** `AGENTS.md`（绝不写 `~/.dsh/AGENTS.md`）；已有文件只做最小
   追加/修订，保留用户原有风格与内容。
6. 报告：新增/更新了哪些小节、无法确定的点、建议 commit。

### B. Host 插件命令（需要参数/随插件分发时再用）

照 `plugins/dsh-summary-command` 的结构做一个 host 插件：`/init` 用
`ctx.commands.register` 注册，`agent.followup()` 把「可见请求 + 隐藏指令」
作为一条用户消息投回当前会话；agent 用现有文件工具扫描并写
`AGENTS.md`。适合以后要加 `--global`、`--force`、`--model` 等参数，或想和
其他插件一起打包分发。

## 待解决问题

- 技能还是插件：`/init` 不需要参数、也不需要额外模型调用，技能就够；等确实
  需要参数/统一分发时再升级成插件。
- `/init` 是否会与将来 DSH 内置命令重名（当前已装包核对没有 `init` 命令；
  DSH 的 `/name` 与宿主命令同名时优先解析为宿主命令）。
- monorepo：先只写根 `AGENTS.md`；是否像 OpenCode 文档那样支持每包
  `AGENTS.md`，后置。
- 是否运行扫描到的 test/lint 命令：OpenCode 不强制；DSH 里建议只核实命令
  存在，不要跑（跑测试可能很慢/有副作用）。
- 语言：技能正文用英文还是中文；写进 `AGENTS.md` 的内容语言跟随仓库现有
  文档语言，而不是跟随 UI 语言。
- 与 `dsh-agent-instructions` 的 `CLAUDE.md` 兼容：已有 `CLAUDE.md` 时优先
  引用，不重复内容。

## 实现记录

- 2026-11-16 —— 创建（方案阶段，尚未实现）。
