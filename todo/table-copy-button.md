---
title: 表格上加一个复制按钮，只复制这张表格
status: backlog
created: 2026-11-15
last_reviewed: 2026-11-15
owner: 我
related: []
---

# 表格上加一个复制按钮，只复制这张表格

## 想法

对话里渲染出来的 Markdown 表格，在表格上方/角落加一个复制按钮。点一下只把
**这张表格**复制走（默认 Markdown 文本），不复制整条消息、也不带走表格周围的
解释文字；复制后按钮短暂变成对勾表示成功。这样把表格粘到文档、Issue 或
Excel 里时是干净的表格。

## 为什么重要

- 表格是最常被拿出去复用的内容，但现在要复制只能手工选中整条消息再删掉
  周围文字，或者对着表格重新敲一遍。
- 「只复制表格」能避免把 AI 的解释性段落一起带走。

## 参考实现（OpenChamber，只读参考）

- `openchamber/packages/ui/src/components/chat/markdown/MarkdownTable.tsx`
  —— 表格上方右对齐的工具条 `[data-streamdown="table-controls"]`，包含：
  - 换行开关；
  - **复制下拉**：CSV / TSV / Markdown 三种格式；
  - 下载下拉：CSV / Markdown（本次不要求，可后置）；
  - 复制成功后图标从 `file-copy` 变成 `check`，2 秒后恢复。
- 序列化直接从渲染后的 DOM 读 rows/cells：Markdown 格式转义 `|` 和 `\`，
  链接还原成 `[label](url)`，表头补 `---` 分隔行；CSV/TSV 用 streamdown 的
  `tableDataToCSV` / `tableDataToTSV`。粗体/斜体等行内样式不会被保留（单元格
  按纯文本复制），链接会保留。
- 文案：`markdownRenderer.table.actions.copyTitle` = "Copy table"，成功后用
  代码块的 "Copied"；复制走 `copyTextToClipboard`，失败静默。
- 导出/预览场景（`purpose`）不显示工具条；工具条本身带 `data-export-ignore`，
  导出图片时不会被画进去。

## DSH 侧现状与接入

- DSH 目前表格没有复制按钮；助手消息的 Markdown 由 DSH 客户端渲染（运行时
  模块 `@deepseek-ai/dsh-client-ui-primitives`，插件不能 import），代码块已有
  「复制 → 已复制」按钮（`useClipboardCopy` + `copy`/`copied` 文案 + 图标
  切换），交互可以照它做。
- 关键问题：DSH 有没有公开的 Markdown 组件/表格扩展点？如果没有，插件只能
  做 **DOM 增强**：用 MutationObserver 找到助手消息里的 `table`，包一层工具条
  并注入按钮；复制时从 DOM 序列化 Markdown。好处是只依赖渲染结果、不碰 DSH
  内部；风险是流式渲染、虚拟化重挂载、重复注入和清理。
- 复制实现：`navigator.clipboard.writeText`（DSH 桌面 Electron 与 localhost
  Web 都在安全上下文里），失败时回退到隐藏 textarea + `execCommand`；成功
  切换按钮图标 2 秒，或复用 DSH 现有的 notice/toast 模式。
- 放置：表格右上角浮层（hover 显示或常显）；窄屏/触摸设备要保证可点；不要
  遮挡表头第一行。
- 复制格式：v1 只做 Markdown（「只复制表格」通常就是 Markdown 文本）；v2 再
  加 CSV/TSV（与 OpenChamber 对齐）。
- 范围：先只处理助手回复里的 Markdown 表格；用户消息里的表格、工具结果里
  渲染的表格先不做，避免误注入。
- 流式：表格还在更新时，按钮可用并复制当前渲染内容（OpenChamber 就是直接
  从 DOM 读）；要不要禁用来避免复制到半张表，可以在实现时定。

## 待解决问题

- DSH 是否有官方 Markdown/表格 slot 或组件扩展点（实现前查
  `cordis_inspect_query` 的 Client `Slots` 与 ui-primitives 文档）；没有的话，
  DOM 增强的稳定性和维护成本要接受。
- 表格识别：怎么区分「助手回复的 Markdown 表格」和工具输出/其他界面里的
  表格；用容器属性或插入点判断。
- 序列化保真度：粗体/斜体/行内代码/链接/列对齐在 Markdown 复制时怎么处理
  （OpenChamber 丢弃粗斜体、保留链接、不保留对齐）；是否要保留 `:---:`。
- 去重与生命周期：MutationObserver 对同一表格只注入一次（标记属性/WeakSet），
  卸载/重新渲染时清理，按钮不能被后续复制/导出包含。
- 移动端/触摸设备：hover 显示不适用，需要常显或长按菜单。
- 剪贴板权限与失败提示：桌面与 Web 的差异；失败时给什么反馈。
- 视觉一致性：图标、tooltip、成功态文案复用 DSH 的 i18n 与主题 token。
- 是否顺带做 CSV/TSV 与下载；先把「复制表格（Markdown）」做对。

## 实现记录

- 2026-11-15 —— 创建。
