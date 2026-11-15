---
title: 粘贴大段文字自动转成文件附件
status: backlog
created: 2026-11-15
last_reviewed: 2026-11-16
owner: 我
related: []
---

# 粘贴大段文字自动转成文件附件

## 想法

复刻 OpenChamber 的「大段文字粘贴」处理：粘贴的纯文本超过阈值（约 2000
字符或 25 行）时，不把整段文字塞进输入框，而是按设置处理：

- **每次询问**（默认）：输入框上方浮出一个小选择条，让你选「附加为文件」或
  「直接粘贴」；
- **附加为文件**：直接生成 `pasted-context-N.txt`（text/plain），作为附件挂到
  草稿上，输入框里只留一个引用 chip；
- **直接粘贴**：行为和现在一样；
- **直接粘贴，粘贴两次以附加文件**：先正常内联，1 秒内再按一次 Ctrl/Cmd+V
  粘贴同一段文字，就把第一次插入的那段转成文件 + 引用。

这样输入框保持整洁，也不会出现一条占满屏幕的用户长消息。

## 为什么重要

- 大段粘贴（日志、报错、整篇文档）会让输入框变成一大坨，发送后又变成巨大的
  用户气泡；折叠长消息只能治「展示」，这里治的是「入口」。
- 作为文件附件后，agent 可以按需读取，比把几千字直接顶在 prompt 里更可控。
- 阈值、行为都可配置，短文本、图片、URL 换行不受影响。

## 参考实现（OpenChamber，只读参考）

- 检测与手势：`openchamber/packages/ui/src/components/chat/composer/largeTextPaste.ts`
  —— `LARGE_TEXT_PASTE_CHAR_THRESHOLD = 2000`、
  `LARGE_TEXT_PASTE_LINE_THRESHOLD = 25`（OR 关系，空白文本永不算大）、
  `DOUBLE_PASTE_WINDOW_MS = 1000`，以及 `LargeTextPasteGesture`（双击粘贴手势
  状态机）。
- 选择浮层：`.../composer/largeTextPasteOffer.ts` + `.../ui/LargeTextPasteChoice.tsx`
  —— 浮在输入框起始边上、样式像划词菜单；桌面端取得焦点且默认选中「附加为
  文件」，Enter 选当前项、方向键/Tab 切换、Esc 直接内联、打字会直接内联并
  继续输入；每个回答都把焦点还给编辑器。
- 接线：`ChatInput.tsx` 的 paste 处理（`largeTextPasteBehavior` 分支、构造
  `pasted-context-N.txt`、走正常附件管线和引用 chip）。
- 实现说明：`.../composer/DOCUMENTATION.md`（大段文字粘贴一节）。
- 设置：`largeTextPasteBehavior`，枚举
  `ask | attach | inline | inline-double-paste`，默认 `ask`；文案在
  `zh-CN.settings.ts` / `en.settings.ts`
  （`settings.openchamber.visual.field.largeTextPaste*`、
  `chat.chatInput.largeTextPaste.*`）。
- 细节：
  - 「附加为文件」生成的是内存里的 `File`（text/plain），插入一个 `[name]`
    引用，再走和手动选择 `.txt` 相同的附件管线。
  - 双击转文件只替换第一次插入的区间；候选 1000ms 过期；按键重复、非修饰键、
    编辑、选区移动、失焦、草稿/模式/设置/运行时变化、卸载都会让手势失效；
    菜单粘贴和触摸粘贴不参与。
  - 转换在附件成功前保留内联文本，替换前会复查实时草稿、选区和草稿作用域；
    附件失败就保留文本。
  - 如果转换正在进行时用户又编辑了，已接收的文件会留在草稿里，但新的文本不会
    被替换。

## DSH 侧接入与待解决

- DSH composer 是 Lexical 编辑器，插件不能直接替换它内部的粘贴路径。可行路线：
  - 客户端插件在 composer DOM 上监听 `paste`（捕获阶段）判断文本大小，必要时
    `preventDefault` 自己插入——agent-enhancer 已有在 composer DOM 上挂监听
    的先例，但依赖 DOM 结构（`[data-composer-card]` / `[data-composer-input]`），
    需要确认是否稳定。
  - 写回草稿用 composer slot 提供的 `inputActions`（`insertText`/`setDraft`），
    附件走 DSH 的附件上传通道（`dsh-client-file-upload` + 附件服务）；须确认
    通用文本文件的上传/落盘 API（DSH 的图片有 `saveImages`，通用文件是
    `saveFile`/`saveFileStream`，客户端能否直接调用要查）。
  - 另一个选择：作为 DSH 上游功能（改 composer 源码）而不是插件，但要跟着
    DSH 版本走；本仓库约定是插件优先。
- 需要确认：插件能否在 Lexical 插入前拦到 paste；文本文件落盘后是否生成引用
  chip、agent 能否按路径读取；虚拟文件（内存 File）在 DSH 是否支持。
- 设置放哪：可挂 `settings.section`（和「行为设置」todo 的接法一致）或
  `settings.general.item` 一行；阈值是否可配（OpenChamber 固定 2000/25）。
- 先做 `ask` + `attach` + `inline` 三种；`inline-double-paste` 依赖键盘粘贴
  识别，作为第二阶段。
- 与「折叠长消息」todo 互补：那个管展示，这个管入口；一起做体验最完整。

## 实现记录

- 2026-11-15 —— 创建。
- 2026-11-16 —— 复核：本条已覆盖「大段文本粘贴处理」需求（阈值、四种行为、
  文件协议、OpenChamber 参考都在这），无需再建重复条目；按新加的查重规则
  只更新 `last_reviewed`。
