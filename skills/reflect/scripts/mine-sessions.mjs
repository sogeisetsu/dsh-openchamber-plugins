#!/usr/bin/env node
/**
 * mine-sessions.mjs — read DeepSeek Harness session archives for the reflect skill.
 *
 * DSH stores one archive per session:
 *   <dshHome>/sessions/<workspace-slug>/<session-id>/session.v4.jsonl.zstd
 * Each file is a series of checksummed Zstandard frames; one JSON event per
 * line. Node's zstdDecompressSync only decodes the first frame, so this script
 * splits on the frame magic and decodes every frame.
 *
 * Read-only. No dependency outside Node's standard library (Node 18+ for zstd).
 *
 * Commands
 *   list [--last N] [--workspace auto|<substr>] [--json]
 *   show --session <id> [--max-text N] [--json]
 *   summary [--last N] [--workspace auto|<substr>] [--root <dshHome>] [--cache <dir>] [--json]
 *
 * Exit codes: 0 ok, 2 bad arguments, 3 no session archives found.
 */
import { readdirSync, readFileSync, statSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';

const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
const SESSIONS_ROOT = path.join(DSH_HOME, 'sessions');
const CACHE_ROOT = path.join(DSH_HOME, 'reflect-cache');
const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);

function fail(code, message) {
  process.stderr.write(`[reflect] ${message}\n`);
  process.exit(code);
}

function say(line) {
  process.stderr.write(`[reflect] ${line}\n`);
}

/** Decode every zstd frame in the archive and return one utf8 string. */
function decompressFrames(buf) {
  const starts = [];
  let i = buf.indexOf(MAGIC, 0);
  while (i !== -1) {
    starts.push(i);
    i = buf.indexOf(MAGIC, i + MAGIC.length);
  }
  if (starts.length === 0) return { text: buf.toString('utf8'), frames: 0, failed: 0 };
  starts.push(buf.length);
  const parts = [];
  let failed = 0;
  for (let k = 0; k < starts.length - 1; k += 1) {
    const chunk = buf.subarray(starts[k], starts[k + 1]);
    try {
      parts.push(zlib.zstdDecompressSync(chunk).toString('utf8'));
    } catch {
      failed += 1;
    }
  }
  return { text: parts.join(''), frames: starts.length - 1, failed };
}

function sessionDirs(rootOverride) {
  const root = rootOverride ? path.join(rootOverride, 'sessions') : SESSIONS_ROOT;
  if (!existsSync(root)) return [];
  const out = [];
  for (const ws of readdirSync(root, { withFileTypes: true })) {
    if (!ws.isDirectory()) continue;
    const wsDir = path.join(root, ws.name);
    for (const s of readdirSync(wsDir, { withFileTypes: true })) {
      if (!s.isDirectory()) continue;
      const dir = path.join(wsDir, s.name);
      const file = path.join(dir, 'session.v4.jsonl.zstd');
      if (!existsSync(file)) continue;
      out.push({ workspace: ws.name, id: s.name, dir, file });
    }
  }
  return out;
}

function readEvents(file) {
  const raw = readFileSync(file);
  const { text, frames, failed } = decompressFrames(raw);
  const events = [];
  let badLines = 0;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch {
      badLines += 1;
    }
  }
  return { events, frames, failed, badLines, bytes: raw.length };
}

function textOf(content) {
  if (!Array.isArray(content)) return '';
  return content
    .filter((c) => c && c.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text)
    .join('\n');
}

function clip(text, max) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

