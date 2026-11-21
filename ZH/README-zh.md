# dsh-openchamber-plugins

[English](../README.md) | 中文

🚧 **开发进行中。** 本仓库把 [OpenChamber](https://github.com/openchamber/openchamber)
（面向 OpenCode 的桌面 / 网页工作区）里的实用功能，以及其他 agent 生态里精选的
技能，移植到 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)，
让 DSH 用户获得 DSH 本身没有提供的便利。

这里的一切都还不稳定：API、布局和插件名都可能变化。

中文文档：就是本文件。英文 `AGENTS.md` 的中文翻译 `ZH/AGENTS-zh.md` 只在本地维护，
不提交到仓库。

## 插件

| 插件 | 功能 | 状态 |
| --- | --- | --- |
| [`dsh-files-show-hidden`](../plugins/dsh-files-show-hidden) | 在右侧栏文件页的头部加一个眼睛开关；通过驱动文件浏览器自己的隐藏项设置来显示或隐藏以点开头的文件和文件夹，偏好仍由文件浏览器自己保存。 | 已交付 —— 打包安装 |
| [`dsh-summary-command`](../plugins/dsh-summary-command) | 在输入框的斜杠菜单里加一行本地化的 `/summary [topic]`（图标、`总结` / `Summary`、说明文字），让当前会话产出一份非破坏性、可直接交接的摘要，且不动用户正在写的草稿；提示词移植自 OpenChamber 的 `/summary` magic prompt。 | 已交付 —— 打包安装 |

## 暂停的工作

[`dsh-sidebar-search`](../archive/dsh-sidebar-search) 已于 2026 年 11 月暂停，不再
安装。它的源码保留在 [`archive/`](../archive/) 下，同目录还有一份
[复盘报告](../archive/dsh-sidebar-search/POSTMORTEM.md)，记录导致暂停的宿主服务
故障以及安全重启的规则。想法记录见
[`todo/sidebar-search.md`](../todo/sidebar-search.md)。

## 技能

用户级技能放在 [`skills/`](../skills/)：每个技能一个目录，目录里是 `SKILL.md`
（需要时带零依赖的 Node 脚本）。把目录复制到 `<dshHome>/skills/` 即可安装；
DSH 会自动发现变化，无需重启。

项目级技能放在 [`.dsh/skills/`](../.dsh/skills/)：随仓库一起提交，在 rank 100
被发现，因此不需要安装步骤。[`zh-doc-sync`](../.dsh/skills/zh-doc-sync) 负责让
`ZH/` 里的中文文档与英文源保持一致。

| 技能 | 功能 | 来源 |
| --- | --- | --- |
| [`reflect`](../skills/reflect) | 复盘最近的工作，找出重复摩擦，提出最小可复用资产 —— 一条 `AGENTS.md` 规则、一个技能、一个插件设置、一个定时任务，或者什么都不做。 | OMO Slim 的 `reflect`，已做 DSH 适配 |
| [`grilling`](../skills/grilling) | 用设计树式追问压力测试一个计划或决定：frontier 轮次、`❓ / ➡️` 格式，事实由子代理去查。 | Matt Pocock 的 `grilling`，近乎逐字移植 |
| [`install-review`](../skills/install-review) | 安装前只读审查技能、DSH 插件、npm 包、tarball 或 GitHub 仓库，最终给出 `PASS` / `WARN` / `BLOCK`。 | `skill-vetter`（A 轨）与自建插件审查（B 轨）合并 |
| [`init`](../skills/init) | 扫描仓库，用已核实的命令、架构与约定创建或改进项目根目录的 `AGENTS.md`；不碰全局指令文件。 | OpenCode `/init` 行为，DSH 原生实现 |

## 参考笔记

[`docs/dsh-slash-menu-rows.md`](../docs/dsh-slash-menu-rows.md)——第三方命令怎么
在输入框的 `/` 菜单里拿到一行「看起来像官方」的呈现：为什么 Host 的
`CommandDefinition` 带不了 label 和图标、`commandUi` 贡献行与自建
`inputTriggers` 源的区别、分组顺序和无标题分组的手法，以及两种路线各自的代价。

## 安装

需要 DSH `>= 0.2.2-rc.1`。

每个插件都是独立的 DSH bundle。通过插件管理器（或 `plugin_manager` 的
`install_bundle`）从打包产物安装：在插件目录里执行 `pnpm pack`，然后安装生成的
tarball。

> **开发期间**，插件通过把工作目录 link 进 DSH profile 来安装（`link:` 依赖加
> 目录 junction），改动会立即生效。这只是开发期的便利方式。完成的功能必须作为
> 真正的包安装 —— 见 [AGENTS.md](../AGENTS.md)（*安装模型*）。

两个需要注意的行为：

- `client.js` 的改动在页面/窗口重载后生效；Host 改动（`index.js`）或
  `cordis.patch.yml` 改动需要重启 DSH，因为 bundle patch 在启动时组装。
- bundle patch 会在每次安装、移除、启用、停用时重新组装。不要把「覆盖别的
  bundle 的行」这种部署级配置写进插件补丁 —— 写进 profile 自己的 patch 层。
  已归档的 [`dsh-sidebar-search`](../archive/dsh-sidebar-search) 展示了这种耦合
  能破坏什么。

## 目录结构

```
.dsh/skills/
  zh-doc-sync/          # keep ZH/ translations in sync with English docs
todo/                   # idea backlog; see todo/README.md
docs/                   # reference notes on DSH internals
plugins/
  dsh-files-show-hidden/ # files-page hidden-entry toggle (client half, host stub)
  dsh-summary-command/  # /summary slash-menu row (client half, host stub)
archive/
  dsh-sidebar-search/   # paused sidebar search; source + postmortem
skills/
  reflect/              # review repeated work → smallest reusable asset
  grilling/             # design-tree interview for plans and decisions
  install-review/       # pre-install review of skills, plugins, npm packages
  init/                 # initialize project AGENTS.md (/init)
ZH/                     # Chinese docs; README-zh.md is committed, AGENTS-zh.md is local-only
```

`openchamber/` 是移植时使用的只读参考 checkout，已被 git 忽略，不属于本仓库。

## 致谢

- `/summary` 的提示词来自 OpenChamber 的 `packages/ui/src/lib/magicPrompts.ts`
  （`session.summary.*`），MIT 许可。
- `grilling` 改编自 [Matt Pocock 的 skills](https://github.com/mattpocock/skills)，MIT 许可。
- `reflect` 改编自 [OMO Slim](https://github.com/alvinunreal/oh-my-opencode-slim)，MIT 许可。
- `install-review` 合并了第三方 `skill-vetter` 技能与自建的插件审查流程；来源与
  许可说明见 [`skills/README.md`](../skills/README.md)。
- `init` 移植了 OpenCode `/init` 命令的行为（[Rules → Initialize](https://opencode.ai/docs/rules#initialize)），MIT 许可；未复制上游提示词文本。
- 已归档的侧栏搜索，其行为与命令面板形态参考了 dsh-claude-style 的侧栏搜索和
  OpenChamber 的搜索界面。

## 许可

MIT —— 见 [LICENSE](../LICENSE)。
