#!/usr/bin/env node
// List the plugin bundles of this repository with the identity fields a naming
// audit needs: directory, package name, version, English locale title, and the
// candidate search terms derived from them.
//
// Zero dependencies, Node >= 22.
//
// Usage (from the repository root):
//   node .dsh/skills/plugin-name-audit/scripts/list-bundles.mjs [repoRoot]
//        [--json] [--include-archive]
//
// Exit codes: 0 = at least one bundle listed, 1 = wrong root / nothing to list.
// It reads files only; it never touches the network or writes anything.

import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const FLAGS = new Set(['--json', '--include-archive']);
const args = process.argv.slice(2).filter(Boolean);
const unknown = args.filter((arg) => arg.startsWith('--') && !FLAGS.has(arg));
if (unknown.length) {
  console.error(`unknown option: ${unknown.join(', ')}`);
  process.exit(1);
}
const flags = new Set(args.filter((arg) => FLAGS.has(arg)));
const positional = args.filter((arg) => !arg.startsWith('--'));
const root = path.resolve(positional[0] ?? process.cwd());

if (!existsSync(root)) {
  console.error(`repository root not found: ${root}`);
  process.exit(1);
}
const roots = ['plugins', ...(flags.has('--include-archive') ? ['archive'] : [])];

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

function firstString(value, keys) {
  if (!value || typeof value !== 'object') return null;
  for (const key of keys) {
    const hit = value[key];
    if (typeof hit === 'string' && hit.trim()) return hit.trim();
  }
  for (const child of Object.values(value)) {
    const hit = firstString(child, keys);
    if (hit) return hit;
  }
  return null;
}

async function readLocaleTitle(dirPath) {
  for (const file of ['en.json', 'en-US.json', 'en_US.json']) {
    const json = await readJson(path.join(dirPath, 'locale', file));
    if (json) return firstString(json, ['title', 'name', 'label']);
  }
  return null;
}

async function readReadmeTitle(dirPath) {
  try {
    const text = await readFile(path.join(dirPath, 'README.md'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^#\s+(.+?)\s*$/);
      if (match) return match[1];
    }
  } catch {
    // No README is fine; the title is optional.
  }
  return null;
}

function searchTerms(name, title) {
  const terms = [];
  const add = (term) => {
    const clean = String(term ?? '').replace(/\s+/g, ' ').trim();
    if (clean && !terms.some((existing) => existing.toLowerCase() === clean.toLowerCase())) {
      terms.push(clean);
    }
  };
  const bare = String(name ?? '').replace(/^@[^/]+\//, '');
  add(bare);
  const stem = bare.replace(/^dsh-/, '');
  add(stem);
  add(stem.split(/[-_.\s]+/).filter(Boolean).join(' '));
  add(title);
  return terms;
}

async function listBundles() {
  const bundles = [];
  for (const rootName of roots) {
    const rootPath = path.join(root, rootName);
    if (!existsSync(rootPath)) continue;
    const entries = await readdir(rootPath, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory()) continue;
      const dirPath = path.join(rootPath, entry.name);
      const pkg = await readJson(path.join(dirPath, 'package.json'));
      if (!pkg || typeof pkg.name !== 'string' || !pkg.name.trim()) {
        console.error(`skip ${rootName}/${entry.name}: no readable package.json name`);
        continue;
      }
      const title = (await readLocaleTitle(dirPath)) ?? (await readReadmeTitle(dirPath));
      bundles.push({
        dir: `${rootName}/${entry.name}`,
        name: pkg.name,
        version: typeof pkg.version === 'string' ? pkg.version : '',
        description: typeof pkg.description === 'string' ? pkg.description : '',
        title: title ?? '',
        terms: searchTerms(pkg.name, title),
      });
    }
  }
  return bundles;
}

const bundles = await listBundles();
if (!bundles.length) {
  const where = roots.map((name) => `${name}/`).join(', ');
  console.error(`no bundles found under ${where} in ${root}`);
  process.exit(1);
}

if (flags.has('--json')) {
  console.log(JSON.stringify({ root, bundles }, null, 2));
} else {
  console.log(`Bundles under ${root} (${bundles.length})\n`);
  console.log('| Directory | Package name | Version | Locale title (en) | Candidate search terms |');
  console.log('| --- | --- | --- | --- | --- |');
  for (const bundle of bundles) {
    const title = bundle.title.replace(/\|/g, '\\|');
    const terms = bundle.terms.map((term) => `\`${term}\``).join(', ');
    console.log(`| ${bundle.dir} | \`${bundle.name}\` | ${bundle.version} | ${title} | ${terms} |`);
  }
  console.log('');
  console.log(
    'Next: probe these terms in the sources listed in SKILL.md step 3, judge the hits in step 4, and report in step 5.',
  );
}
