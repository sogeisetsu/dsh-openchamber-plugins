---
title: 侧栏搜索（dsh-sidebar-search）：暂停，待按解耦方案重启
status: blocked
created: 2026-11-21
last_reviewed: 2026-11-21
owner: 我
related:
  - archive/dsh-sidebar-search/
  - todo/in-conversation-find.md
---

# 侧栏搜索（dsh-sidebar-search）：暂停，待按解耦方案重启

## 想法

在 DSH Web UI 侧栏底部、Settings 旁加一个搜索按钮，打开命令面板，按**消息
内容**、会话标题、项目名搜索，并提供「新建会话 / 设置 / 插件」快捷操作。结果
分组、可筛选（全部 / 会话 / 项目 / 操作）、键盘可操作（↑↓、Enter、Esc），样式
只用 `--dsw-alias-*` 主题 token。

这个功能原本已实现为插件 `plugins/dsh-sidebar-search/`，2026-11-21 暂停开发，
源码移到 [`archive/dsh-sidebar-search/`](../archive/dsh-sidebar-search/README.md)
保留。

## 为什么重要

- 会话多了以后，靠翻侧栏列表找旧对话很慢；按消息正文搜索能直接找回「上次那个
  结论 / 那个报错」。
- 一个入口同时覆盖会话、项目和常用操作，比在多个面板之间切换快。
- 它验证过的「client → Host 搜索」通道对
  [`todo/in-conversation-find.md`](in-conversation-find.md)（会话内 Ctrl+F）也有
  复用价值。

## 为什么暂停（问题与结论）

完整分析见
[`archive/dsh-sidebar-search/POSTMORTEM.md`](../archive/dsh-sidebar-search/POSTMORTEM.md)，
这里只记结论：

| 项 | 内容 |
| --- | --- |
| 表现 | 历史会话打不开，聊天区顶部挂红色横幅；新建会话也失败；刷新页面无效，只能整进程重启 |
| 报错 | `typert gateway: session/follow: active Service "sessionController" is unavailable（gateway/service-unavailable）` |
| 直接原因 | 插件的 `cordis.patch.yml` 覆盖了别的 bundle 的 `session-query-sqlite` 行（`openAt: first-search`）。插件每次装卸 / 启停都会让这行配置翻转，进而重载 `sessionQuery`，连带重建注入它的 `sessionController` |
| 为什么会永久坏 | 当时的 DSH `0.2.2-rc.1` 在重建路径上缺守卫和初始化等待；重建落在初始化窗口里失败后不重试，服务永久停在 not ACTIVE |
| 不是谁的问题 | 不是插件业务代码（Host 半边只有空 `apply()`）；是**部署级配置被写进了插件补丁** |
| 当时的处置 | 2026-11-16 在面板取消启用；2026-11-21 从 profile 删除依赖和残留 junction，源码归档 |

`blocked` 的含义：不是功能做不出来，而是**当前形态不能直接恢复**——必须先把
「打开会话索引」这件事从插件补丁搬到 deployment/profile 层，再在安全的环境里
重新验证。

## 重启条件与做法

1. **补丁解耦**：`cordis.patch.yml` 只 `insert` 自己的行；`session-query-sqlite`
   的覆盖写到 `~/.dsh/profiles/<profile>/cordis.patch.yml`（最后应用、不随插件
   装卸翻转）。
2. **升级 DSH**：`>= 0.2.2-rc.2`，避免重建落在初始化窗口时永久打死服务。
3. **隔离验证**：独立 `DSH_HOME` + link 进 `web` profile 起宿主，用
   `dsh-plugin-ui-preview` 截图验收；不要在日常 profile 里反复装卸。
4. **开发期关 HMR**（或接受 `restart-required`），别在正在用的会话里装卸插件。
5. **用 tarball 安装终验**，不要长期 `link:` 指向可能被删的目录。
6. **恢复顺序**：从 archive 移回 `plugins/dsh-sidebar-search/` → 确认补丁只剩
   insert → 在 profile patch 打开索引 → 安装 → 验证历史加载 / 新建会话 / 搜索
   三条路径。

## 待解决问题

- 内容搜索依赖宿主索引；索引关闭时必须明确提示「内容搜索已关闭」，不能静默
  降级（现版本已做，但要在重建后复验）。
- 搜索结果的排序、去重（内容命中 + 标题命中）、以及「还有更多匹配」的提示是否
  够用。
- 快捷操作直接调用 `uiWorkspace` / `layout` 服务，跨 DSH 版本是否稳定，需要在
  升级后重新确认 slot 与 service 名。
- 是否加全局快捷键（例如 Ctrl+K）打开搜索面板；目前只有侧栏按钮。
- 主题 token 与窄栏（56px rail）下的布局仍需视觉验收。

## 实现记录

- 2026-11-10 —— 插件 1.0.0 安装。
- 2026-11-11 —— 插件补丁加入 `session-query-sqlite` 覆盖，故障开始。
- 2026-11-12 —— 多次装卸、打包 1.1.1，故障复现。
- 2026-11-16 —— 面板取消启用。
- 2026-11-21 —— 暂停开发；从 profile 删除依赖与残留 junction；源码归档到
  `archive/dsh-sidebar-search/`，补丁改为 insert-only；补写
  `POSTMORTEM.md`。