/** Reduce a session's event stream to a compact, comparable record. */
function summarise(file, maxText = 600) {
  const st = statSync(file);
  const { events, frames, failed, badLines, bytes } = readEvents(file);
  const header = events.find((e) => e?.type === 'session') ?? {};
  const user = [];
  const assistant = [];
  const tools = new Map();
  const toolErrors = [];
  const models = new Set();
  let turns = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  let lastTime = header.time ?? null;
  let firstTime = header.time ?? null;

  for (const e of events) {
    if (typeof e?.time === 'number') {
      if (lastTime == null || e.time > lastTime) lastTime = e.time;
      if (firstTime == null || e.time < firstTime) firstTime = e.time;
    }
    switch (e?.type) {
      case 'turn/start':
        turns += 1;
        break;
      case 'user/message':
        if (e.data?.content) user.push(clip(textOf(e.data.content), maxText));
        break;
      case 'assistant/message': {
        const msg = e.data?.message;
        const text = clip(textOf(msg?.content), maxText);
        if (text) assistant.push(text);
        const model = msg?.source?.model;
        if (model) models.add(model);
        const u = e.data?.usage;
        if (u) {
          tokensIn += Number(u.inputTokens) || 0;
          tokensOut += Number(u.outputTokens) || 0;
        }
        break;
      }
      case 'tool/call': {
        const name = e.data?.name ?? '(unnamed)';
        tools.set(name, (tools.get(name) ?? 0) + 1);
        break;
      }
      case 'tool/result': {
        if (e.data?.message?.isError || e.data?.error) {
          const msg = clip(textOf(e.data?.message?.content) || String(e.data?.error), 240);
          toolErrors.push({ name: e.data?.message?.toolCallId ?? '?', error: msg });
        }
        break;
      }
      default:
        break;
    }
  }

  const toolCounts = [...tools.entries()].sort((a, b) => b[1] - a[1]);
  return {
    workspace: path.basename(path.dirname(path.dirname(file))),
    id: path.basename(path.dirname(file)),
    cwd: header.cwd ?? null,
    parentSession: header.parentSession ?? null,
    delegationDepth: header.delegationDepth ?? 0,
    startedAt: firstTime ? new Date(firstTime).toISOString() : null,
    durationMinutes: firstTime && lastTime ? Math.round((lastTime - firstTime) / 60000) : null,
    turns,
    tokens: { in: tokensIn, out: tokensOut },
    models: [...models],
    tools: toolCounts.slice(0, 12),
    toolErrors: toolErrors.slice(0, 8),
    bytes,
    frames,
    framesFailed: failed,
    badLines,
    // cache validity: a session that keeps growing must invalidate its summary
    sourceBytes: st.size,
    sourceMtimeMs: st.mtimeMs,
    userGoal: user[0] ?? null,
    userMessages: user.length,
    assistantMessages: assistant.length,
    lastAssistantText: assistant.at(-1) ?? null,
  };
}

function parseArgs(argv) {
  const first = argv[0];
  const hasCommand = typeof first === 'string' && !first.startsWith('-');
  const opts = {
    command: hasCommand ? first : 'summary',
    last: 20,
    workspace: 'auto',
    maxText: 600,
    json: false,
  };
  for (let i = hasCommand ? 1 : 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--last') { opts.last = Number(argv[++i]); }
    else if (a === '--workspace') { opts.workspace = argv[++i]; }
    else if (a === '--session') { opts.session = argv[++i]; }
    else if (a === '--since') { opts.since = argv[++i]; }
    else if (a === '--max-text') { opts.maxText = Number(argv[++i]); }
    else if (a === '--root') { opts.root = argv[++i]; }
    else if (a === '--cache') { opts.cache = argv[++i]; }
    else if (a === '--json') { opts.json = true; }
    else if (a === '--help' || a === '-h') { opts.help = true; }
    else fail(2, `unknown argument: ${a}`);
  }
  return opts;
}

function filterSessions(list, workspace) {
  if (workspace === 'all') return list;
  if (workspace === 'auto') return list; // header cwd is matched after summarising
  return list.filter((s) => s.workspace.includes(workspace));
}

