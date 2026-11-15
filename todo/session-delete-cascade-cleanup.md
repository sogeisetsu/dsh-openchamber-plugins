---
title: dsh-session-delete-cascade：简化代码并级联清理会话图片
status: backlog
created: 2026-11-15
last_reviewed: 2026-11-15
owner: 我
related: []
---

# dsh-session-delete-cascade：简化代码并级联清理会话图片

## 想法

对第三方插件 `dsh-session-delete-cascade`（侧栏「删除会话」）做两步：

1. **Simplify**：行为完全不变的前提下，梳理并消掉重复、过度耦合的代码。
2. **新功能**：删除会话时，把它背后用到的图片也一并删掉——现在删会话只删
   日志目录、投影缓存、搜索索引行和工作区记账，图片字节永远留在
   `~/.dsh/attachments/v1/objects/`，没有任何 GC（本机实证：44 个对象、
   7.6 MB，其中 2 个已是删除会话留下的孤儿）。

## 为什么重要

- 插件 README 宣称「彻底清理，一处不留」，但图片不在删除范围内，宣传与实际
  不符；删了会话图片仍可被 `session/attachment` 读取（接口不校验会话存在）。
- DSH 官方把「引用感知的垃圾回收」列为推迟项、没有决定（`dsh-attachment`
  README：「附件永远不会被删除」），所以这是插件补位；不做的话磁盘只增不减。
- 插件代码是可读的 ESM（`lib/index.js` 465 行、`lib/client.js` 681 行），有几处
  明显的重复与深耦合，先简化再加功能比直接往上堆更难返工。

## 现状与实证（2026-11-15 检查）

### 插件位置与行为

- 安装副本：desktop profile 的 `<profile>/node_modules/dsh-session-delete-cascade/`
  （v1.2.1，上游 `github.com/Changqin1024/dsh-session-delete-cascade`，MIT）。
- Host 注册 `POST /api/session-delete.delete`：收集子代理血缘 → 有活动工作则
  `session/delete-active` 拒绝 → 逐个释放 live agent/关写句柄 → 删投影缓存行 →
  `rm` 日志目录 → 摘除工作区记账。子代理后代递归删，fork 保留。
- Client：`ctx.contextMenus.register` 加菜单项 → 确认弹窗（含血缘预览）→
  `fetch` 该路由 → 刷新会话投影、离开已删会话、toast。
- README「不删的东西」只提了附件请求图缓存，没提持久图片对象库。

### 图片是怎么存、怎么被引用的

- 持久对象：`<DSH_HOME>/attachments/v1/objects/<sha256前2位>/<sha256>`，
  内容寻址、按字节去重、硬链接发布、`chmod 0o400` 只读；`v1/tmp` 是暂存区。
- 会话日志（`~/.dsh/sessions/<项目>/<会话ID>/session.v4.jsonl.zstd`）只存引用，
  不存字节；引用形如
  `{"type":"image","attachment":{"attachmentId":"sha256:<hex>",...}}`。
- 通用文件是另一套：`attachments/v1/file-objects/...` + `files/.../<name>` 只读
  硬链接（本次先只处理图片，泛化与否待定）。
- 请求图缓存：`<DSH_HOME>/cache/attachments/request-images/<2hex>/<variantId>`，
  可随时清空并重新生成；`llm-deepseek/files-v3.json` 里还有一张
  attachmentId → variantId → 远端 DeepSeek Files API `file_id` 的映射（7 天过期）。
- 本机取证报告（只读，原样保留）：本机工作区的 `.investigation/` 下
  `report-attachment-code.md`、`report-deletion-code.md`、`report-forensics.md`。
- 取证要点：53 个会话日志里 72 处结构化 attachmentId 引用、覆盖 42 个对象；
  1 个对象被 2 个会话共享（说明不能按会话简单删）；2 个真孤儿对象；23 个
  归档会话的图片全部保留（归档 ≠ 删除）。日志是**多帧拼接 zstd**，
  `zlib.zstdDecompressSync` 只解第一帧，直接解会误报「0 引用」。
- 结论：删除时必须做**引用检查**——只清理「被删血缘引用、且没有任何仍存在
  会话引用」的对象；被其他会话/fork 共享的必须保留。

