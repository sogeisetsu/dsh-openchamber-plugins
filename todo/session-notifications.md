---
title: 会话系统通知：完成 / 出错 / 提问 / 待批准
status: backlog
created: 2026-11-15
last_reviewed: 2026-11-15
owner: 我
related: []
---

# 会话系统通知：完成 / 出错 / 提问 / 待批准

## 想法

在 DSH 里补一套类似 OpenChamber 的通知：会话跑完、出错、Agent 提问、请求权限
（审批）时，用系统通知（桌面 App）或浏览器通知（Web GUI）提醒你，点一下通知
直接跳到对应会话。设置里可以：

- 总开关；请求通知权限、发送测试通知；
- 提醒时机：**仅当窗口不可见时**（默认）/ 总是提醒；
- 逐事件开关：完成、子代理完成、错误、提问（权限请求默认提示，自动接受的
  会话静默）；
- 标题/正文模板，带变量（agent 名、模型名、会话名、最后一条消息）；
- 可选后置：长消息 AI 摘要、应用内 toast 兜底、后台推送。

## 为什么重要

- DSH 现在只能盯屏幕：长任务结束、会话卡在权限请求或提问上，不看着就不知道。
- 侧栏虽然有 pending-interaction 标记和未读状态，但人不在前台就看不到；
  系统通知正好补这一层。
- 这是 OpenChamber 里很实用的一块，用户明确要求「类似 OpenChamber 的通知」。

## 参考实现（OpenChamber，只读参考）

### 触发（server `packages/web/server/lib/notifications/runtime.js`）

- **完成**：`session.idle` 触发；`aborted: true` 不通知；父会话因后台子代理还在
  跑而暂时 idle 时不通知（避免「假完成」）；子代理完成用独立开关和模板。
- **错误**：`session.error`（包括自动重试耗尽）。
- **提问**：Agent 提问 / 表单请求（`notifyOnQuestion`）。
- **权限**：`permission.asked`，500ms 防抖 + 按 requestKey 去重；
  `permission.replied` 取消待发通知；自动接受权限的会话不提示（客户端把
  auto-accept 会话同步给 server，避免防抖竞态漏发）。
- 每条通知带 `tag`（`ready-<sessionId>` / `permission-<requestKey>`），用于
  合并、去重和手机 push 的角标计数。

### 送达（`packages/web/src/api/notifications.ts`、`useWebNotificationStream.ts`）

- 依次尝试：桌面 Electron 通知（`desktop_notify` IPC）→ Web Notification
  （优先 Service Worker `showNotification`，PWA 场景）→ `new Notification`；
  失败静默。
- 点击：聚焦窗口并打开 `?session=<id>`；通知被点击后关闭。
- 去重：tag 5 秒内不重复（内存 + localStorage 双保险）。
- 后台 push / 手机 push / Slack、Matrix 扩展通道是 OpenChamber 的额外能力，
  DSH 第一版不做。
- 桌面多窗口点击路由：`packages/electron/notification-host-routing.mjs` 用
  runtimeKey 找到拥有该会话的 host/窗口并复用。

### 设置（`NotificationSettings.tsx` + `zh-CN.settings.ts`）

- 总开关、权限请求、**发送测试通知**；权限被拒时引导去浏览器设置。
- `notificationMode`: `hidden-only`（默认）/ `always`。
- 逐事件：完成、子代理完成、错误、提问；权限没有单独开关（默认提示，但
  auto-accept 会话不提示）。
- 模板：每个事件的标题 + 正文可编辑，变量 `{agent_name}` / `{model_name}` /
  `{session_name}` / `{last_message}`，默认文案如「{agent_name} is ready」、
  「{model_name} completed the task」；另有「最后一条消息太长时用 AI 摘要」的
  开关 + 摘要模型 + 阈值 + 目标长度/截断长度。
- 桌面 / 浏览器 / VS Code / 手机分别有提示语；文档见
  `packages/docs/content/docs/notifications.mdx`。

## DSH 侧现状与接入点（检查 2026-11-15 的安装包）

- DSH **没有**会话通知功能：没有 notification 相关包；Electron 主进程只在
  「强制更新」时用 `new Notification`（`lib/main.js`），也没有给 renderer
  的通知 IPC。
