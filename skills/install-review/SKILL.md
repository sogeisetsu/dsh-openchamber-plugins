---
name: install-review
description: 安装前审查：装任何第三方 skill、DSH 插件、npm 包或 tarball 之前，先查来源、读全部文件、跑静态扫描，人工复核后给出 PASS / WARN / BLOCK 结论与安装建议。Use before installing or adding any skill/plugin/npm package, when the user asks “这个安全吗 / 能装吗 / 帮我审一下 / 这个包可靠吗”, when given a package name, GitHub repo, tarball or local plugin directory to review, or before calling plugin_manager install_bundle. 全程只读：绝不 import、绝不执行包内脚本。
---

# Install Review（安装前审查）

一个入口，两类目标：**skill** 与 **DSH 插件 / npm 包**。先分类，再走对应轨道，最后用同一个结论格式回答。

## 什么时候用

- 用户要装/加 skill、插件、npm 包；问“这个安全吗/能装吗/可靠吗”；丢来包名、GitHub 仓库、tarball、本地插件目录。
- 你自己即将调用 `plugin_manager install_bundle` 或 `dsh plugin add` 之前。

不适用：审 DSH 自身源码、审已在运行的可疑进程、审普通业务依赖（用 `npm audit` / `osv-scanner`）。

## 核心原则

1. **先审后装**，审查与安装严格分离；审查只读。
2. **静态扫描只产证据，结论由你人工复核后给出**；复核（含误报判断）在内部完成，最终回答只给结论和安装建议。
3. **插件/skill 都是进程内/提示层代码**：装上就等于把当前权限或模型行为交给它；DSH 沙箱只约束模型发起的工具调用，不约束插件自己。
4. **第三方“安全插件”本身也是第三方代码**：默认用本技能的一次性离线审查，不要先装一个审查插件。
5. 安装脚本会进待批准列表（`pendingBuilds`），批准前不要勾选。

## 第一步：分类目标

| 目标形态 | 走哪条轨道 |
|---|---|
| 一个 skill 目录 / SKILL.md / GitHub 上的 skills 仓库 | **A. Skill 审查** |
| DSH 插件、npm 包（含 scoped）、tarball、GitHub 仓库、已解压插件目录 | **B. 插件 / npm 审查** |

判不准就问一句，或按更严格的那条走。

## 轨道 A：Skill 审查

### A1 来源检查
来源（官方市场 / GitHub / 转贴）、作者是否已知、下载量/星数、最后更新、是否有第三方评审。

### A2 通读全部文件（强制）
不要只看 SKILL.md：`scripts/`、`references/`、`assets/` 全读。search 关键字：`curl|wget|http|fetch|exec|eval|child_process|base64|token|key|password|\.ssh|\.aws|\.env|cookies|hooks|!!js`。

### A3 权限范围
需要读哪些文件、写哪些、执行哪些命令、是否联网、联网到哪、是否与声明用途匹配。

### A4 分级与结论
见下方“风险分级”。

## 轨道 B：插件 / npm 包审查

### B1 取包并静态扫描（不执行任何脚本）

```powershell
pwsh -File scripts/review.ps1 dsh-plugin-foo
pwsh -File scripts/review.ps1 @scope/name@1.2.3
pwsh -File scripts/review.ps1 github:owner/repo#<sha>
pwsh -File scripts/review.ps1 ./some-plugin
```

脚本行为：从 registry/codeload 下载 tarball（**仅 npm/GitHub 模式下载到临时目录并删除**）或就地读取本地目录（**本地目录只读，绝不删除**）→ 校验 `dist.integrity`(sha512) / `dist.shasum`(sha1) → 扫描包根目录（自动跳过 `node_modules` / `.git` / 测试夹具）→ 报告打到 stdout。

开关：`--strict`（high 也 BLOCK）、`--json`、`--include-tests`、`--exclude=<片段>`。

### B2 人工复核（必须）
逐条看 CRITICAL/HIGH/MEDIUM，结合源码判断真风险还是误报（读 env 是为了组 Authorization 头、解析 `http://` 是为了 DNS 重绑定防护等）。复核只在内部进行。

### B3 DSH 特有高危点（重点看）
- `cordis.patch.yml` 里的 `!!js`：启动时求值，等于把代码写进配置层。
- `loader.update(id,{disabled})`：插件能让别的插件静默失效。
- `ctx.systemPrompt` / 工具 `description`：持续影响模型行为，比一次性代码更隐蔽。
- `dsh.client` 前端注入：能读页面会话内容，外发不受文件沙箱限制。
- 安装脚本：pnpm 生命周期在宿主机执行，`--ignore-scripts` 可关。

## 共同红旗清单（任一命中即 BLOCK，除非有明确合理解释）

- 向未知 URL `curl/wget`、把数据发到外部服务器；
- 索要凭据/token/API key；读 `~/.ssh`、`~/.aws`、`~/.config`、浏览器 cookies 而无明确理由；
- 访问 `MEMORY.md` / `USER.md` / `SOUL.md` / `IDENTITY.md` 等身份/记忆文件；
- 对任意内容 `base64` 解码；`eval()` / `exec()` 处理外部输入；
- 改工作区外系统文件；静默安装依赖（不列清单）；连 IP 而非域名；混淆/压缩/加密载荷；要 sudo/提权。

## 风险分级

| 级别 | 例子 | 动作 |
|---|---|---|
| 🟢 LOW | 笔记、格式化、天气 | 基础审查，可装 |
| 🟡 MEDIUM | 文件操作、浏览器、API | 必须通读全部文件 |
| 🔴 HIGH | 凭据、交易、系统、进程内插件 | 需用户明确批准 |
| ⛔ EXTREME | 安全配置、root/提权、无法解释的混淆 | 不装 |

## 输出格式（统一用这个）

```
## 结论：<PASS / WARN / BLOCK>
<一句话理由。PASS 说明未发现真实风险信号；WARN/BLOCK 只列真实风险点（文件:行 + 一句话影响），不列误报、不复述扫描器命中清单。>

## 安装建议
<装 / 不装 / 隔离环境验证 + 命令>
```

## 信任层级（收紧审查力度的顺序）

1. 官方 DSH 内置 / 官方清单 → 降低但仍审
2. 官方 DSH 生态插件（`@deepseek-ai/*`）→ 中等
3. 高星仓库（1000+）或已知作者 → 中等
4. 新/未知来源 → 最大审查
5. 索要凭据 / 注入提示层 / 装完即生效 → 一律要用户明确批准

## 安装（仅用户确认后）

```powershell
& "<DSH 安装目录>\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add <spec> --ignore-scripts
```

装完通常需重启客户端；设置 → 插件可查看已装列表。

## 已知局限

1. 静态规则覆盖不了原生二进制、运行时下载的代码、高度混淆载荷；`PASS` 只表示“没扫出信号”。
2. 传递依赖只做名称/来源层面检查，不逐文件扫描。
3. 默认跳过 `test/fixtures/example`（`--include-tests` 纳入），因为安全类插件的测试夹具全是恶意样本。
4. 安全/审计类插件天然命中凭据路径与子进程规则，这是能力而非漏洞；判断为正常能力即可，不必写进最终回答（除非改变结论）。
5. 报告只输出到 stdout，不在工作目录生成文件。