## 第一步：Simplify（行为不变）

### Host `lib/index.js`

- `readHeader()` 每个找不到的 id 都重新 `await sessionPersistence.list()`，而
  `delete()` 在循环里对每个 id 调它 → O(n²) 的重复列举；应一次性建
  `id → header` 映射（`listHeaders` 与它已经重复）。
- 5 处「try → catch → logger.warn(同样句式)」的样板（释放 agent 的 5 个步骤、
  关写句柄、清缓存、删日志、摘工作区记账），应抽一个 `attempt(step, fn)` /
  `warn(context, error)` 辅助，把「哪一步失败、是否致命」表达清楚。
- `releaseLive()` 同时承担「特征探测」与「策略」：对 `agents.store`、
  `sessions.store`、`sessionPersistence.tracker.writers` 的私有形状访问散落
  各处。建议把「探测/调用内部形状」集中成一小组容错访问器（一个显式的
  internals 边界），`delete()` 只读起来像策略（顺序 + 公共语义）。
- `delete()` 是 130 行、七个编号步骤串在一个方法里；建议拆成
  `collectLineage` / `assertIdle` / `resolveHeaders` / `releaseAll` /
  `clearProjectionCache` / `removeLogs` / `detachWorkspace` 这些具名步骤，
  返回结构化报告（也让新增的「清理图片」作为第八步自然插入）。
- `failed()` / `STATUS_OF` / 路由体解析基本可以不动；错误码与状态映射保持。

### Client `lib/client.js`

- `createRequestStore()` 被复用成两个 store（请求、notice），`notify()` 里又
  额外维护 `noticeSeq`，而 store 的 `set()` 自己会加 `seq` → 双序号，简化成
  一个通用 store + 一个序号来源。
- `DeleteNotice` 自己实现 4 秒 toast（样式与宿主 toast 近似）；`ConfirmModal`
  自己实现 portal/焦点陷阱/Escape/焦点回退。README 说明了「不 import Harness
  Client 包、控件内联」的原因，这一点保留；但可以把焦点管理、门面按钮、图标
  合到两个小工具里，减少重复的 class 拼接与 3 段内联 SVG 的样板。
- `deleteSession()` 把 fetch、payload 解析、错误文案、刷新投影、离开面板、toast
  揉在一个函数里；拆成 `requestDelete` / `afterDelete` 两段更清晰。
- `failureText()` 的 if 链（4 个错误码）可改成按 code 的映射表，保留「未知
  code 原样透出」的行为。
- `openSessionId()` / `leaveDeletedConversation()` 直接摸 `uiWorkspace` 的私有
  形状（`mainReference`、`selection`、`clearMain`），加 try/catch 保护；简化时
  把这类「宿主内部桥」集中到一小节并保持所有保护不变，别在重构中顺手改语义。
- 客户端 `collectDescendants()` 与 Host 的 `childrenByParent()` 是同一血缘规则
  的两份实现（预览只是 advisory，Host 才是权威）。两半模块表不同、不能共享
  模块，这条重复可以保留，但要在一处注释里锁死规则（`origin === 'subagent'`、
  fork 不算），避免两处漂移。
- `DELETE_PATH` 两半各硬编码一次——注释里已说明是故意的（共享模块要构建
  步骤），保留。

### Simplify 的验收

- 行为基线先记下来：菜单项、弹窗文案/血缘预览、toast、拒绝码
  （`session/delete-active`/`session/not-found`）、fork 保留、子代理递归、
  删除后侧栏消失、搜索索引清空、Windows 下日志目录真的消失。
- 用 README 的 5 条验证清单 + 一次真实删除（有子代理、有图片、有归档会话）
  逐条对比，整理前后结果一致才算 simplify 完成。
- 不新增依赖，不改变删除顺序、容错策略（3～6 步 fail-soft）和 UI 文案。

## 第二步：删除会话时清理图片

### 设计草稿

新增一个「附件清理」步骤，插在删日志之后、摘工作区记账前后皆可（建议在删
日志后、记账前），逻辑：

