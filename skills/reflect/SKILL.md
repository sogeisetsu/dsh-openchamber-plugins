---
name: reflect
description: Review recent work and turn repeated friction into the smallest reusable asset (an AGENTS.md rule, a skill, a plugin setting, a scheduled task, or nothing). Use when the user asks to 复盘 / 反思 / 总结经验 / reflect on sessions / find what keeps repeating / 把重复工作沉淀下来, or when the same request or fix has clearly happened twice. Reads DSH session archives through the bundled miner script; proposes before changing anything.
---

# Reflect（DSH 版）

从真实使用证据里找重复的摩擦，提出**最小可用**的改进。核心立场：**"什么都不做"是一个成功结论**；没有证据就不要造资产。

## 什么时候用

- 用户说 `reflect`、"复盘一下"、"总结最近的会话"、"我是不是总在重复做同一件事"、"把重复的活沉淀成技能"。
- 你注意到同一个请求/修法在本会话或最近几个会话里出现了 ≥2 次。
- 不要用于：一次性调试、纯代码实现、没有证据的架构猜测。

## 证据顺序（先便宜后昂贵）

1. **当前会话**：用户的原话、你踩过的坑、返工点。
2. **项目约定**：`AGENTS.md`、`README`、`.dsh/`、现有 skills/plugins 配置。
3. **历史会话**（可选，需要用户同意范围）：用本技能的 `scripts/mine-sessions.mjs`。
4. **外部文档**：只在需要确认能力时查。

## 阶段 1 — 先盘点现有资产（避免重复造）

- 技能根目录（按优先级）：`<repo>/.dsh/skills` → `<repo>/.agents/skills` → `~/.dsh/skills` → `~/.agents/skills`。先看已有技能名和描述，能扩展现有技能就不要新建。
- 插件与配置：`~/.dsh/profiles/<profile>/`、启用中的官方插件（用 `official-plugins` 技能查，不要读源码）。
- 项目指令：`AGENTS.md`（根与子目录）、`.dsh/` 下的项目约定。**注意区分**：`~/.dsh/AGENTS.md` 是**全局个人规则**（所有工作区生效）；`<repo>/AGENTS.md` 才是**项目级**。两者不要混用。
- 已排期的任务：系统里的 scheduled tasks（如果有）。

## 阶段 2 — 找重复模式

候选信号（任一命中就记一条证据）：

- 同一串命令/工具序列反复出现（看会话摘要里的 tool 计数）。
- 同一类请求反复出现（"再帮我扫一下磁盘"、"又有个 issue 要提"）。
- 反复先花几轮做同样的上下文收集。
- 同一条项目规则被用户反复解释。
- 同一类失败反复发生，且根因是缺少某条指令/工具/权限。
- 同一份检查清单每次手写。

## 阶段 3 — 打分与门槛

每个候选打分：**频次**（出现几次/几个会话）、**成本**（每次浪费多少步/多少 token）、**风险**（沉淀错了会不会误导）、**稳定性**（输入输出是否稳定）、**覆盖面**（单项目还是跨项目）。

只有 **≥2 次、输入输出稳定、有明确停止条件** 的才推荐；否则写进"需要更多证据"。

## 阶段 3.5 — 作用域裁决（硬门槛，先于"选形态"）

同一份证据能写到哪一层，取决于**证据覆盖范围**，不取决于哪个文件好写：

| 证据覆盖范围 | 允许的目标 | 禁止 |
|---|---|---|
| 只来自 **1 个工作区** | **项目级**：`<repo>/AGENTS.md`（没有就新建）、项目 `.dsh/`、项目级技能 | ❌ 禁止写 `~/.dsh/AGENTS.md`（全局） |
| 跨 **≥2 个工作区**，或与具体项目无关（工具/环境/harness 通用惯例） | 可提全局 `~/.dsh/AGENTS.md`，但提案必须标 `global`，并写一句"为什么不是项目级" | ❌ 不能因为"工作区没有 AGENTS.md"就退化成全局 |
| 不确定 | 先提项目级 | ❌ 不要猜成全局 |

规则：

1. **单工作区证据 → 全局规则是越权**。正确动作是新建/追加项目级 `AGENTS.md`。
2. 全局改动必须**用户显式批准**；提案里不能预先把它标成"推荐"来引导选择。
3. 每条建议都要写明 `scope: project <路径>` 或 `scope: global ~/.dsh/AGENTS.md`。
4. 只有用户明确说"这条对所有项目都适用"时，才算授权全局；把这句话记进提案。

## 阶段 4 — 选最小形态（按顺序，能停就停）

1. **项目级** `AGENTS.md` 加一条规则（最便宜；要否升级到全局，先过 3.5 的作用域裁决）
2. 扩展现有技能的一节
3. 新建一个 skill（有明确触发条件 + 稳定流程）
4. 新建插件/工具（需要代码与维护）
5. 定时任务（需要一个重复的节奏，而不是一次性需求）
6. **跳过**（证据不足，或收益低于维护成本）

## 阶段 5 — 先提案，再动手