const HELP = `mine-sessions — read DeepSeek Harness session archives (read-only)

Commands
  list                 one line per session archive (no decompression of content)
  show                 summary of one session (--session <id>)
  summary              per-session summaries for the most recent sessions

Options
  --last <n>           how many recent sessions (default 20)
  --workspace <s>      filter by workspace slug substring, "auto" (cwd match), or "all"
  --session <id>       session id or directory name (show)
  --max-text <n>       clip each user/assistant message to n chars (default 600)
  --root <dir>         DSH home to read instead of $DSH_HOME / ~/.dsh
  --cache <dir>        write/read per-session summary cache (default <dshHome>/reflect-cache)
  --json               machine-readable output on stdout
`;

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write(HELP);
    return;
  }
  const sessions = sessionDirs(opts.root);
  const sessionsRoot = opts.root ? path.join(opts.root, 'sessions') : SESSIONS_ROOT;
  if (!sessions.length) fail(3, `no session archives under ${sessionsRoot}`);

  if (opts.command === 'list') {
    const rows = sessions
      .map((s) => ({ s, m: statSync(s.file).mtimeMs }))
      .filter(({ s }) => opts.workspace === 'auto' || opts.workspace === 'all' || s.workspace.includes(opts.workspace))
      .sort((a, b) => b.m - a.m)
      .slice(0, opts.last)
      .map(({ s, m }) => ({
        workspace: s.workspace,
        id: s.id,
        modifiedAt: new Date(m).toISOString(),
        bytes: statSync(s.file).size,
      }));
    if (opts.json) process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
    else for (const r of rows) process.stdout.write(`${r.modifiedAt}  ${r.id}  ${r.workspace}  ${r.bytes}B\n`);
    return;
  }

  if (opts.command === 'show') {
    if (!opts.session) fail(2, 'show needs --session <id>');
    const hit = sessions.find((s) => s.id === opts.session || s.id === `session-${opts.session}`);
    if (!hit) fail(3, `session not found: ${opts.session}`);
    const rec = summarise(hit.file, opts.maxText);
    process.stdout.write(`${JSON.stringify(rec, null, 2)}\n`);
    return;
  }

  // summary
  const cwd = process.cwd();
  const candidates = filterSessions(
    sessions.map((s) => ({ s, m: statSync(s.file).mtimeMs })).sort((a, b) => b.m - a.m).map((x) => x.s),
    opts.workspace,
  );
  const cacheDir = opts.cache ?? (opts.root ? path.join(opts.root, 'reflect-cache') : CACHE_ROOT);
  mkdirSync(cacheDir, { recursive: true });
  const out = [];
  let skipped = 0;
  for (const s of candidates) {
    if (out.length >= opts.last) break;
    const cacheFile = path.join(cacheDir, `${s.id}.json`);
    let rec;
    const st = statSync(s.file);
    if (existsSync(cacheFile)) {
      try {
        const cached = JSON.parse(readFileSync(cacheFile, 'utf8'));
        // A resumed session appends events, so a hit is only valid while the
        // archive still has the size/mtime the summary was built from.
        if (cached.sourceBytes === st.size && cached.sourceMtimeMs === st.mtimeMs) {
          rec = cached;
        }
      } catch {
        rec = undefined;
      }
    }
    if (!rec) {
      try {
        rec = summarise(s.file, opts.maxText);
        writeFileSync(cacheFile, JSON.stringify(rec, null, 2));
      } catch (error) {
        skipped += 1;
        say(`skipped ${s.id}: ${error.message}`);
        continue;
      }
    }
    if (opts.workspace === 'auto' && (!rec.cwd || path.resolve(rec.cwd) !== path.resolve(cwd))) {
      // default scope: this workspace only (subagent sessions carry the same cwd)
      continue;
    }
    if (opts.since) {
      const floor = Date.parse(opts.since);
      if (Number.isFinite(floor)) {
        const at = Date.parse(rec.startedAt ?? '');
        if (Number.isFinite(at) && at < floor) continue;
      } else {
        fail(2, `--since must be a parseable date (got "${opts.since}"), e.g. --since 2026-11-01`);
      }
    }
    out.push(rec);
  }
  const payload = { cwd, scanned: out.length, skipped, sessions: out };
  if (opts.json) process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  else {
    say(`workspace ${cwd} — ${out.length} session(s), skipped ${skipped}`);
    for (const r of out) {
      process.stdout.write(`\n## ${r.startedAt ?? '?'} · ${r.id}\n`);
      process.stdout.write(`goal: ${r.userGoal ?? '(none)'}\n`);
      process.stdout.write(`turns=${r.turns} tools=${r.tools.map(([n, c]) => `${n}:${c}`).join(',') || '-'} errors=${r.toolErrors.length} models=${r.models.join(',') || '-'}\n`);
    }
  }
}

main();
