---
title: 折叠超长的用户消息气泡
status: backlog
created: 2026-11-15
last_reviewed: 2026-11-15
owner: 我
related: []
---

# 折叠超长的用户消息气泡

## 想法

复刻 OpenChamber 的「折叠较长的用户消息」：用户自己发出去的长文本默认只显示
两行，气泡右下角有一个小号展开/收起控件（OpenChamber 是一行小字
`Show more` / `Show less`，折叠状态下双击/点击气泡本身也能展开）。点一下展开
原文，再点一下收回，这样一条粘贴了大段日志或需求的消息不会把整个屏幕占满，
往下翻历史时也不会被自己的长气泡顶走。

## 为什么重要

- 长提示词（粘贴的报错、日志、整段需求）在会话里会占掉整屏，导致自己和助手
  的对话节奏被一个大色块打断；折叠后一眼能看完上下文的骨架。
- 折叠只在文字真的超出时出现，不影响短消息，属于纯展示层的可逆优化。
- 这是一个读取体验问题，不改变任何会话内容或发给模型的内容。

## 草稿 / 待解决问题

### 参考实现（OpenChamber，只读参考）

- 折叠本体：`openchamber/packages/ui/src/components/chat/message/parts/UserTextPart.tsx`
  —— 折叠时加 `line-clamp-2`；用 `scrollHeight > clientHeight` 判断是否真的被
  截断（`ResizeObserver` + `MutationObserver` 兜底 Markdown 渲染后的高度变化），
  只有截断时才报告给外层；折叠状态下点击气泡文字也触发展开。
- 开关与按钮：`openchamber/packages/ui/src/components/chat/message/MessageBody.tsx`
  —— 整条用户消息共享一个 `messageExpanded` 状态（多个 text part 一起折叠/
  展开），气泡底部右下角渲染唯一的 `Show more` / `Show less` 文字链，带
  `aria-expanded`；`showMessageExpandToggle` 只在「有截断 / 已展开 / 有被隐藏
  的上下文块」时出现。
- 折叠态排版：`openchamber/packages/ui/src/index.css` 的
  `[data-user-message-collapsed]` —— 折叠时把 Markdown 块间距清零、代码块
  内联化，避免两行里出现奇怪的留白。
- 设置项：`collapsibleUserMessages`（默认开），UI 在 Settings → Chat →
  Reading 区（「折叠较长的用户消息」），i18n key
  `settings.openchamber.visual.field.collapsibleUserMessages`。
- 文案：`chat.message.userText.showMore` / `showLess`。
- 测试：`openchamber/packages/ui/src/components/chat/message/MessageBody.rowExpand.test.tsx`
  —— 覆盖「默认折叠 / 展开 / 收回 / 短消息不出现控件」。
- 相关但独立：`stickyUserHeader` —— 长用户消息吸顶时最多占 40dvh 并内部滚动；
  折叠功能与它共用同一块气泡区域，移植时要一起考虑。

### DSH 侧现状与接入点（检查 2026-11-15 的安装包）

- DSH 目前**没有**用户消息折叠：Chat 的用户气泡由 `dsh-client-ui-chat` 的
  `UserStyleBubble` / `MessageItem` 渲染，会话壳在 `dsh-client-ui-conversation`。
- `conversation.chat.user.content` 是一个 Factory，渲染整个用户内容栈（文本、
  额外块、图片/文件附件、引用摘要）；官方文档明确说它**不是**全局用户内容
  覆盖入口。直接替换意味着重做文本、附件、引用的全部渲染，风险高。
- `conversation.chat.user.before` 是渲染在气泡正上方的链式 slot，可以挂控件，
  但它管不到兄弟节点（气泡本身）的样式和高度。
- 所以实现前要先确认真正的缝：有没有官方 slot 能包住/替换用户气泡的
  wrapper；没有的话，只能退到「替换 content Factory」或「DOM 增强」
  （MutationObserver 找气泡、加折叠 class、注入按钮），后者脆弱、要明确代价。
  实现前用 `cordis_inspect_query` 查 Client `Slots` / `Service`，不要凭猜。
- 折叠要按 DSH 的 Markdown 渲染处理块间距、列表、代码块、表格；否则两行里会
  出现大片留白或半个表格。
- 展开/收起会改变上方行高：DSH 有滚动跟随与自动贴底逻辑，展开一条位于阅读
  位置之上的消息要避免把读者顶走；OpenChamber 用 `dispatchRowExpand` 释放
  跟随，DSH 需要有等价处理。
- 如果做设置开关：DSH 可用 `settings.general.item` 在「通用」加一行（主题行
  就是这么挂的），默认开；也可以先不做开关、长消息自动折叠。

### 待解决问题

- **入口方式**（最大未知）：官方 slot / 替换 content Factory / DOM 增强，三选
  一；影响整个插件的稳定性和升级兼容性。
- **折叠行数**：OpenChamber 是 2 行；DSH 用户气泡的行高和宽度不同，要视觉上
  定几行合适（2 行或 3 行），并保证「短消息不出现控件」。
- **按钮形态**：OpenChamber 是右下角小字链 + 可点气泡；用户说的是「小按钮」，
  两者可以统一成文字链（更轻、和气泡里的时间/复制操作同层级），也可做成图标
  按钮，需定一个。
- 展开状态是仅组件内存态，还是按消息 id 记住（切走再回来是否保持）？建议先
  内存态，和 OpenChamber 一致。
- 展开/收起要不要动画；DSH 的行折叠有动画节奏，先不做动画，避免和滚动跟随
  打架。
- 是否需要处理「流式发送中」的消息（刚发出、还没结束的状态）——OpenChamber
  在刚发送的消息挂载时用一帧延迟重测高度，DSH 要确认自己的时序。
- 移植时的测试：至少覆盖短消息无控件、长消息折叠、展开回到原文、折叠后再
  编辑/复制不受影响。

## 实现记录

- 2026-11-15 —— 创建。
