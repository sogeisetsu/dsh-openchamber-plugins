#!/usr/bin/env node
/**
 * zh-doc-sync checker.
 *
 * Compares each English/Chinese documentation pair's *structure*:
 *   - heading levels (order and count),
 *   - fenced code blocks (language and content),
 *   - Markdown tables (count and column counts),
 *   - link targets (normalized).
 *
 * It never checks translation quality — only that the Chinese side still has
 * the same skeleton as the English source. Exit codes: 0 clean (link warnings
 * allowed), 1 missing files or structural drift (or link drift with --strict).
 *
 * Zero dependencies, Node >= 22.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(scriptDir, '..', '..', '..', '..');

const PAIRS = [
  { name: 'README', source: 'README.md', translation: 'ZH/README-zh.md' },
  { name: 'AGENTS', source: 'AGENTS.md', translation: 'ZH/AGENTS-zh.md' },
];

function parseArgs(argv) {
  const args = { root: defaultRoot, json: false, strict: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--json') args.json = true;
    else if (value === '--strict') args.strict = true;
    else if (value === '--help' || value === '-h') args.help = true;
    else if (value === '--root') {
      index += 1;
      if (index >= argv.length) throw new Error('--root requires a path');
      args.root = resolve(String(argv[index]));
    } else throw new Error(`unknown argument: ${value}`);
  }
  return args;
}

function splitRow(line) {
  let text = line.trim();
  if (text.startsWith('|')) text = text.slice(1);
  if (text.endsWith('|')) text = text.slice(0, -1);
  const cells = [];
  let current = '';
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '\\' && text[index + 1] === '|') {
      current += '|';
      index += 1;
    } else if (char === '|') {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function isTableSeparator(line) {
  const text = line.trim();
  if (!text.includes('|') || !text.includes('-')) return false;
  return /^[|\s:-]+$/.test(text);
}

function normalizeTarget(raw) {
  let target = raw.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return target; // external URL / mailto
  target = target.split('#')[0].split('?')[0];
  while (target.startsWith('../')) target = target.slice(3);
  while (target.startsWith('./')) target = target.slice(2);
  target = target.replace(/\/+$/, '');
  if (/^(?:ZH\/)?README(?:-zh)?\.md$/i.test(target)) target = 'README.md';
  if (/^(?:ZH\/)?AGENTS(?:-zh)?\.md$/i.test(target)) target = 'AGENTS.md';
  return target;
}

function parseMarkdown(text) {
  const lines = text.split(/\r?\n/);
  const headings = [];
  const fences = [];
  const tables = [];
  const links = [];
  let fence = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fenceMatch = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
    if (fenceMatch) {
      if (fence === null) {
        fence = { lang: fenceMatch[2].trim(), startLine: index + 1, body: [] };
      } else {
        fences.push({ lang: fence.lang, content: fence.body.join('\n'), line: fence.startLine });
        fence = null;
      }
      continue;
    }
    if (fence !== null) {
      fence.body.push(line);
      continue;
    }

    const headingMatch = /^(#{1,6})\s+\S/.exec(line);
    if (headingMatch) {
      headings.push({ level: headingMatch[1].length, line: index + 1 });
      continue;
    }

    if (line.includes('|') && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      const columns = splitRow(line).length;
      let end = index + 1;
      while (end < lines.length && lines[end].trim() !== '' && lines[end].includes('|')) end += 1;
      tables.push({ columns, line: index + 1 });
      index = end - 1;
      continue;
    }

    for (const match of line.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      links.push({ target: normalizeTarget(match[1]), line: index + 1 });
    }
  }

  return { headings, fences, tables, links };
}

const readDocument = (root, relative) => {
  const path = join(root, relative);
  if (!existsSync(path)) return { path, missing: true, text: '' };
  return { path, missing: false, text: readFileSync(path, 'utf8') };
};

const compareHeadingLevels = (source, translation) => {
  const problems = [];
  if (source.length !== translation.length) {
    problems.push(
      `heading count differs: source ${source.length}, translation ${translation.length}`,
    );
  }
  const shared = Math.min(source.length, translation.length);
  for (let index = 0; index < shared; index += 1) {
    if (source[index].level !== translation[index].level) {
      problems.push(
        `heading #${index + 1} level differs: source h${source[index].level} (line ${source[index].line}), translation h${translation[index].level} (line ${translation[index].line})`,
      );
      break;
    }
  }
  return problems;
};

const compareFences = (source, translation) => {
  const problems = [];
  if (source.length !== translation.length) {
    problems.push(`fenced code block count differs: source ${source.length}, translation ${translation.length}`);
  }
  const shared = Math.min(source.length, translation.length);
  for (let index = 0; index < shared; index += 1) {
    if (source[index].lang !== translation[index].lang) {
      problems.push(
        `code block #${index + 1} language differs: source "${source[index].lang}" (line ${source[index].line}), translation "${translation[index].lang}" (line ${translation[index].line})`,
      );
      break;
    }
    if (source[index].content !== translation[index].content) {
      problems.push(
        `code block #${index + 1} content differs (source line ${source[index].line}, translation line ${translation[index].line})`,
      );
      break;
    }
  }
  return problems;
};

const compareTables = (source, translation) => {
  const problems = [];
  if (source.length !== translation.length) {
    problems.push(`table count differs: source ${source.length}, translation ${translation.length}`);
  }
  const shared = Math.min(source.length, translation.length);
  for (let index = 0; index < shared; index += 1) {
    if (source[index].columns !== translation[index].columns) {
      problems.push(
        `table #${index + 1} column count differs: source ${source[index].columns} (line ${source[index].line}), translation ${translation[index].columns} (line ${translation[index].line})`,
      );
      break;
    }
  }
  return problems;
};

const multiset = (items) => {
  const counts = new Map();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return counts;
};

const compareLinks = (source, translation) => {
  const warnings = [];
  const sourceCounts = multiset(source.map((link) => link.target));
  const translationCounts = multiset(translation.map((link) => link.target));
  const targets = new Set([...sourceCounts.keys(), ...translationCounts.keys()]);
  for (const target of targets) {
    const inSource = sourceCounts.get(target) ?? 0;
    const inTranslation = translationCounts.get(target) ?? 0;
    if (inSource === inTranslation) continue;
    const lineOf = (links) => links.find((link) => link.target === target)?.line ?? '?';
    warnings.push(
      `link target "${target}" appears ${inSource}× in source (line ${lineOf(source)}) and ${inTranslation}× in translation (line ${lineOf(translation)})`,
    );
  }
  return warnings;
};

function checkPair(root, pair, strict) {
  const source = readDocument(root, pair.source);
  const translation = readDocument(root, pair.translation);
  const result = { pair: pair.name, source: pair.source, translation: pair.translation, issues: [], warnings: [] };

  if (source.missing) {
    result.issues.push(`missing source file: ${pair.source}`);
    return result;
  }
  if (translation.missing) {
    result.issues.push(`missing translation: ${pair.translation}${pair.name === 'AGENTS' ? ' (local-only; translate AGENTS.md and keep it git-ignored)' : ''}`);
    return result;
  }

  const sourceDoc = parseMarkdown(source.text);
  const translationDoc = parseMarkdown(translation.text);
  result.issues.push(...compareHeadingLevels(sourceDoc.headings, translationDoc.headings));
  result.issues.push(...compareFences(sourceDoc.fences, translationDoc.fences));
  result.issues.push(...compareTables(sourceDoc.tables, translationDoc.tables));
  result.warnings.push(...compareLinks(sourceDoc.links, translationDoc.links));
  if (strict && result.warnings.length > 0) {
    result.issues.push(...result.warnings.map((warning) => `(strict) ${warning}`));
  }
  return result;
}

function printText(results) {
  let failed = false;
  for (const result of results) {
    const status = result.issues.length > 0 ? 'DRIFT' : result.warnings.length > 0 ? 'WARN' : 'OK';
    console.log(`${status} ${result.source} ↔ ${result.translation}`);
    for (const issue of result.issues) console.log(`  issue: ${issue}`);
    for (const warning of result.warnings) console.log(`  warn: ${warning}`);
    if (result.issues.length > 0) failed = true;
  }
  return failed;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(String(error.message ?? error));
    process.exitCode = 2;
    return;
  }
  if (args.help) {
    console.log('Usage: node check-sync.mjs [--root <repo>] [--json] [--strict]');
    return;
  }
  const results = PAIRS.map((pair) => checkPair(args.root, pair, args.strict));
  if (args.json) {
    console.log(JSON.stringify({ root: args.root, results }, null, 2));
  } else {
    console.log(`zh-doc-sync: ${args.root}`);
  }
  const failed = printText(results) || results.some((result) => result.issues.length > 0);
  process.exitCode = failed ? 1 : 0;
}

main();
