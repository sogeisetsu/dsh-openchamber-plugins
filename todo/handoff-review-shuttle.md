---
title: 自动往返评审（handoff-review shuttle）插件
status: backlog
created: 2026-11-15
last_reviewed: 2026-11-15
owner: 我
related: []
---

# 自动往返评审（handoff-review shuttle）插件

## 想法

复刻 OpenChamber 的「交接 → 独立评审会话 → 自动往返」流程，做成一个 DSH
插件：一条 `/handoff-review` 命令启动，实现会话先产出交接，插件自动新建一个
独立评审会话，评审意见自动回流给实现方；实现方的回应再自动回到评审会话重审，
多轮往返直到通过或到达轮次上限。用户随时可以插话或停止，用户永远优先。

**这个方案按「自动往返 shuttle 必须实现」设计，因此必须写插件**（技能做不到
自动来回）。范围控制得比较小：**一个 host 插件 + 两个会话 + 一个共享目录 +
一个状态机**。

## 目标行为（对齐 OpenChamber）

| 行为 | 是否实现 |
|---|---|
| 一条命令自动生成 handoff | ✅ |
| 自动新建独立评审会话（侧栏可见） | ✅ |
| 评审意见自动回给实现会话 | ✅ |
| 实现方的回应自动回到评审会话再重审 | ✅ |
| 多轮往返直到通过或到达上限 | ✅（默认 2 轮，硬上限 3） |
| 用户插话/停止随时生效 | ✅（用户优先） |
| token 预算、手机推送、目标式续跑 | ❌ 不做（用轮次限制 + 本地提示代替） |

## 架构

```
┌───────────────────────────── DSH 进程 ─────────────────────────────┐
│  插件 dsh-handoff-review（host，唯一新代码）                        │
│   ├─ /handoff-review 命令                                          │
│   ├─ shuttle 状态机（内存 + 可选落盘）                              │
│   ├─ 会话创建 / 消息投递 / turn-end 监听                           │
│   └─ 共享目录：<cwd>/.dsh/handoff/<runId>/                          │
│        ├─ handoff.md        实现方写                                │
│        ├─ review-N.md       评审方写（首行 STATUS: CHANGES/DONE）   │
│        └─ response-N.md     实现方写（可选，回应摘要）              │
│                                                                      │
│  会话A（实现会话）   ──消息──►  会话B（自动创建的评审会话）          │
│        ▲                                   │                        │
│        └──────────── 消息 ◄────────────────┘（插件转发）            │
└─────────────────────────────────────────────────────────────────────┘
```

关键设计：**payload 走文件，不走消息解析**。双方把 handoff / review /
response 写成固定路径的文件，插件只负责「turn 结束后读文件 + 把提示投给
对方」。这比解析 assistant 文本可靠得多，还自带归档。

## 状态机

```
IDLE
 └─ /handoff-review ─► WAIT_HANDOFF      发 visible+hidden prompt 给实现方
        └─ 实现方 turn end ─► REVIEW_CREATE   校验 handoff.md 存在，创建评审会话
             └─ REVIEW_ROUND1   发“评审 starter + handoff”给评审方
                  ├─ review-1.md STATUS: DONE ──► FINISHED
                  └─ STATUS: CHANGES ─► WAIT_IMPL  把 review 内容 + 权衡规则投给实现方
                        └─ 实现方 turn end ─► REVIEW_RESCAN  把 response + 重审规则投给评审方
                             ├─ STATUS: DONE ──► FINISHED
                             └─ STATUS: CHANGES 且 round < max ─► WAIT_IMPL（下一轮）
                                     └─ 达到 maxRounds ─► FINISHED(round-limit)
  任意状态：
    /handoff-review stop      → CANCELLED（取消在跑的那一侧，会话保留）
    用户向实现会话发消息       → PAUSED（用户优先；/handoff-review resume 续跑）
    插件卸载 / HMR / 错误      → CANCELLED（发提示，不自动重试）
```

## 消息协议（5 段 prompt + 文件协议）

沿用 OpenChamber 的 5 段 prompt，只加三处 DSH 化改动：**写文件路径**、
**STATUS 行**、**只读约束**。

