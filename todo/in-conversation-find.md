---
title: 会话内搜索：Ctrl+F 搜索当前对话并跳转到命中位置
status: backlog
created: 2026-11-15
last_reviewed: 2026-11-21
owner: 我
related:
  - archive/dsh-sidebar-search/
  - todo/sidebar-search.md
---

# 会话内搜索：Ctrl+F 搜索当前对话并跳转到命中位置

## 想法

在对话里按 Ctrl+F（macOS 为 Cmd+F）打开一个搜索条，只搜**当前会话**的内容：
输入关键词，命中高亮显示，用 Enter / Shift+Enter 或上/下按钮在命中之间移动，
当前命中用更强的样式标出来；点一条命中直接跳到该消息在时间线里的位置；Esc
关闭。现在 DSH 里按 Ctrl+F 没有任何反应（用户实测），长会话想回查一句旧结论
只能手动滚。

## 为什么重要

- 长会话回查（「之前那个决定是怎么说的」「上次那个报错长什么样」）是高频动作，
  没有搜索就只能靠浏览器原生 find 或手动滚动。
- 接全文索引后，连**还没加载到时间线里的旧消息**也能搜到，比浏览器 find 强。
- 命中点击跳转省掉「搜到之后自己找位置」的那一步。

## 参考实现（OpenChamber，只读参考）

### 快捷键与归属

- `ChatContainer.tsx`：用共享快捷键绑定 `getEffectiveShortcutCombo('find_in_file', shortcutOverrides)` 监听，键位可被用户改。
- 只有焦点在聊天区域内（或没有焦点但最后一次点击在聊天里）才接管；多个聊天列时按最后点击的列决定。
- 会话切换时关闭搜索条；`messageSearchEnabled` 为 false（搜索未开启/索引不可用）时不接管，把按键留给浏览器；VS Code 运行时也不接管。
- 再按一次 Ctrl+F：搜索条已打开时聚焦输入框并全选。

### 搜索条

- `components/chat/search/ChatSearchBar.tsx`：浮在聊天右上角（`absolute inset-e-3 top-2 z-20`），输入框 + `{current} of {total}` 状态 + 上/下/关闭按钮。
- Enter 下一个、Shift+Enter 上一个、Escape 关闭；查询 200ms 防抖；最短查询 3 个字符（`MIN_QUERY_TERM_LENGTH`），按空白拆词。
- 状态覆盖：搜索中、无结果、3+ characters、失败、Not available here（索引不可用）。

### 搜索本身

- 服务端会话内全文索引：`searchMessages({ query, sessionId, order: 'asc', limit: 200, before })`，分页最多 5 页（约 1000 条），命中包含未加载的消息；默认从**最新命中**开始。
- 命中结构：`{id, sessionId, role: user|assistant|reasoning, createdAt, sessionTitle, directory, snippet}`。
- `includeReasoning` 跟随「显示推理」开关：推理被隐藏时不搜推理，否则命中会指向看不见的内容。
- 服务端索引在 `packages/web/server/lib/message-search`，客户端封装在 `lib/messageSearch.ts`。

### 跳转与高亮

- 跳转：`requestMessageFocus(sessionId, messageId)` —— 走「消息链接」机制，目标消息不在已加载窗口时会自动加载更早历史；命中在推理里时先展开推理折叠块。请求有 60s TTL、只保留最新一条，换会话或找不到时失效。
- 高亮：CSS Custom Highlight API（`CSS.highlights`），两组名称 `oc-chat-search`（全部命中，半透明主题色）和 `oc-chat-search-current`（当前命中，实色）；范围只在文本节点内匹配，跨格式拆开的词不会高亮；用 MutationObserver 在行重挂载时重画，不改 Markdown DOM。

## DSH 侧现状与接入点（检查 2026-11-15 的安装包）

- DSH 目前没有会话内搜索。DSH 有全文索引：`ctx.sessionQuery.searchEvents(...)`
  （SQLite FTS5，事件级命中，带 `{sessionId, seq, type, time, surface,
  snippet}`，支持字面短语、游标分页和表层/时间过滤）；`openAt` 可配。已归档的
  `dsh-sidebar-search` 曾在**插件补丁**里把 `session-query-sqlite` 覆盖为
  `openAt: first-search`，结果因补丁随插件装卸翻转而打断宿主服务——这正是它
  被暂停的原因；正确做法是把覆盖写到 profile 层，见
  `archive/dsh-sidebar-search/POSTMORTEM.md`。
