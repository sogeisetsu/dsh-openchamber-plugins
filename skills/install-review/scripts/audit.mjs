#!/usr/bin/env node
// Pre-install security reviewer for DSH plugins / npm packages.
//
//   node audit.mjs <spec> [--strict] [--json] [--out=<dir>] [--keep]
//
// spec:  dsh-plugin-foo | @scope/name@1.2.3 | github:owner/repo#ref | ./local-dir
//
// Downloads the tarball, verifies registry integrity, extracts it WITHOUT running
// any install script, then scans the source. Nothing from the package is executed
// or imported at any point.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { scanTree, scoreFindings, SEVERITY_ORDER, SEVERITY_WEIGHT } from './rules.mjs';
import { extractTarGz } from './tar.mjs';

const VERDICT_LABEL = { pass: 'PASS', warn: 'WARN', block: 'BLOCK' };
const MAX_BYTES = 60 * 1024 * 1024;

function usage() {
  return `用法: node audit.mjs <spec> [options]

spec
  dsh-plugin-foo                  npm 上的最新版本
  @scope/name@1.2.3               npm 上指定版本
  github:owner/repo#commit        GitHub 仓库（建议钉到 commit SHA）
  ./path/to/plugin                本地目录（已解压的源码）

options
  --strict          把 high 也判定为 BLOCK
  --json            把结构化结果打印到 stdout（不含完整报告文本）
  --include-tests   连同 test/fixtures/examples 一起扫描（默认跳过）
  --exclude=<substr> 跳过路径包含该片段的文件（可重复）

注意：临时解压目录**审查结束后必删**；报告直接输出到 stdout，不写入工作目录。
`;
}

