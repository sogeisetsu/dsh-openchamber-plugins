---
title: deepwork 工作流技能（借原则，适配 DSH 的 Goal / Plan / Subagent / Team）
status: backlog
created: 2026-11-16
last_reviewed: 2026-11-16
owner: 我
related:
  - todo/verification-planning-skill.md
  - todo/simplify-skill.md
---

# deepwork 工作流技能（借原则，适配 DSH 的 Goal / Plan / Subagent / Team）

## 想法

把 OMO Slim 的 `deepwork` 工作流移植到 DSH，但**只借原则，不搬全文**：

- 不搬 OMO 的 7 个 agent 角色（orchestrator / explorer / oracle / council /
  librarian / designer / fixer），也不搬 `.slim/deepwork/` 状态文件与
  `/deepwork` 命令的原文；
- 不重写 DSH 已有的 **Agent Team / Sub Agent / Plan / Goal**，而是设计一个
  协议，让 deepwork 的「分 pass 推进」跑在这些原生能力之上；
- 落地形态优先是**一条用户级技能**（`~/.dsh/skills/deepwork/SKILL.md`），
  不需要插件；除非以后要参数化命令（如 `/deepwork --passes 3`）。

## 借用的原则（只借这些）

1. **分 pass 推进**：先 thin end-to-end sketch → 再 structure（数据模型/边界/
   主失败路径）→ 再 detail（加固、崩溃恢复、边界、打磨）；安全、钱、数据
   正确性永不推迟到后面的 pass。
2. **每个 pass 有单行目标 + 若干 lane**，lane 之间写入范围不重叠。
3. **一个 pass 一个 review gate**：lane 先跑聚焦检查，宽泛验证每 pass 只跑
   一次；gate 只针对本 pass 的完成度，later-pass 的问题记入 known issues。
4. **pass 结束必须 step back**：整体跑一遍、重新规划下一个 pass、把长歪/过大的
   代码重组。
5. **lane 汇报格式固定**：改了哪些文件、跑了哪些命令 + exit code、哪些没验证。
6. **接受以决定性产物为准**，不是以 lane 的自述为准。
7. **默认自主跑到底**，只在真正阻塞时问用户（凭据、付费、不可逆/公开操作、
   或用户要求 check-in）。
8. **状态保持很小**：只记当前 pass、目标、下一步、决策、进行中的 lane、
   known issues（用于压缩后恢复，不是活动日志）。

## DSH 适配：与原生能力怎么配合（不重写它们）

| DSH 原生能力 | deepwork 里怎么用 | 明确不做什么 |
|---|---|---|
| **Goal**（`dsh-goal` / `ctx.goal`，持久目标 + 轮次上限） | 跨多轮的大任务先建一个 goal：objective 写清交付物与验收标准；goal 的自动续轮承载「继续下一个 pass」；pass 完成/阻塞时更新 goal；轮次上限防失控 | 不用 goal 做单轮任务；不自己造续跑循环；不绕过 `update_goal` 的 complete/blocked 语义 |
| **Plan**（`dsh-plan-mode` `/plan`，可审批、可 resume） | 可选：任务开始或进入下一个 pass 时用 plan 呈现「这个 pass 的目标 + lane 划分 + 验收」，需要用户审批时才进 plan mode；计划文档作为 pass 的单一事实来源 | 不另造一套计划文件格式；不让 plan 模式拖慢不需要审批的推进 |
| **Todo**（`todo_write`） | 每个 pass / lane 一条 todo；pass 过 gate 后完成；known issues 可临时用 todo 记录 | 不再单独维护 OMO 的 `progress.md`（见「状态」里的可选兜底） |
| **Subagent**（spawn 独立子代理，返回结果） | **lane 的主要载体**：父 agent 给 lane 下「写范围 + 验收标准 + 汇报格式」，子代理在自己的上下文里干活，返回后父 agent 用一个决定性产物验收 | 不让子代理互相改同一批文件；不把 review gate 交给正在写代码的 lane 自己 |
| **Agent Team**（Lead + 命名 teammate + 共享任务板，实验性） | 仅当用户明确要「长期并行、可互发消息的队友」时使用：Lead = 本工作流编排者，teammates = lane 拥有者，共享任务板 = pass/lane 看板；deepwork 只在其上加 pass/gate/step-back 协议 | 不重定义 roster、消息、任务板；不默认把每个 lane 都开成 team（成本高），默认用 subagent |
| **Workflow 工具**（脚本化 fan-out） | 可选：一个 pass 内如果是纯并行、无交互的批处理 lane，可用 workflow 脚本编排 | 不把需要人审批/跨 pass 决策的流程塞进 workflow |
| **验证** | 每个 pass 开始前用 `verification-planning` 技能设计证据路径；pass 结束时沿路径取证 | 不把「现有测试跑绿」当成「行为被证明」 |