输出提案后**等用户确认**再写文件：

```
找到 N 条强证据 / 推荐 M 项
作用域：证据覆盖 K 个工作区 → 只能提 project / 可提 global（理由：…）
1. <改什么> — <形态> — scope: project <路径> 或 global ~/.dsh/AGENTS.md — 证据：<会话 id 或用户原话> — 预估收益
建议跳过：<项>（原因）
需要更多证据：<项>
继续吗？
```

写入时：只做追加/最小改动，保留用户原有风格与配置；改完读回验证；说明是否需要重启（技能目录改动会被自动发现，插件与配置改动通常需要重启或 UI 操作）。

## Session 模式（历史会话考古）

脚本：`scripts/mine-sessions.mjs`（Node ≥22.15，零第三方依赖，只读）。它解压 `~/.dsh/sessions/<workspace-slug>/<session-id>/session.v4.jsonl.zstd`（zstd 多帧 + 每行一个 JSON 事件），产出每会话摘要：目标、轮次、token、模型、工具频次、工具错误、时长。

```pwsh
$s = '<本技能目录>'
node "$s\scripts\mine-sessions.mjs" list --last 20
node "$s\scripts\mine-sessions.mjs" summary --last 20 --workspace auto --json
node "$s\scripts\mine-sessions.mjs" show --session <id>
```

## 参数（对话里怎么说，就怎么映射）

OMO 版的 `/reflect`、`--sessions`、`--last N` 是 OpenCode 的命令参数。DSH 没有斜杠命令，改用**对话 + 本技能的参数语义**；你把用户的话解析成下面这些形态再执行：

| 用户说法（示例） | 参数形态 | 行为 |
|---|---|---|
| "复盘一下这次" / "reflect" | `reflect`（默认） | 只看当前会话 + 现有资产，不读历史档案 |
| "复盘最近的会话" / "看看以前是不是也这样" | `reflect --sessions` | 用脚本读当前工作区最近 20 个会话 |
| "最近 7 个会话" / "看 50 个" | `--last N` | 限定数量 |
| "只看这个项目"（默认） | `--workspace auto` | 按会话头 `cwd` 精确匹配当前工作区 |
| "所有项目都看看" | `--workspace all` | ⚠️ 先过隐私 Gate，逐项确认 |
| "只看某个工作区" | `--workspace <slug 片段>` | 按工作区目录名过滤 |
| "上周以来的" / "11 月之后的" | `--since 2026-11-01` | 按会话开始时间过滤 |
| "只查'反复改配置'这一类" | `--focus "配置反复改"` | 只围绕该主题找证据（提示层过滤，不写进脚本） |
| "先别改，只给建议" | `--dry-run`（默认行为） | 只出提案，不改文件 |

组合例：`reflect --sessions --last 30 --since 2026-11-01 --focus "重复审查"` → 脚本
`summary --last 30 --json`，你再用 `--focus` 收窄分析。

参数缺省时一律按**最保守**解释：默认 `reflect`（不读历史）、默认当前工作区、默认只提案不改。

规则：

- **默认只读当前工作区**（`--workspace auto`，按会话头里的 `cwd` 精确匹配）。要看其他工作区必须 `--workspace all`，且**先过隐私 Gates**：其他工作区可能含个人/无关内容，逐项问用户是否允许。
- 摘要缓存在 `~/.dsh/reflect-cache/<session-id>.json`；缓存存在就直接复用，不要重复解压。
- **绝不要把 1–2 MB 的归档原文读进上下文**：用脚本输出的摘要；需要某条证据细节时，用 `show` 单会话，或用原生 `session_event_read` 精确取一条事件。
- 数字只能来自脚本输出；脚本失败/跳过就说失败，不要估。
- 原生 `session_search` 在本 profile 可能报 "session history storage is unavailable"；失败时不要重试循环，改用本脚本 + `session_event_search`（单会话内检索）。

输出格式（Session Reflection Report）：

```
## 范围
处理 N 个会话 / M 个项目；跳过 K 个（原因）

## 发现
- <模式> — 出现在 N 个会话 — 置信度 0.9 — 影响：<每次多花几步>

## 建议
- <资产形态> — scope: project <路径> / global ~/.dsh/AGENTS.md — 置信度 — 预估每次省下的步数

## 跳过 / 需要更多证据
```

## 置信度

- 0.9–1.0：用户明说 + 多次出现
- 0.7–0.9：工具/命令序列高度相似
- 0.5–0.7：可能相关，需用户确认
- <0.5：不写进报告，或只放"需要更多证据"

## 硬约束

- 只读会话档案，绝不改写/删除 `~/.dsh/sessions`。
- **不得把单工作区证据升级为全局规则**：`~/.dsh/AGENTS.md` 的改动必须用户显式批准，且先过 3.5 的作用域裁决。
- 不在输出里粘贴密钥、token、私有路径细节；引用会话时说 id 与时间。
- 提案前不改任何文件；改动前给 diff 或摘要；用户拒绝就停。
- 不虚构频次：没有脚本证据就不写"N/50"。
