---
title: 实现 OpenCode 的 /init 命令（初始化项目 AGENTS.md）
status: done
created: 2026-11-16
last_reviewed: 2026-11-16
owner: 我
related:
  - skills/init/
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

## DSH 实现方案（已选 A）

### A. 用户级技能（已实现）

`<dshHome>/skills/init/SKILL.md`，用 `/init` 调用（DSH 技能默认
`user-invocable: true`，会出现在 `/` 菜单；同名宿主命令优先，已核对无冲突）。
技能正文规定：

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

## 实现决策（原待解决问题）

- **技能还是插件**：选技能。`/init` 不需要参数、不需要额外模型调用；等确实
  需要参数或统一分发时再升级成插件（方案 B 保留作后续参考）。
- **命令重名**：已核对当前安装包与 profile 插件，宿主命令只有
  `compact` / `feedback` / `goal` / `permission` / `plan` / `export` 与
  `summary`，没有 `init`；宿主命令优先的规则已知，若将来冲突再改名。
- **monorepo**：只写项目根 `AGENTS.md`，正文里说明包布局；每包 `AGENTS.md`
  只在用户明确要求时创建（DSH 在 agent 触达该目录后才加载）。
- **是否运行扫描到的 test/lint 命令**：不运行；只核实命令在
  manifest / Makefile / CI 中真实存在，核实不了就不写。
- **语言**：技能正文用英文（仓库分发物约定）；写进 `AGENTS.md` 的内容语言
  跟随目标仓库现有文档，而不是跟随 UI 语言。
- **`CLAUDE.md` 兼容**：DSH 会原样加载 `CLAUDE.md`；因此只按路径引用、不复制
  内容，内容相同的重复文件 DSH 也只渲染一次。

## 实现记录

- 2026-11-16 —— 创建（方案阶段，尚未实现）。
- 2026-11-16 —— 实现：新增用户级技能 [`skills/init/`](../skills/init)，按方案 A
  落地 `/init`；安装方式仍是「把目录复制到 `<dshHome>/skills/`」，与技能安装
  模型一致（技能不走 `plugin_manager` / link）。技能规定只写项目根
  `AGENTS.md`、全局指令文件（`<dshHome>/AGENTS.md`、`~/.agents/AGENTS.md`、
  `*.local.md`）列为禁止项、已有文件原地改进、命令不核实不写、不跑
  build/test/lint、不提交。
- 2026-11-16 —— 验证：`skill` 工具可加载该技能；在 git 忽略的
  `<repo>/.tmp/init-smoke` 夹具中跑通一次生成，第二次运行无改动（幂等，文件
  hash 不变）；`zh-doc-sync` 结构检查通过。首次跑测暴露的边界已补进技能正文：
  无人类可问时走保守路径、指令文件与 manifest 冲突时以 manifest 为准、
  `.env.example` 疑似真实密钥时只写变量名、`CLAUDE.md` 只有规则时 `Commands`
  不算重复、报告里的 `git commit` 命令仅作提示不得执行。GUI 里正式 `/init`
  需在**新会话**中人工确认 —— `/` 菜单的目录按会话缓存，新增 `SKILL.md` 不会
  触发刷新事件（模型侧目录会经 watcher 更新）。