- 两个关键差异：
  1. DSH 内置客户端 `sessions.search(query)` 只返回 `{ sessionId, snippet }`，
     **没有 message id / seq**——只能定位到会话，不能定位到消息，不能直接拿来做
     会话内跳转。
  2. DSH 的聊天 DOM 没有 `data-message-id` 之类的稳定锚点（已核对
     `dsh-client-ui-chat` / `dsh-client-ui-conversation` 的客户端 bundle，只有
     composer 的 `data-composer-card`）。要「滚动到某条消息」得自己建立
     seq → 行的映射，或找 DSH 已有的公开定位机制。
- 两条可行路线：
  - **v1 纯 DOM find**：client 插件监听聊天区域内的 Ctrl+F，遍历 transcript
    scrollport 里的文本节点，用 CSS Custom Highlight API 高亮，Enter/上下在
    命中间滚动到元素、Esc 关闭。实现小、无 Host 依赖；缺点是只能搜已加载/
    已挂载的行（虚拟化或未加载的旧历史搜不到）。
  - **v2 接全文索引**：Host 侧加一条只读路由调用
    `ctx.sessionQuery.searchEvents` 拿 seq + snippet（本仓库目前没有现成的 HTTP
    路由先例，需要新加），client 显示命中列表；跳转需要把 seq 映射到已渲染的
    行——可以挂到
    消息行 slot 收集映射，或找官方「滚动到事件」API；找不到就退化成「按
    snippet 在已加载行里查找」。v2 能搜到未加载历史，但定位是最大未知。
- 快捷键：DSH 有 `dsh-client-ui-shortcuts`（可注册快捷键、键位可配）；实现前
  用 `cordis_inspect_query` 查 Client `Slots` / 快捷键服务，确认能否注册一个
  Ctrl+F 且不与浏览器原生 find 冲突。只在该区域有焦点时接管，edit 框/侧栏/
  文件编辑器聚焦时不要抢。
- 复用：归档的 `archive/dsh-sidebar-search` 已经打通了「client → Host 搜索」的
  通道（插件本体已暂停），v2 可以直接参考它的 client 代码、i18n 与错误处理；
  注意只复用实现，不要把它原来的插件补丁（覆盖别人的
  `session-query-sqlite` 行）一起搬过来。
- 入口：除了快捷键，可以再给一个「搜索本会话」按钮（侧栏/聊天头部），方便
  不知道快捷键的人。

## 待解决问题

- **定位能力（最大未知）**：DSH 有没有公开的「按 message id / event seq 滚动到
  某条消息」的 API？如果没有，seq → DOM 映射怎么做（挂消息行 slot、
  MutationObserver 收集、还是只按文本查找）以及成本。
- 未加载历史：搜索命中在已加载窗口之外时，怎么触发加载（DSH 目前只有滚动
  加载？）；加载后如何继续定位。
- 搜索范围：OpenChamber 只搜用户气泡和助手回复；DSH 是否包含推理（跟随显示
  开关）、工具结果、文件内容？先按 OpenChamber 的范围（用户消息 + 助手回复 +
  可选推理）。
- 高亮实现：CSS Custom Highlight API 在 Electron/Chromium 可用；不支持时的
  退化方案（包 span 会改 DOM，需谨慎）。
- 性能：长会话逐文本节点扫描 vs 服务端索引；流式输出/虚拟化行重挂载时的高亮
  重画开销。
- 搜索条交互细节：Enter/Shift+Enter、从最新命中还是从视口位置开始、命中在
  折叠块/工具卡片里时是否先展开。
- 是否给开关（OpenChamber 搜索是 opt-in，索引不可用时提示 Not available）；
  i18n zh/en。
- 与已归档的 `dsh-sidebar-search`（跨会话搜索）的关系：一个是全局搜索、一个是
  当前会话内查找，入口和范围要区分清楚，避免用户混淆。

## 实现记录

- 2026-11-15 —— 创建。
