// Static rule engine for the pre-install plugin reviewer.
// Pure functions: given an extracted source tree, produce findings + a verdict.
// It never imports, executes, or resolves anything from the reviewed package.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix, relative } from 'node:path';

export const SEVERITY_WEIGHT = { critical: 40, high: 15, medium: 5, low: 1 };
export const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];

const CODE_EXTS = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.mts', '.cts', '.tsx', '.py', '.sh', '.bash', '.ps1', '.bat', '.cmd', '.rb', '.pl']);
const DOC_EXTS = new Set(['.md', '.mdx', '.txt', '.rst']);
const CFG_EXTS = new Set(['.json', '.yml', '.yaml', '.toml', '.ini']);

const jsLike = (ext) => CODE_EXTS.has(ext);
const docLike = (ext) => DOC_EXTS.has(ext);
const cfgLike = (ext) => CFG_EXTS.has(ext);

/**
 * Each rule: id, severity, title, advice, pattern (no /g), and one of js/doc/cfg/all.
 * "all" means every text file.
 */
export const SIMPLE_RULES = [
  {
    id: 'remote-exec',
    severity: 'critical',
    title: '远程下载后直接执行',
    advice: '这是最典型的恶意安装载荷：下载脚本并管道给 shell。除非你能逐行核对远端脚本，否则不要安装。',
    scope: 'all',
    pattern: /(?:curl|wget)\b[^\n|]{0,120}\|\s*(?:sudo\s+)?(?:ba|z|fi)?sh\b/i,
  },
  {
    id: 'powershell-exec',
    severity: 'critical',
    title: 'PowerShell 下载并执行 (iwr | iex)',
    advice: 'Windows 上等价于 curl|sh 的载荷投递方式，常见于恶意 postinstall。',
    scope: 'all',
    pattern: /(?:iwr|Invoke-WebRequest|Invoke-RestMethod|curl)[^\n]{0,160}\|\s*(?:iex|Invoke-Expression)/i,
  },
  {
    id: 'certutil-download',
    severity: 'high',
    title: 'certutil 下载载荷',
    advice: 'certutil -urlcache 是被滥用的 LOLBin 下载器；正常插件不需要它。',
    scope: 'all',
    pattern: /certutil(?:\.exe)?\s+-urlcache/i,
  },
  {
    id: 'eval-call',
    severity: 'critical',
    title: '动态执行 eval()',
    advice: '插件在宿主进程内执行 eval，等于把任意字符串变成代码。常见于混淆载荷；需确认输入来源可信。',
    scope: 'js',
    pattern: /\beval\s*\(/,
  },
  {
    id: 'new-function',
    severity: 'critical',
    title: '动态构造函数 new Function()',
    advice: '与 eval 等价，常与 base64 解码组合使用。',
    scope: 'js',
    pattern: /new\s+Function\s*\(/,
  },
  {
    id: 'credential-paths',
    severity: 'critical',
    title: '访问凭据/密钥文件路径',
    advice: '插件没有正当理由读取 SSH 私钥、AWS 凭据、.npmrc、浏览器 Cookie/Login Data。安全类插件会“检查”这些路径，需人工区分读取内容还是仅判断存在性。',
    scope: 'js',
    pattern: /(?:\.ssh[\\/]|id_rsa|id_ed25519|\.aws[\\/]credentials|\.credentials\.yaml|\.npmrc|\.netrc|\bLogin Data\b|\bCookies\b|keychain)/i,
  },
  {
    id: 'crypto-miner',
    severity: 'critical',
    title: '挖矿特征',
    advice: 'stratum/xmrig 等特征与插件功能无关，基本可判定为恶意。',
    scope: 'all',
    pattern: /(?:stratum\+tcp|xmrig|coinhive|monero)/i,
  },
  {
    id: 'dsh-js-escape',
    severity: 'critical',
    title: 'DSH profile patch 中的 !!js 表达式',
    advice: 'cordis.patch.yml 里的 !!js 会在启动时被求值，等于把任意代码写进配置层。正规插件不该需要它。',
    scope: 'cfg',
    file: /cordis\.patch\.ya?ml$/i,
    pattern: /!!js/,
  },
  {
    id: 'child-process',
    severity: 'high',
    title: '调用子进程',
    advice: '插件在进程内调用 child_process，意味着它可以执行任意系统命令。确认具体命令行是否必要且受控。',
    scope: 'js',
    pattern: /\b(?:child_process|execSync|execFileSync|spawnSync)\b/,
  },
  {
    id: 'shell-true',
    severity: 'high',
    title: 'spawn/exec 使用 shell: true',
    advice: 'shell: true 会把参数拼接进命令行，参数可控时就是命令注入。',
    scope: 'js',
    pattern: /shell\s*:\s*true/,
  },
  {
    id: 'obfuscation',
    severity: 'high',
    title: '混淆/解码特征 (atob, fromCharCode, \\xNN)',
    advice: '正常业务代码很少需要运行时解码字符串再执行；结合 eval 时应视为载荷。',
    scope: 'js',
    pattern: /\b(?:atob|fromCharCode)\s*\(/,
  },
  {
    id: 'dynamic-require',
    severity: 'high',
    title: '变量路径 require()',
    advice: '动态 require 可以绕过静态审查加载任意模块/文件。',
    scope: 'js',
    pattern: /\brequire\s*\(\s*[^'"`\s)]/,
  },
  {
    id: 'vm-run',
    severity: 'high',
    title: 'vm 沙箱内执行代码',
    advice: 'vm 不是安全边界，常用于执行下载/解码后的脚本。',
    scope: 'js',
    pattern: /\bvm\.(?:runInNewContext|runInThisContext|runInContext)\s*\(/,
  },
  {
    id: 'env-secret',
    severity: 'high',
    title: '读取 API Key/Token 类环境变量',
    advice: '结合网络请求时需要看是否外发。单个出现可能是正常读取自身配置。',
    scope: 'js',
    pattern: /process\.env\.[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD)/,
  },
  {
    id: 'shell-history',
    severity: 'high',
    title: '读取 shell 历史记录',
    advice: '历史记录里常有明文密钥/命令，插件没有正当理由读取。',
    scope: 'js',
    pattern: /\.(?:bash|zsh)_history|ConsoleHost_history/i,
  },
  {
    id: 'browser-data',
    severity: 'high',
    title: '读取浏览器数据目录',
    advice: 'Chrome/Edge 的 Cookies、Login Data 是凭据窃取的标准目标。',
    scope: 'all',
    pattern: /(?:Chrome|Edge|Brave|Firefox)[^\n]{0,60}(?:User Data|Cookies|Login Data|places\.sqlite|logins\.json)/i,
  },
  {
    id: 'dsh-loader-control',
    severity: 'high',
    title: '操作 DSH 插件加载器 / 系统提示词',
    advice: '插件在运行期改写 loader、注入系统提示词或替换工具，属于提权行为，需要重点人工复核。',
    scope: 'js',
    pattern: /loader\.update\s*\(|ctx\.loader|packages\.add\s*\(|ctx\.systemPrompt/,
  },
  {
    id: 'net-raw',
    severity: 'medium',
    title: '底层网络 API',
    advice: 'net/dgram/tls 直连常见于绕过代理或 C2 通信；结合可疑主机名判断。',
    scope: 'js',
    pattern: /\b(?:net\.connect|dgram\.createSocket|tls\.connect)\b/,
  },
  {
    id: 'http-plain',
    severity: 'medium',
    title: '明文 HTTP 端点',
    advice: '非 localhost 的 http:// 会被中间人篡改，应确认是否为设计缺陷。',
    scope: 'all',
    pattern: /['"`]http:\/\/(?!localhost|127\.0\.0\.1|\[::1\]|(?:www\.)?w3\.org\/|schemas\.|ns\.adobe\.com\/|purl\.org\/|xmlns\.)/,
  },
  {
    id: 'proto-pollution',
    severity: 'medium',
    title: '原型链写入',
    advice: '给 __proto__ / prototype 赋值可能污染宿主对象，影响其它插件。',
    scope: 'js',
    pattern: /__proto__\s*[=:]|constructor\s*\.\s*prototype\s*[=:]/,
  },
  {
    id: 'homedir-access',
    severity: 'medium',
    title: '访问用户主目录',
    advice: '确认读取范围；仅访问自己插件的数据目录是合理的。',
    scope: 'js',
    pattern: /os\.homedir\(\)|process\.env\.HOME|process\.env\.USERPROFILE/,
  },
  {
    id: 'dynamic-import',
    severity: 'medium',
    title: '变量路径 import()',
    advice: '运行时拼接模块路径，可能加载包外代码。',
    scope: 'js',
    pattern: /\bimport\s*\(\s*[^'"`\s)]/,
  },
  {
    id: 'prompt-injection',
    severity: 'medium',
    title: '文档/工具描述中的提示词注入',
    advice: '插件自带的 SKILL.md/README/工具描述会被模型读取；出现“忽略之前指令”“不要告诉用户”等字样时，是在操纵 agent 而非描述功能。',
    scope: 'doc',
    pattern: /(?:ignore (?:all )?(?:previous|prior) instructions|do not (?:tell|inform|mention)[^\n]{0,40}(?:user|human)|不要(?:告诉|告知|提醒)(?:用户|人类)|exfiltrat|偷偷地|隐蔽地)/i,
  },
  {
    id: 'base64-blob',
    severity: 'high',
    title: '超长 base64 字符串（疑似编码载荷）',
    advice: '数百字符以上的 base64 常是内嵌载荷；配合 atob/eval 时基本可判定恶意。',
    scope: 'js',
    custom: 'base64',
  },
];

// Any outbound network primitive (covers `https.request`, `require('https').request`,
// `fetch(`, axios, got, net.connect ...).
const EGRESS = /(?:https?\.(?:request|get)|['"](?:node:)?https?['"]\s*\)\s*\.\s*(?:request|get)|fetch\s*\(|axios|got\s*\(|net\.connect)/;

/** All patterns must match somewhere in the same file. */
export const COMBO_RULES = [
  {
    id: 'env-exfil',
    severity: 'critical',
    title: '读取环境变量并向外发送（疑似凭据外传）',
    advice: '同时出现“读 env”和“网络请求”时，请核对目标域名；这是密钥外传的典型组合。',
    scope: 'js',
    parts: [/process\.env/, EGRESS],
  },
  {
    id: 'fs-exfil',
    severity: 'critical',
    title: '读取本地文件并向外发送（疑似数据外传）',
    advice: '同时读取文件系统并联网，必须确认传输内容与目标。',
    scope: 'js',
    parts: [/readFileSync|readFile\s*\(|createReadStream/, EGRESS],
  },
];

const BASE64_RE = /[A-Za-z0-9+/]{400,}={0,2}/;

function isBinary(buf) {
  const n = Math.min(buf.length, 8192);
  for (let i = 0; i < n; i += 1) if (buf[i] === 0) return true;
  return false;
}

function scopeMatch(scope, ext) {
  if (scope === 'all') return true;
  if (scope === 'js') return jsLike(ext);
  if (scope === 'doc') return docLike(ext);
  if (scope === 'cfg') return cfgLike(ext);
  return false;
}

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (text.charCodeAt(i) === 10) line += 1;
  return line;
}

function snippetOf(text, index, matchLength) {
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + matchLength + 60);
  return text.slice(start, end).replace(/\s+/g, ' ').trim().slice(0, 180);
}

export const TEST_DIRS = ['test', 'tests', '__tests__', 'spec', 'specs', 'fixtures', '__fixtures__', 'example', 'examples', 'benchmark', 'benchmarks'];

function walk(root, options, out, skipped) {
  const { maxFileSize = 1024 * 1024, maxFiles = 5000, includeTests = false, exclude = [] } = options;
  const skipDirs = ['node_modules', '.git', '.svn', ...(includeTests ? [] : TEST_DIRS)];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const full = join(dir, ent.name);
      const rel = relative(root, full).split('\\').join('/');
      if (exclude.some((e) => rel === e || rel.startsWith(`${e}/`) || rel.includes(e))) {
        skipped.push({ path: rel, reason: 'excluded' });
        continue;
      }
      if (ent.isSymbolicLink()) {
        skipped.push({ path: rel, reason: 'symlink' });
        continue;
      }
      if (ent.isDirectory()) {
        if (skipDirs.includes(ent.name)) {
          skipped.push({ path: rel, reason: 'skipped-dir' });
          continue;
        }
        stack.push(full);
        continue;
      }
      if (!ent.isFile()) continue;
      if (out.length >= maxFiles) return;
      let size = 0;
      try {
        size = statSync(full).size;
      } catch {
        continue;
      }
      if (size > maxFileSize) {
        skipped.push({ path: rel, reason: `too-large:${size}` });
        continue;
      }
      let buf;
      try {
        buf = readFileSync(full);
      } catch {
        continue;
      }
      if (isBinary(buf)) {
        out.push({ path: rel, size, binary: true });
        continue;
      }
      out.push({ path: rel, size, binary: false, text: buf.toString('utf8') });
    }
  }
}

export function packageChecks(pkg, findings) {
  if (!pkg) {
    findings.push({
      ruleId: 'no-package-json',
      severity: 'medium',
      title: '缺少 package.json',
      file: 'package.json',
      advice: '包结构不完整，无法核对入口、依赖与安装脚本。',
    });
    return;
  }
  const scripts = pkg.scripts || {};
  const LIFECYCLE = ['preinstall', 'install', 'postinstall', 'prepare', 'prepack', 'postpack'];
  for (const name of LIFECYCLE) {
    if (scripts[name]) {
      findings.push({
        ruleId: 'install-script',
        severity: 'critical',
        title: `安装生命周期脚本 ${name}`,
        file: 'package.json',
        snippet: `"${name}": "${String(scripts[name]).slice(0, 120)}"`,
        advice: 'npm/pnpm 安装时会在你的机器上执行它。必须逐字读懂这条命令再决定是否安装。',
      });
    }
  }
  if (!pkg.license) {
    findings.push({ ruleId: 'no-license', severity: 'low', title: '缺少 license 字段', file: 'package.json', advice: '无法判断授权与来源，降低可追溯性。' });
  }
  if (!pkg.repository && !pkg.homepage) {
    findings.push({ ruleId: 'no-repository', severity: 'low', title: '缺少代码仓库地址', file: 'package.json', advice: '无法核对源码与发布产物是否一致。' });
  }
  if (!pkg.author) {
    findings.push({ ruleId: 'no-author', severity: 'low', title: '缺少 author 字段', file: 'package.json', advice: '发布者身份不可追溯。' });
  }
  const deps = Object.keys(pkg.dependencies || {});
  if (deps.length > 25) {
    findings.push({
      ruleId: 'many-deps',
      severity: 'low',
      title: `依赖数量较多 (${deps.length})`,
      file: 'package.json',
      advice: '依赖树越大，供应链攻击面越大；建议对关键依赖单独核对。',
    });
  }
  for (const [name, spec] of Object.entries({ ...pkg.dependencies, ...pkg.optionalDependencies })) {
    if (/^(?:git|github|gitlab|bitbucket|https?|file:|link:)/i.test(String(spec))) {
      findings.push({
        ruleId: 'non-registry-dep',
        severity: 'medium',
        title: `非 registry 依赖：${name}`,
        file: 'package.json',
        snippet: `${name}: ${spec}`,
        advice: 'git/file 依赖不经过 registry 完整性校验，且可能触发 prepare 脚本。',
      });
    }
  }
}

export function scanTree(root, options = {}) {
  const files = [];
  const skipped = [];
  walk(root, options, files, skipped);

  const findings = [];
  const textFiles = files.filter((f) => !f.binary);
  const pkgFile = textFiles.find((f) => f.path === 'package.json');
  let pkg = null;
  if (pkgFile) {
    try {
      pkg = JSON.parse(pkgFile.text);
    } catch {
      findings.push({ ruleId: 'bad-package-json', severity: 'medium', title: 'package.json 无法解析', file: 'package.json', advice: '结构异常，需人工查看。' });
    }
  }
  packageChecks(pkg, findings);

  const seen = new Set();
  const push = (f) => {
    const key = `${f.ruleId}::${f.file}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push(f);
  };

  for (const file of textFiles) {
    const ext = posix.extname(file.path).toLowerCase();
    for (const rule of SIMPLE_RULES) {
      if (!scopeMatch(rule.scope, ext)) continue;
      if (rule.file && !rule.file.test(file.path)) continue;

      if (rule.custom === 'base64') {
        const m = BASE64_RE.exec(file.text);
        if (m) {
          push({
            ruleId: rule.id,
            severity: rule.severity,
            title: rule.title,
            file: file.path,
            line: lineOf(file.text, m.index),
            snippet: snippetOf(file.text, m.index, m[0].length),
            advice: rule.advice,
          });
        }
        continue;
      }

      const m = rule.pattern.exec(file.text);
      if (m) {
        push({
          ruleId: rule.id,
          severity: rule.severity,
          title: rule.title,
          file: file.path,
          line: lineOf(file.text, m.index),
          snippet: snippetOf(file.text, m.index, m[0].length),
          advice: rule.advice,
        });
      }
    }

    for (const rule of COMBO_RULES) {
      if (!scopeMatch(rule.scope, ext)) continue;
      if (!rule.parts.every((re) => re.test(file.text))) continue;
      const first = rule.parts[0].exec(file.text);
      push({
        ruleId: rule.id,
        severity: rule.severity,
        title: rule.title,
        file: file.path,
        line: first ? lineOf(file.text, first.index) : 0,
        advice: rule.advice,
      });
    }

    // minified / very long line heuristic
    const longest = file.text.split('\n').reduce((a, l) => (l.length > a ? l.length : a), 0);
    if (longest > 5000 && jsLike(ext)) {
      push({
        ruleId: 'minified',
        severity: 'low',
        title: '压缩/单行超长代码',
        file: file.path,
        snippet: `最长行 ${longest} 字符`,
        advice: '压缩代码无法逐行审查；若发布包不含原始源码，可审查性显著下降。',
      });
    }
  }

  for (const bin of files.filter((f) => f.binary)) {
    if (/\.(?:node|exe|dll|so|dylib)$/i.test(bin.path)) {
      push({
        ruleId: 'native-binary',
        severity: 'high',
        title: '包含原生二进制',
        file: bin.path,
        advice: '静态审查无法覆盖二进制行为，需走签名/来源校验。',
      });
    }
  }

  for (const s of skipped) {
    if (s.reason === 'symlink') {
      push({
        ruleId: 'symlink',
        severity: 'medium',
        title: '包含符号链接',
        file: s.path,
        advice: '符号链接可指向包外路径；解包时已跳过，不跟随。',
      });
    }
    if (s.reason === 'too-large:') {
      push({ ruleId: 'large-file', severity: 'low', title: '存在超大文件未扫描', file: s.path, advice: '超过 1MB 未做文本扫描。' });
    }
  }

  const hidden = textFiles.filter((f) => /(?:^|\/)\.env(?:\.|$)|(?:^|\/)\.npmrc$|(?:^|\/)\.netrc$/.test(f.path));
  for (const h of hidden) {
    push({ ruleId: 'secret-file', severity: 'medium', title: '包内含敏感配置文件名', file: h.path, advice: '发布包里携带 .env/.npmrc 可能泄露密钥。' });
  }

  return { files: files.map(({ text, ...rest }) => rest), findings, pkg, skipped, stats: { fileCount: files.length, textCount: textFiles.length } };
}

export function scoreFindings(findings, { strict = false } = {}) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) counts[f.severity] = (counts[f.severity] || 0) + 1;
  const penalty = findings.reduce((sum, f) => sum + (SEVERITY_WEIGHT[f.severity] || 0), 0);
  const score = Math.max(0, 100 - Math.min(100, penalty));
  let verdict = 'pass';
  if (counts.critical > 0) verdict = 'block';
  else if (counts.high > 0) verdict = strict ? 'block' : 'warn';
  else if (counts.medium > 0 || score < 85) verdict = 'warn';
  return { score, verdict, counts };
}