### pass 的推荐形状（DSH 版）

```
Pass N（目标一行）
├─ 建/更新 goal（跨多轮时）或 plan 段落（需审批时）
├─ 写 todo：lane A / lane B / …（每个 lane 有明确写范围）
├─ 派 subagent 执行 lane（或 Agent Team，用户要求时）
│    └─ 每个 lane 汇报：改动文件、命令+exit code、未验证点
├─ 父 agent 验收：读 diff/产物，抽查一个决定性证据
├─ 宽泛验证一次（测试/构建/手动跑主路径）
├─ review gate：只读 reviewer（独立 subagent；需要换家族时用 codebuddy-second-opinion）
├─ 修复 gate 发现的问题（属于本 pass 的）
├─ step back：整体再跑一遍、重组过大的代码、更新 plan/todo/goal
└─ 下一个 pass（或完成）
```

### 状态与压缩后恢复

- 默认靠 **Goal + Plan + todo + 会话历史**恢复；会话被压缩后，先读 goal 的
  objective/状态、最近 plan 段落、todo 列表，再继续。
- 如果实测发现 plan/todo 在压缩后不可靠，再考虑一个**很小的**兜底状态文件
  （例如 `<repo>/.dsh/deepwork/<slug>.md`，≤40 行：当前 pass、目标、下一步、
  known issues）。是否引入、放哪、是否加 `.gitignore` 见待解决问题，先不默认
  写文件。

## 交付物

- 用户级技能：`~/.dsh/skills/deepwork/SKILL.md`（验证通过后归档到本仓库
  `skills/deepwork/`）。
- 技能正文只保留「原则 + DSH 能力映射 + pass 形状 + 汇报格式 + 何时不要用」，
  不复制 OMO 的 7-agent 编排提示词。
- 可选：`references/` 放一个 pass 模板与 review gate 清单；先单文件。

## 验收

1. 一个跨 3–5 个文件的小功能：skill 能把任务拆成 sketch/structure/detail
   三个 pass，每 pass 有 lane 与 gate，最终验收通过；
2. 一个「需要多轮才完成」的任务：goal 续轮 + pass 推进配合正常，轮次上限
   不会被无意义耗尽；
3. 中途压缩上下文：能从 goal/plan/todo 恢复，不重做已完成 pass；
4. lane 之间无写冲突；review gate 由独立 reviewer 完成；
5. 用户中途说「停/换个方向」：立即停，不自动继续。

## 待解决问题

- **goal 与 pass 的粒度**：一个 goal 对应整个任务、每个 pass 是 goal 的一轮，
  还是多个 pass 共用一轮？需要实测 DSH goal 的续轮行为再定。
- plan 在压缩/resume 后是否可靠；是否真的需要一个小的 deepwork 状态文件
  （以及放 `.dsh/` 是否要 gitignore）。
- lane 载体：默认 subagent 还是 Agent Team（用户要求时才用 team）；subagent
  能不能拿到「写范围」的硬约束（目前靠提示词 + 父 agent 事后检查 diff）。
- review gate 用哪个 reviewer：独立 subagent（同模型）还是
  `codebuddy-second-opinion`（不同家族）；是否和 profile 里的
  experimental auto-review 重叠、怎么避免双审。
- 提交策略：pass 结束是否 commit（默认不自动 commit，需用户批准/项目规则
  允许）；commit 信息与 pass 的对应。
- 什么时候不该用 deepwork：单文件、小 bugfix、探索性 spike；技能里要写清
  「不要用」清单，避免每次都摆出重流程。
- 与 `simplify`（收尾）、`verification-planning`（证据）、`reflect`（复盘）
  的衔接：在哪些 pass 边界调用它们，避免重复劳动。
- 是否需要模型/agent 预设建议（例如实现 lane 用便宜模型、reviewer 用强模型），
  第一版不强制。

## 实现记录

- 2026-11-16 —— 创建（方案阶段，尚未实现；只借原则，适配 DSH 的
  Goal/Plan/Subagent/Team）。