- 但 **DSH Desktop 的 Electron 权限处理对非 media 权限直接放行**
  （`installMicrophonePermissions`：`if (permission !== 'media') callback(true)`），
  所以 renderer 里 `new Notification()` 默认可用；Web GUI 跑在 localhost（安全
  上下文），浏览器会弹一次权限请求。
- 触发数据（DSH 侧）：
  - Host 有 `session/event` 事件流（`turn/end`、`agent/request-error`、
    `approval/asked` / `approval/decided`），`ctx.userQuestions` 提问、
    `ctx.approval` 审批；`dsh-agent-loop` 的 `turn/end` 带取消原因，
    取消的不该通知。
  - Client `dsh-client-ui-session` 已经拥有「进程内 pending-interaction 与
    completion-reminder 策略」和统一 UI 状态；侧栏行本身会显示
    pending-interaction 标记——说明「在等用户」在浏览器侧已经可观测，很可能
    能直接复用，不用重新推导。
  - Client 有 `ctx.uiWorkspace.openSession(target)` 可以打开会话（通知点击
    跳转用）。
- 架构两条路：
  - (a) **纯 client 半**：在浏览器里观察会话状态/投影（完成、错误、待交互），
    自己弹 Notification / in-app toast。实现最小、无跨端通道问题；缺点是只能
    看到浏览器已知/已加载的会话（DSH 桌面与 Web 都是单客户端，够用）。
  - (b) **Host 订阅事件再推给浏览器**：更完整（未加载会话也能提醒），但第三方
    插件 host → client 的推送通道要先确认（反向的「client → host HTTP 路由」
    没有现成对等物，可能要借 client 轮询或既有事件流）。
  先按 (a) 做最小闭环，验证后再考虑 (b)。
- 设置：插件自己的 Config 命名空间 + 设置页分区（`settings.section`，可复用
  「行为设置」todo 里记的接入方式）；第一版也可以只做最小设置（开关 + 模式 +
  测试按钮）。
- 审批策略：DSH 有 `never` / `ask` 和会话级策略，`never` 或自动批准时不该
  打扰；需要读会话的有效策略来静默（`approval/asked` 事件或客户端状态）。
- 去重/合并：用 `tag`（`ready-<sessionId>`、`approval-<requestKey>`）5 秒
  去重；同一会话连续完成合并；重连/刷新重复到达的通知不重复弹。
- 模板与语言：默认中英文案跟随 UI 语言（`ctx.locale`）；变量映射到 DSH 的
  概念（agent 名/模型名/会话标题/最后一条消息）；只走本地系统通知，内容不出
  机器（不碰 OpenChamber 的加密 push/远端 relay）。
- 后置不做：web push、手机 push、Slack/Matrix 扩展通道、PR 通知、语音播报、
  通知中心历史（OpenChamber 保留 30 天错误列表）。

## 待解决问题

- 触发放 client 还是 host（见上）；client 侧能否看到「所有会话」的状态，还是
  只有当前会话/已加载会话。
- 完成的判定：`turn/end` 后要排除取消（aborted）、父会话因后台子代理/后台
  任务仍在跑而暂时 idle、以及用户紧接着又发了新消息（不该报「完成」）。
- 错误的形态：DSH 的 `agent/request-error` / 会话错误投影怎么区分「已恢复/
  可重试」与真正的失败。
- 提问与审批是两套：`ctx.userQuestions`（提问）和 `ctx.approval`（权限）要
  分别处理，文案和点击后的落点不同；auto-accept/`never` 会话要静默。
- 通知点击跳转：`ctx.uiWorkspace.openSession` 是否稳定公开；窗口最小化/在
  后台时能否真正还原并聚焦（Electron 侧可能只能 focus，不能 restore）。
- 桌面 vs Web 权限：桌面默认放行，Web 需要用户授权；未授权时设置页如何提示、
  是否 fallback 到应用内 toast（DSH 没有现成 toast 原语，可能要自带 overlay，
  参考 delete-cascade 的做法）。
- 设置存储：插件 Config 命名空间能否被用户改写并实时生效（与「行为设置」
  todo 同一个未决点）。
- 多客户端（桌面 + 浏览器同时开）：OpenChamber 用「任一 UI 可见就不弹」，
  DSH 需要 presence 汇总；先按单客户端做，记为已知限制。
- 通知内容长度截断、模板变量缺失时的兜底、通知失败静默（不能影响会话）。
- 是否需要「任务栏/侧栏角标」或点通知后标记已读；先不做。

## 实现记录

- 2026-11-15 —— 创建。