function fetchBuffer(url, depth = 0) {
  if (depth > 5) return Promise.reject(new Error('too many redirects'));
  return new Promise((resolvePromise, reject) => {
    const req = https.get(url, { timeout: 60000, headers: { 'user-agent': 'dsh-plugin-security-review' } }, (res) => {
      const { statusCode = 0, headers } = res;
      if (statusCode >= 300 && statusCode < 400 && headers.location) {
        res.resume();
        resolvePromise(fetchBuffer(new URL(headers.location, url).toString(), depth + 1));
        return;
      }
      if (statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${statusCode} for ${url}`));
        return;
      }
      const chunks = [];
      let total = 0;
      res.on('data', (c) => {
        total += c.length;
        if (total > MAX_BYTES) {
          res.destroy();
          reject(new Error(`response larger than ${MAX_BYTES} bytes`));
          return;
        }
        chunks.push(c);
      });
      res.on('end', () => resolvePromise(Buffer.concat(chunks)));
    });
    req.on('timeout', () => req.destroy(new Error(`timeout for ${url}`)));
    req.on('error', reject);
  });
}

async function fetchJson(url) {
  const buf = await fetchBuffer(url);
  return JSON.parse(buf.toString('utf8'));
}

function splitNpmSpec(spec) {
  let name = spec;
  let version = null;
  if (spec.startsWith('@')) {
    const slash = spec.indexOf('/');
    if (slash === -1) throw new Error(`无效的 scoped 包名: ${spec}`);
    const at = spec.indexOf('@', slash);
    if (at !== -1) {
      name = spec.slice(0, at);
      version = spec.slice(at + 1);
    }
  } else {
    const at = spec.indexOf('@');
    if (at > 0) {
      name = spec.slice(0, at);
      version = spec.slice(at + 1);
    }
  }
  return { name, version };
}

function verifyIntegrity(buf, dist) {
  const checks = [];
  if (dist?.integrity && String(dist.integrity).includes('-')) {
    const idx = dist.integrity.indexOf('-');
    const algo = dist.integrity.slice(0, idx);
    const expected = dist.integrity.slice(idx + 1);
    const actual = createHash(algo).update(buf).digest('base64');
    checks.push({ kind: `${algo} (registry integrity)`, ok: actual === expected, expected, actual });
  }
  if (dist?.shasum) {
    const actual = createHash('sha1').update(buf).digest('hex');
    checks.push({ kind: 'sha1 (dist.shasum)', ok: actual === dist.shasum, expected: dist.shasum, actual });
  }
  return checks;
}

async function resolveTarget(spec) {
  if (existsSync(spec) && statSync(spec).isDirectory()) {
    return { kind: 'local', dir: resolve(spec), name: basename(resolve(spec)), version: 'local', integrity: [], meta: null };
  }
  const gh = /^(?:github:)?([\w.-]+)\/([\w.-]+?)(?:#(.+))?$/.exec(spec);
  if (gh && !spec.startsWith('@') && (spec.startsWith('github:') || /^https?:\/\/github\.com\//.test(spec))) {
    const [, owner, repo, ref] = gh;
    const url = `https://codeload.github.com/${owner}/${repo}/tar.gz/${ref || 'HEAD'}`;
    const buf = await fetchBuffer(url);
    const dir = extractTarball(buf);
    return {
      kind: 'github',
      dir,
      name: `${owner}/${repo}`,
      version: ref || 'HEAD',
      source: url,
      integrity: [],
      meta: { repository: `https://github.com/${owner}/${repo}` },
    };
  }

  const { name, version } = splitNpmSpec(spec);
  const metaUrl = `https://registry.npmjs.org/${encodeURIComponent(name)}/${version || 'latest'}`;
  const meta = await fetchJson(metaUrl);
  const tarball = meta.dist?.tarball;
  if (!tarball) throw new Error(`registry 未返回 tarball: ${name}`);
  const buf = await fetchBuffer(tarball);
  const integrity = verifyIntegrity(buf, meta.dist);
  const dir = extractTarball(buf);
  return { kind: 'npm', dir, name: meta.name || name, version: meta.version || version || 'latest', source: tarball, integrity, meta };
}

function extractTarball(buf) {
  const root = mkdtempSync(join(tmpdir(), 'dsh-plugin-review-'));
  const dest = join(root, 'src');
  mkdirSync(dest, { recursive: true });
  const { entries, skipped } = extractTarGz(buf, dest, { strip: 1 });
  // Return root so the entire temp directory (root + src) can be cleaned up
  return root;
}

function renderMarkdown(result) {
  const { target, findings, score, stats, pkg, skippedFiles, integrity } = result;
  const lines = [];
  const badge = VERDICT_LABEL[score.verdict];
  lines.push(`# 插件安全评审：${target.name}@${target.version}`);
  lines.push('');
  lines.push(`- **结论：${badge}**  (评分 ${score.score}/100，critical ${score.counts.critical} / high ${score.counts.high} / medium ${score.counts.medium} / low ${score.counts.low})`);
  lines.push(`- 来源：${target.source || target.dir}`);
  lines.push(`- 类型：${target.kind}`);
  lines.push(`- 扫描文件：${stats.fileCount}（文本 ${stats.textCount}）`);
  lines.push('- 扫描范围：默认跳过 test/fixtures/examples（`--include-tests` 可纳入）；不执行任何包内代码');
  lines.push(`- 生成时间：${new Date().toISOString()}`);
  lines.push('');
  lines.push('> 本报告由静态审查生成：下载解包后**未执行任何安装脚本或包内代码**。静态规则只能发现信号，不能证明安全，结论仍需人工复核入口文件。');
  lines.push('');

  if (integrity?.length) {
    lines.push('## 完整性校验');
    lines.push('');
    lines.push('| 校验 | 结果 |');
    lines.push('| --- | --- |');
    for (const c of integrity) lines.push(`| ${c.kind} | ${c.ok ? '✅ 通过' : '❌ 不匹配'} |`);
    lines.push('');
    if (integrity.some((c) => !c.ok)) {
      lines.push('**⚠️ 完整性不匹配意味着下载到的 tarball 与 registry 记录不一致，可能被篡改或镜像污染，应视为 BLOCK。**');
      lines.push('');
    }
  }

  if (pkg) {
    lines.push('## 包元数据');
    lines.push('');
    lines.push('| 字段 | 值 |');
    lines.push('| --- | --- |');
    const cell = (v) => String(v ?? '—').replace(/\|/g, '\\|').slice(0, 120);
    lines.push(`| name | ${cell(pkg.name)} |`);
    lines.push(`| version | ${cell(pkg.version)} |`);
    lines.push(`| license | ${cell(pkg.license)} |`);
    lines.push(`| author | ${cell(typeof pkg.author === 'object' ? pkg.author?.name : pkg.author)} |`);
    lines.push(`| repository | ${cell(typeof pkg.repository === 'object' ? pkg.repository?.url : pkg.repository)} |`);
    lines.push(`| dependencies | ${cell(Object.keys(pkg.dependencies || {}).length)} |`);
    const scripts = Object.entries(pkg.scripts || {});
    lines.push(`| scripts | ${cell(scripts.map(([k, v]) => `${k}=${v}`).join('; '))} |`);
    if (pkg.dsh) lines.push(`| dsh | ${cell(JSON.stringify(pkg.dsh))} |`);
    lines.push('');
  }

  lines.push('## 发现');
  lines.push('');
  if (!findings.length) {
    lines.push('未命中任何规则。');
    lines.push('');
  }
  for (const severity of SEVERITY_ORDER) {
    const group = findings.filter((f) => f.severity === severity);
    if (!group.length) continue;
    lines.push(`### ${severity.toUpperCase()} (${group.length})`);
    lines.push('');
    for (const f of group) {
      const loc = f.line ? `${f.file}:${f.line}` : f.file;
      lines.push(`- **${f.title}** — \`${loc}\``);
      if (f.snippet) lines.push(`  - 证据：\`${String(f.snippet).replace(/`/g, "'").slice(0, 200)}\``);
      if (f.advice) lines.push(`  - 解读：${f.advice}`);
    }
    lines.push('');
  }

  const notable = (result.files || []).filter((f) => /(?:^|\/)(?:index|main|lib\/index|dist\/index)\.(?:js|mjs|cjs|ts)$/.test(f.path)).slice(0, 8);
  if (notable.length) {
    lines.push('## 建议人工通读的入口文件');
    lines.push('');
    for (const f of notable) lines.push(`- ${f.path} (${f.size} bytes)`);
    lines.push('');
  }

  if (skippedFiles?.length) {
    lines.push('## 未扫描/已跳过');
    lines.push('');
    for (const s of skippedFiles.slice(0, 20)) lines.push(`- ${s.path}: ${s.reason}`);
    lines.push('');
  }

  lines.push('## 下一步');
  lines.push('');
  if (score.verdict === 'block') {
    lines.push('1. 不要安装。若确实需要，先在隔离环境（虚拟机/容器）里跑，并逐条解释每个 critical 发现。');
    lines.push('2. 若宿主命令是 `dsh plugin add`，改为手工下载 tarball 审查后再考虑 `--ignore-scripts` 安装。');
  } else if (score.verdict === 'warn') {
    lines.push('1. 逐个确认 high/medium 发现是否与插件声明的功能一致。');
    lines.push('2. 安装时禁止安装脚本：`dsh plugin --profile <name> add <pkg> --ignore-scripts`。');
    lines.push('3. 安装后检查它在 profile 里实际挂载了什么（cordis.patch.yml / bundle 层）。');
  } else {
    lines.push('1. 静态检查未发现明显问题，但仍建议通读入口文件确认行为与描述一致。');
    lines.push('2. 安装时加 `--ignore-scripts` 更稳妥。');
  }
  lines.push('');
  return lines.join('\n');
}

function printSummary(result) {
  const { target, score, findings } = result;
  process.stdout.write(`\n目标: ${target.name}@${target.version}  (${target.kind})\n`);
  for (const c of result.integrity || []) process.stdout.write(`完整性: ${c.kind} ${c.ok ? 'OK' : 'MISMATCH'}\n`);
  const badge = VERDICT_LABEL[score.verdict];
  process.stdout.write(`结论: ${badge}  评分 ${score.score}/100  critical=${score.counts.critical} high=${score.counts.high} medium=${score.counts.medium} low=${score.counts.low}\n`);
  const top = findings
    .slice()
    .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
    .slice(0, 10);
  for (const f of top) process.stdout.write(`  [${f.severity.toUpperCase()}] ${f.title} — ${f.file}${f.line ? `:${f.line}` : ''}\n`);
  if (findings.length > top.length) process.stdout.write(`  ... 另有 ${findings.length - top.length} 条，见报告\n`);
  process.stdout.write(`报告: ${result.reportPath}\n\n`);
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      options: {
        strict: { type: 'boolean', default: false },
        json: { type: 'boolean', default: false },
        'include-tests': { type: 'boolean', default: false },
        exclude: { type: 'string', multiple: true, default: [] },
        help: { type: 'boolean', short: 'h', default: false },
      },
    });
  } catch (err) {
    process.stderr.write(`${err.message}\n\n${usage()}`);
    process.exit(64);
  }
  const { values, positionals } = parsed;
  if (values.help || positionals.length === 0) {
    process.stdout.write(usage());
    process.exit(values.help ? 0 : 64);
  }

  const spec = positionals[0];
  const target = await resolveTarget(spec);
  // Scan the package root. For npm/GitHub targets `dir` is a temp extraction;
  // for a local directory it is the user's own directory and must be read-only.
  const scanDir = target.dir;
  const scan = scanTree(scanDir, { includeTests: values['include-tests'], exclude: values.exclude || [] });
  const score = scoreFindings(scan.findings, { strict: values.strict });

  const result = {
    target,
    score,
    findings: scan.findings,
    files: scan.files,
    stats: scan.stats,
    pkg: scan.pkg,
    skippedFiles: scan.skipped,
    integrity: target.integrity,
  };

  // 审查结束后删除临时目录；本地目录是用户的，绝不删除。
  if (target.kind !== 'local') {
    rmSync(target.dir, { recursive: true, force: true });
  }

  const markdownReport = renderMarkdown(result);

  if (values.json) {
    process.stdout.write(JSON.stringify({ target, score, findings: scan.findings }, null, 2));
  } else {
    // 完整报告直接输出到 stdout（对话里）
    process.stdout.write(markdownReport);
    process.stdout.write('\n');
  }

  process.exit(score.verdict === 'block' ? 2 : score.verdict === 'warn' ? 1 : 0);
}

main().catch((err) => {
  process.stderr.write(`审查失败: ${err.message}\n`);
  process.exit(70);
});