| # | 方向 | 内容 | 与 OpenChamber 的差异 |
|---|---|---|---|
| 1 | 插件 → 实现方 | 「为另一个 Agent 准备交接」+ 隐藏指令（意图/决定/范围外/实现/文件/取舍/验证/缺口），**写入 `.dsh/handoff/<runId>/handoff.md`** | 改成写文件，其余不变 |
| 2 | 插件 → 评审方 | 「请评审这份交接」+ handoff 全文 + **只读约束** + 「把评审写入 `review-1.md`，首行 `STATUS: CHANGES` 或 `STATUS: DONE`」 | 加文件与 STATUS |
| 3 | 插件 → 实现方 | 反馈回流 + **逐条权衡规则**（预存问题算 nit、引入问题必须修、最小修复、反驳要带证据） | 原样保留 |
| 4 | 插件 → 评审方 | 实现方回应 + **重审规则**（逐条说 fixed/declined/still open，只报新引入的问题） | 原样保留 |
| 5 | 无 handoff 变体 | 评审方从 diff 反推意图，显式标注不确定性 | 原样保留 |

缺失 `STATUS` 的处理：第一次视为 `CHANGES` 继续一轮；第二次仍缺 → 停止并报告
「评审方未按协议输出」。

## 插件实现要点（方案已核实的 API）

| 要做的事 | 用哪个 DSH 能力 | 依据 |
|---|---|---|
| 提供 `/handoff-review` 命令 | `commands` 服务 + `CommandDefinitionId`，参考现有 `plugins/dsh-summary-command` | 本仓库已有插件代码 |
| 新建评审会话 | `sessionController` 的 `session/create`（可指定 workspace、agent preset），或直接 `ctx.agents.create({ sessionId, agentOptions:{provider, model}, setup })` | asar 里 session-controller 契约、agent-loop README（"Plugins and hosts create agents through ctx.agents.create()"） |
| 向某个会话投递消息 | `agent.followup(createUserMessage({ content, source }))`，可排队/唤醒空闲 agent | `dsh-summary-command` 同款用法；ACP bridge 内部也用它 |
| 判断「对方这一轮结束了」 | 订阅会话 `turn/end` 事件（`turn/start` / `turn/end` 是持久事件）；备选 `agent/pre-step`、`agent/error` | asar 会话契约 |
| 读/写共享文件 | 普通 fs（插件有 host 权限） | — |
| 状态持久化 | 内存为主；可选写 `plugin-data/dsh-handoff-review/shuttle.json` 支持 HMR 后恢复 | plugin-data 目录已存在 |
| 生命周期清理 | 插件卸载/HMR 时取消 in-flight、发提示（参照 goal-round-driver 的 fail-closed teardown） | goal-round-driver README |

配置项（写在插件内，默认值可改）：

- `maxRounds=2`（硬上限 3）
- `reviewModel`（默认跟随实现会话，可 `--model provider/model` 换家族）
- `pauseOnUserMessage=true`
- `diffLimitChars=80000`
- `autoOpenReviewSession`（UI 支持时自动切过去，否则仅提示）

## 用户交互

```
/handoff-review [topic]                启动（topic 可选，进 handoff 的聚焦说明）
/handoff-review --rounds 3             自定义轮次
/handoff-review --model kimi/k3        评审用不同模型家族
/handoff-review status                 查看当前轮次/状态
/handoff-review stop                   停止（保留两个会话）
/handoff-review resume                 用户插话后恢复 shuttle
```

- 启动后**用户只需等**：插件自动完成「交接 → 评审 → 回流 → 修复 → 重审」。
- 每轮向实现会话发一行进度：`round 1/2 · reviewer=<model> · STATUS=CHANGES`。
- 评审会话出现在侧栏（标题 `Review — <topic>`），可以随时点开看它写到哪。
- 用户一旦在实现会话里说话，shuttle 自动暂停（用户永远优先）。

## 安全与边界

1. **评审方只读**：prompt 约束 + 插件在每轮前后记录 `git status --porcelain`
   与工作树 hash，除允许的 `review-N.md` 外有任何变化 → 中止并报告「评审会话
   改动了工作区」。
2. **diff 截断**：先 `--stat`，超阈值只给 stat + 关键 hunk，并在 review prompt
   里注明「已截断」。
3. **成本上限**：轮次上限（默认 2）+ 可选 `--rounds`；结束报告 rounds、各轮
   模型、耗时（token 能从 token-meter 读到就报）。
4. **敏感内容**：diff 会进入评审会话（另一个模型）；含密钥时先脱敏，或
   `--no-diff` 只发文件清单。
5. **版本兼容**：`ctx.agents` / `sessionController` / 会话事件属于**内部契约**，
   DSH 升级可能变；插件按版本锁死并在升级后跑回归（M0 探针先行）。
6. **不自动改代码**：评审通过后不自动 commit/push；实现方的修改由它自己按
   反馈做。

## 交付物与里程碑

```
plugins/dsh-handoff-review/
├── package.json          # name/dsh.bundle.patch/engines/peerDeps
├── cordis.patch.yml      # 插入 host 入口（照抄 dsh-summary-command 的结构）
├── index.js              # 命令注册 + 状态机 + 会话/消息/事件
├── lib/prompts.js        # 上面 5 段 prompt（含 STATUS 与文件路径）
├── lib/status.js         # STATUS 解析与兜底
├── locale/en.json, zh.json
├── icon.svg
└── README.md
```

