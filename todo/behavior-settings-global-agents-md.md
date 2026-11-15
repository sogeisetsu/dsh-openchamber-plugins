---
title: 设置页「行为」分区：全局 AGENTS.md 与回复风格
status: backlog
created: 2026-11-15
last_reviewed: 2026-11-15
owner: 我
related: []
---

# 设置页「行为」分区：全局 AGENTS.md 与回复风格

## 想法

模仿 OpenChamber 的 Settings → Behavior，在 DSH 的 Settings 面板里加一个
「行为」分区，点进去是一页两块内容：

1. **全局 AGENTS.md**：直接编辑 DSH 的用户级全局指令文件
   （`$DSH_HOME/AGENTS.md`，默认 `~/.dsh/AGENTS.md`）。这就是每个会话第一
   个请求都会加载的 user-global 指令链，在这里改对所有会话生效。编辑器旁
   边放一个小眼睛按钮，点一下在「纯文本编辑」和「Markdown 预览」之间切换
   —— AGENTS.md 一般是 Markdown，标题、列表、表格渲染出来才看得舒服。
2. **回复风格**：像 OpenChamber 一样给一组预制模板（简洁 / 详细 / 导师 /
   反驳 / 无废话 / 匹配我的语气 / 亲近的同事），外加「自定义」可写一段说明；
   整体带一个开关。回复风格单独存，不写进 AGENTS.md，也不改写用户的全局
   规则。

## 为什么重要

- DSH 现在没有编辑全局 AGENTS.md 的入口，想改只能离开 app、自己找文件；
  而这又是影响所有会话的那份文件。
- 回复风格属于「行为」，不是「项目规则」。OpenChamber 把它做成独立设置、
  按新会话注入，和 AGENTS.md 分开，这样换风格不会污染用户自己的全局规则。
- AGENTS.md 是 Markdown，纯 textarea 里看表格和层级很累，预览是实际使用
  频率很高的配套功能。
- 设置面板的每个分区都要中英双语文案（`zh` + `en`），这个页面也按此补齐。

## 草稿 / 待解决问题

### 参考实现（OpenChamber，只读参考）

- 页面：`openchamber/packages/ui/src/components/sections/behavior/BehaviorPage.tsx`
  —— 两个 `SettingsSection`：Global AGENTS.md 文本域 + Response style
  （开关、预设下拉、自定义说明文本域）。
- 预设文案：`openchamber/packages/ui/src/lib/responseStyle.ts` —— 7 个预设
  （`concise` / `detailed` / `mentor` / `pushback` / `noFiller` /
  `matchEnergy` / `warmPeer`）各一段英文指令，`custom` 时用用户输入。
- AGENTS.md 读写接口：`openchamber/packages/web/server/lib/opencode/routes.js`
  的 `/api/behavior/agents-md`：GET 返回 `{ content, exists, path }`；PUT 带
  `expectedContent` 做乐观并发，文件在别处被改过就返回 409，编辑器提示
  「已在外部修改，复制内容后重新打开」。
- 内容来源优先级：`behaviorPrompt.ts` —— 磁盘上的 AGENTS.md 是权威来源
  （即使是空文件），设置里持久化的副本只是文件缺失/读取失败时的兜底。
- 小眼睛预览**不是** OpenChamber 的，是这次额外要的；DSH 侧要自己实现。

### DSH 侧已知事实（检查 2026-11-15 的安装包）

- `@deepseek-ai/dsh-agent-instructions` 默认启用，加载顺序：用户全局链
  （`$DSH_HOME/AGENTS.md`，然后 `~/.agents/AGENTS.md`）→ 项目链（项目根到
  会话工作目录）。每条链 64 KiB 预算（`maxBytes`），所以页面写的内容不可能
  无限大，得有个上限。
- 它没有文件 watcher：外部编辑要等下一次成功的 `read`/`write`/`edit`、
  会话 resume 或重新进入会话才可见。**保存后 UI 要说明生效时机**，否则用户
  会以为「保存了但没生效」是 bug。
- 设置面板的导航项由 `settings.section` 贡献组成，图标走
  `settings.section.icon`（同 `id` 注册）；外壳由 `ui-settings-general`
  提供。所以「行为」应该是本插件注册的一个 `settings.section`，而不是塞进
  Plugins 页。
- 官方设置页样例：`@deepseek-ai/dsh-client-ui-settings-agent-loop` ——
  Host 半只导出空 `apply`（占一行 Loader），浏览器半做页面、通过
  `ctx.configForms` 绑自己的命名空间。可以参考它的包结构。
- 回复风格进模型有两条路，倾向 (a)：
  - (a) Host 半用 `ctx.systemPrompt.section({ name, order, text })` 注册系统
    提示词片段，text 从设置里取、每次 assemble 刷新。不写会话历史，切换风格
    后新请求立即生效。
  - (b) 像 `agent-instructions` 那样每个会话注入一条带 source 的 user
    message，可读性更直观，但会占用会话历史，重复内容也要自己做去重。
- 设置项怎么持久化：官方设置页编辑的是插件自身的 Config 命名空间，经 Host
  settings 文档存；需要确认外部 bundle 的 Config 能不能同样出现在设置文档
  里、以及 `ctx.config` 在运行时能否拿到用户改写后的值。

### 待解决问题

- **Client → Host 的读写通道**：浏览器半不能碰文件系统，全局 AGENTS.md 的
  GET/PUT 得由 Host 半提供。第三方 bundle 的 client 如何调 host 服务
  （typert / 现有 remote 机制）需要先验证，这是整件事最大的技术未知。
- `$DSH_HOME` 必须按 DSH 自己的解析方式拿（`@deepseek-ai/dsh-home-paths`），
  不要硬编码 `~/.dsh`；界面上要显示实际文件路径。
- **保存方式**：官方设置页是显式 Save（改动先草稿）。AGENTS.md 也建议显式
  Save + `expectedContent` 冲突检测，比 autosave 安全；风格设置可以跟随
  Save，或沿用 OpenChamber 的自动保存，二者择一即可，但要统一。
- **Markdown 预览的渲染来源**：插件不能 import Harness 的 client 包。要确认
  客户端有没有可以复用的渲染服务/组件；没有就只能自带一个最小渲染器（只
  开标题、列表、代码块、表格、链接等安全子集，禁止原始 HTML）。
- **不要误伤已有内容**：本机 `~/.dsh/AGENTS.md` 里已经有用户写的个人规则。
  打开即读取原文，绝不能因为文件不存在/读取失败就写入空白模板覆盖；空文件
  也要允许保存为空。
- 预览显示的是「当前草稿」还是「已保存内容」——建议草稿（所见即所改），但
  未保存时要有标记。
- 页面顺序：先 AGENTS.md 再回复风格（和 OpenChamber 一致）；「行为」放在
  设置导航的哪个位置、用什么图标，需要和现有分区（通用、模型、账号、插件）
  的视觉风格对齐。
- 规模：大概率是一个新 bundle（`dsh-behavior-settings`，Host + Client 两半
  一个包），风格预设文案直接移植 OpenChamber 的 7 段英文指令，界面文案走
  `ctx.locale` 补 `zh` + `en`。

## 实现记录

- 2026-11-15 —— 创建。
