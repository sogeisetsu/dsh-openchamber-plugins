---
title: MCP 服务器管理页（设置里的增删 / 启停 / 状态）
status: backlog
created: 2026-11-16
last_reviewed: 2026-11-16
owner: 我
related: []
---

# MCP 服务器管理页（设置里的增删 / 启停 / 状态）

## 想法

在 DSH 的设置里加一个类似 OpenChamber「Settings → MCP」的管理页：列出已配置的
MCP 服务器，支持添加（本地 stdio：命令/参数/环境变量/工作目录；远端
streamable-http：URL/请求头）、编辑、启用/禁用、删除，并显示每台服务器的连接
状态和它贡献的工具数量；保存后提示何时生效（热更新或重启）。

## 为什么重要

- DSH 已经有 `@deepseek-ai/dsh-mcp-client`，但一台服务器就是 profile / bundle
  配置里的一条 cordis row，只能手改配置再启动；普通用户根本不知道要改哪里。
- 配错时（serverName 冲突、env 缺 token、URL 写错）只能看日志，没有地方看
  「连上了没有、有几个工具」。
- 加 MCP 是给 agent 扩工具最常用的方式，管理门槛必须降下来。

## 参考实现（OpenChamber）

- `packages/docs/content/docs/mcp.mdx` + Settings → MCP 页：
  - 本地服务器：命令、参数、环境变量；
  - 远端服务器：URL、鉴权头；
  - 列表页显示启用状态、连接状态与可删除/编辑；
  - 保存后由 OpenCode 侧重新连接。

## DSH 现状与难点

- `dsh-mcp-client` 每台服务器一条配置（`serverName` / `transport` /
  `command|url` / `args` / `env` / `headers` / 超时与重连策略），启动时连接并
  把工具注册成 `mcp__<serverName>__<tool>`；同一注册作用域内 serverName 重复会
  在加载时报错。
- **没有公开的运行时注册/编辑 API**：`apply` 时预留 serverName、启动监督器，
  配置来自 cordis row，不是用户可在设置里改的 settings 命名空间。
- 仓库规则也明确不能手写 profile 的 `cordis.patch.yml` / `package.json`，因此
  不能简单地「在设置页里改产物文件」。

### 三条可行路线

| 路线 | 做法 | 优点 | 代价 |
|---|---|---|---|
| **A. 伴生 MCP 插件（推荐）** | 插件自带一份 `mcp.json`（plugin-data 或 profile 目录），host 启动时读取并自行连接 MCP（复用官方 SDK / `createMcpToolDefinition`），把工具注册到 `ctx.tools`；设置页只编辑 `mcp.json` | 可热更新、可显示状态、能热重连；不碰 profile 产物 | 要自己实现连接/重连/工具注册/图片投影，工作量大；等于和 `dsh-mcp-client` 功能重叠 |
| B. 配置生成器 | 设置页只生成一段 cordis 配置，用户复制到 profile 后重启 | 实现最简单、完全走官方配置 | 体验差、违反「不要手写 profile 配置」的约定；无法显示运行状态 |
| C. 上游功能 | 让 DSH 官方提供 MCP 设置页 / 运行时配置 seam | 最干净、维护成本最低 | 不在本仓库控制范围内，需要等/提 issue |

- 路线 A 的可参考实现：`dsh-agent-enhancer`（本机已装，MIT）的
  `lib/client/mcp-connectors/`、`lib/host/mcp-connectors/` 已经做过「左侧栏
  连接器 + `mcp.json` + 安装/删除 + runtime」这套；可以提取它的连接与 UI 模式，
  但按本仓库规矩重写成独立插件、不 import Harness client 包。
- 安全：
  - stdio MCP 服务器 = 在本机执行任意命令；添加/启用必须走 `install-review`
    的审查思路（来源、命令、权限），不能一键静默执行；
  - `env` / `headers` 里常有 token：不能明文写进会提交的文件，要支持
    `process.env` 引用或 DSH 的凭据机制；
  - 远端 URL 要不要限制协议/内网地址（SSRF 面）也要定。

## 待解决问题

- 走 A 还是先推动 C：A 的维护成本不低（连接、重连、工具生命周期、图片、
  权限），如果 DSH 官方愿意做设置页，直接提 issue 更划算。
- 若走 A：`mcp.json` 放哪（plugin-data vs profile 数据目录）、格式是否兼容
  常见 MCP 客户端（`mcpServers` 形态）、如何与官方 `dsh-mcp-client` 的配置
  共存（只读展示 vs 接管）。
- 状态如何到 UI：host 侧连接状态/工具数需要一条 host → client 的通道
  （插件事件、轮询或 HTTP 路由），先确认 DSH 给插件的能力。
- 敏感值存储：env/header token 的引用与展示（掩码）、是否复用 DSH 凭据服务。
- 生效语义：保存后热重连，还是提示重启；失败时的回滚与错误展示。
- 是否支持 OAuth（远端 MCP 的常见形态）；第一版只做无鉴权/静态 header。
- 和 OpenChamber 的差异：OpenChamber 的 MCP 管理由 OpenCode 侧执行，DSH 的
  MCP 客户端在 harness 进程内，生命周期和状态语义不同，不能照搬。

## 实现记录

- 2026-11-16 —— 创建（方案阶段，尚未实现）。