| 里程碑 | 内容 | 预计 |
|---|---|---|
| M0 探针 | 用最小插件验证：`ctx.agents.create` 建会话、`followup` 投消息、`turn/end` 能收到、`session/create` 可指定 cwd | 0.5 天 |
| M1 命令 + 交接 | `/handoff-review` 注册、实现方产出 `handoff.md`、进度提示 | 0.5 天 |
| M2 评审会话 + 首轮 | 自动建会话、发 starter、读 `review-1.md`、STATUS 解析 | 1 天 |
| M3 双向 shuttle | 反馈回流、实现方回应回流、轮次控制、用户优先暂停、stop/resume | 1 天 |
| M4 打磨 | locale、错误处理、只读校验、自审（用 `install-review`）、装入 profile、回归 | 0.5–1 天 |

总计约 **3–4 天**，风险中等（主要在 M0 的内部 API 探针；探针失败才需要考虑
降级）。

## 验收用例

| # | 场景 | 通过标准 |
|---|---|---|
| 1 | scratch 仓库放一个 off-by-one bug，跑 `/handoff-review` | 评审方首轮指出 bug；实现方修复；第二轮 `STATUS: DONE`；全程无需用户转达 |
| 2 | 评审方故意只报 nit | 实现方按「逐条权衡」拒绝并给证据，第二轮评审方接受 `DONE` |
| 3 | 跑第 2 轮时用户插一句话 | shuttle 暂停，不继续投递；`resume` 后从当前轮继续 |
| 4 | `--rounds 1` | 第一轮后停止，报告 round-limit 与最后状态 |
| 5 | 评审方不写 STATUS | 兜底一次后停止并说明协议不符 |
| 6 | 评审前后工作树比对 | 除 `review-N.md` 外无变化；有变化则中止并报告 |

## 风险与降级

- **若 M0 探针发现 `ctx.agents.create` / 事件订阅不可用或被裁剪**：降级为
  V1「团队式 shuttle」——技能 + `spawn_teammate` 评审队友，消息自动唤醒对方
  实现往返（今天就能用，代价是没有独立评审会话、没有文件协议）。
- **评审者越权/不守协议**：STATUS 兜底 + 工作树比对 + prompt 明确只读。
- **循环烧钱**：最大轮次限制为硬性约束、默认 2 轮；每轮结束打印累计轮次与模型。

## 与 OpenChamber 对照

| 能力 | OpenChamber | 本方案 |
|---|---|---|
| 自动开评审会话 | ✅ | ✅ |
| 双向自动 shuttle | ✅ | ✅ |
| 每轮重审、只报新问题 | ✅ | ✅（沿用其 prompt） |
| 用户停止/插话优先 | ✅ | ✅ |
| token 预算 | ✅ | ❌（轮次上限替代） |
| 手机推送 | ✅ | ❌（侧栏可见 + 进度行） |
| 关掉窗口继续跑 | ✅（服务器侧） | ❌（插件在进程内，关窗口即停） |
| 维护成本 | 上游维护 | 自己维护一个 ~500–800 行插件 |

## 待解决问题

- **M0 探针尚未做**：`ctx.agents.create`、会话事件订阅、`session/create`
  指定 cwd、`followup` 排队后 turn 与实现方会话的对应关系，都需要先验证。
- 两个会话的标识与绑定：runId 与实现会话、评审会话的对应关系，以及会话被
  用户关闭/归档时如何收尾。
- 共享目录放项目内 `.dsh/handoff/` 还是 profile 数据目录：项目内便于人看，
  但可能被 git 跟踪；需要决定是否加入 `.gitignore` 或使用 plugin-data。
- HMR / 重启后的恢复：是恢复 shuttle 还是标记 CANCELLED；落盘格式要不要版本化。
- 「用户插话」的检测点：监听实现会话的用户消息事件，还是看一下 turn 的触发者
  （用户 vs shuttle）。
- 评审方只读校验的成本：每轮对整棵工作树做 hash 是否太重，是否只用
  `git status --porcelain` + 关键目录。
- 是否需要 UI 自动切到评审会话（取决于 DSH 是否有可用的打开会话 API；
  `uiWorkspace.openSession` 是 client 侧，host 插件可能要发事件）。
- token 计量：token-meter 是否对插件可用，读不到就只报轮次/耗时。

## 实现记录

- 2026-11-15 —— 创建（方案阶段，尚未开始；下一步是 M0 探针）。