1. **删日志前先收集候选**：对血缘里每个 session，用
   `ctx.sessionPersistence.open(id, 'read')` 拿到已解码事件（不要自己解
   zstd——多帧坑），结构化遍历事件里所有 `attachmentId`（`sha256:` 开头的
   image ref；是否含 file-object 的 digest 待定），得到候选 digest 集合。
2. **删完日志后做存活检查**：对候选 digest，读所有仍存在的会话（`list()` +
   逐个 `open('read')`，含归档、含其他工作区、含 live）的事件，若没有任何
   会话引用则判为可删；任一引用即保留。
3. **删对象**：`resolveDshHome()`（`@deepseek-ai/dsh-home-paths`，不硬编码
   `~/.dsh`）→ `attachments/v1/objects/<2hex>/<digest>`；Windows 上对象被
   `chmod 0o400`，直接 unlink 可能 EPERM，需先 chmod 再删（或删失败时先
   chmod 重试）。逐对象 fail-soft，统计删除/保留/失败数量。
4. **回报**：Host 响应加 `deletedAttachments` / `keptAttachments`（保留数量或
   原因计数）；Client 的 toast 顺带说明「连带清理了 N 张图片」，确认弹窗文案
   也要改（否则用户不知道图片会被删）。
5. **不动的**：请求图缓存（可再生成，默认不删；若要删需单独决定如何把
   variantId 映射回 attachmentId——`files-v3.json` 是 llm-deepseek 的私有
   文件，不建议依赖）；远端 DeepSeek Files API 的副本（本地删了也撤不回，
   7 天自然过期）；被共享/fork 引用的对象。
6. **顺带**：可选提供「清理孤儿图片」一次性动作（实现同一套引用扫描，扫描
   全部会话 vs 全部对象），把本机已有的 2 个孤儿也回收掉；先列为可选项。

### 风险与边界

- **未发送草稿的竞态**：图片在粘贴时就已存入对象库，但只有发送后的
  `user/message` 才会在日志里留下引用。若另一会话的输入框里正粘着同一张图
  （尚未发送），它没有任何日志引用，按本算法会被删掉，发送时读图失败。概率
  极低（同图在别处已发送 + 第三方草稿未发送 + 恰好删会话），但要在实现时明确
  取舍：接受并在文档写明，或加保守策略（如跳过 mtime 新于某阈值/存在 live
  会话时跳过某些对象），不要静默忽略。
- 归档会话不是删除；只要归档会话还引用图片就不能删。删除归档会话本身也走
  同一流程。
- 引用扫描要覆盖 fork/恢复/复制出来的会话（同一对象可能被多会话共享）。
- 删除不可撤销、不进回收站；性能上「每次删除扫全部会话日志」随会话数增长，
  先按候选集合早停（只挑含候选 digest 的会话），后续可考虑在插件自己的
  storage 里维护 digest → 引用会话的轻量索引（复杂度换速度，先不做）。
- 实现要复用现有 `inject` 的 `sessionPersistence`（已注入），不需要新增 Host
  服务；不要按 `~/.dsh` 硬编码路径。

### 待解决问题

- **代码改在哪**：直接把安装副本（`node_modules`）当工作区改（快，但违反
  “真正安装”模型），还是 fork 进本仓库 `plugins/dsh-session-delete-cascade/`
  作为独立 bundle（符合本仓库约定，需要保留 MIT 署名并跟上游对比），或者去
  上游仓库提分支。倾向 fork 进本仓库再打包安装。
- 是否同时清理通用文件对象（`file-objects`/`files` 硬链接）——同一套引用
  逻辑，可一并做，也可先只做图片（用户原话是图片）。
- 是否清理 request-image 缓存，以及是否做「孤儿图片」入口。
- 未发送草稿竞态的处理策略（见上）。
- 每次删除的扫描代价与超时；删除报告要不要进响应/客户端提示。
- 测试/验证：prepare 一个含图片、含子代理、含归档共享图片的会话，删除后核对
  `attachments/v1/objects` 数量变化、共享对象仍在、日志目录已删；再验证
  失败路径（只读对象、锁占用）。

## 实现记录

- 2026-11-15 —— 创建。
