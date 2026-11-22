---
name: plugin-name-audit
description: Audit the names of the plugin bundles developed in this repository (plugins/* and archive/*) against the plugin bundles that are popular in the agent ecosystem right now — DSH, OpenChamber/OpenCode, OMO Slim, the Claude Code plugin markets, npm and GitHub — and report exact-name collisions, confusing look-alikes, concept-only overlaps, and names that are safe to keep. Use before naming a new bundle, before renaming one, when asked 插件重名 / 名字冲突 / 和社区插件重名吗 / 这个插件名字能用吗 / plugin name collision, or as a full-set check before a release.
---

# plugin-name-audit

This repository ships DSH plugins under `plugins/`, one independent bundle per
feature. A bundle's name travels: the `package.json` `name`, the
`plugins/<dir>` directory, the locale title users read in the Plugin Manager,
and the copy other people put into their own profiles. The agent-plugin
ecosystem already has popular bundles for most ideas, so a name that looks fine
in isolation is often already taken.

This skill makes the collision check repeatable: enumerate the local bundles,
turn each identity into search terms, query the ecosystem, judge the hits, and
report. It is read-only — it proposes renames, it never performs them.

## When to use

- Before a new bundle under `plugins/` gets its `name` and directory.
- Before renaming an existing bundle, or when a name was picked informally and
  nobody checked it.
- When asked 插件重名 / 名字冲突 / 和社区插件重名吗 / 这个插件名字能用吗 /
  plugin name collision.
- As a full-set check — audit every bundle at once — before a release or when
  the plugin set has grown by two or three entries.
- After a rename, to confirm the new name is actually clear.

Do not use it for: choosing a publish scope (a registry decision), checking
trademark rights, or auditing skill names — skills are not installed as plugins.

## Workflow

### 1. List what this repository ships

From the repository root:

```sh
node .dsh/skills/plugin-name-audit/scripts/list-bundles.mjs
```

It prints every bundle under `plugins/` with its package name, version, English
locale title, and the search terms derived from them. Flags:

- `--json` — machine-readable output;
- `--include-archive` — also scan paused bundles under `archive/`;
- first positional argument — audit another checkout instead of the current one.

Exit code `1` means no bundles were found or the root is wrong, not that the
names are clean.

### 2. Turn each identity into search terms

For every bundle, search at least:

- the bare package name, e.g. `dsh-style-switcher`;
- the bare name without the project prefix, e.g. `style-switcher`;
- the feature in the words a competitor would use, e.g. `visual style switcher
  plugin`;
- the locale title, e.g. `Visual style switcher`.

The second and third terms are the ones that find collisions: a bundle named
`dsh-btw` still collides in users' heads with a community plugin called `btw`.

### 3. Search the ecosystem

Use whichever of these the session has; record which ones you used.

| Where | Why it matters | How |
| --- | --- | --- |
| npm search | published bundles, and the `@deepseek-ai/dsh-*` / `dsh-*` naming space | `npm search "<term>" --json`, or `https://registry.npmjs.org/-/v1/search?text=<url-encoded>&size=20` |
| npm exact probe | is this exact package name taken? | `npm view <name> name version` — a 404 means the name is free *today* |
| GitHub repos | the repos people actually find and star | `gh search repos "<term>" --limit 20 --json fullName,stargazersCount,description` |
| GitHub code | code that already uses the name or identifier | `gh search code "<term>" --limit 20`, or the grep.app MCP tool with a literal pattern |
| Web search | blog posts, awesome-lists, marketplaces, docs | `web_search` / `tavily_search` / `exa_search` with `"<term>" DSH plugin`, `"<term>" opencode plugin`, `"<term>" claude code plugin` |
| Curated lists | a "popular" bundle shows up here first | the OpenChamber checkout (`openchamber/`), OMO Slim (`oh-my-opencode-slim`), the DSH official plugin catalog, OpenCode and Claude Code plugin marketplaces / awesome-lists |

Start with the term most likely to collide and stop a term once a hit is
conclusive; do not run every source for every name when one source settles it.

### 4. Judge the hits

| Verdict | Looks like | Action |
| --- | --- | --- |
| Name taken | the same bare name is a published or well-known bundle in an adjacent ecosystem | **Rename.** A scope only hides it from `npm view` — users still type and search the bare name. |
| Confusing look-alike | one word added or dropped, the same word under a different scope, or the same concept plus the same word stem (`style-switcher` vs `dsh-style-switcher`) | **Rename**, unless the two cannot plausibly be confused; when in doubt, rename. |
| Concept overlap only | a different name solves the same problem | **Keep.** Say so in the plugin `README.md` ("not the same as X") so users searching for X are not misled. |
| No hit found | nothing relevant turns up | **Keep**, but record the terms and the date; no hit is not proof of uniqueness. |

Judgement rules:

- A popular bundle owns the word, not the scope: `dsh-<popular-word>` is still a
  look-alike.
- Generic feature words (`summary`, `search`, `theme`, `paste`, `btw`) are the
  most contested; a name built only from them is a warning sign.
- Prefer `dsh-<specific-feature>`: it matches the existing bundles in this
  repository and is specific enough to stay distinct from a community bundle
  that solves the same problem.
- Judge the *displayed* name too, not just the package name — that is what users
  copy into a search box.

### 5. Report

One table, one row per bundle, worst first:

| Bundle | Package name | Hit (URL) | Verdict | Suggestion |
| --- | --- | --- | --- | --- |

Then state explicitly:

- what was searched — sources and terms;
- what was **not** checked — no network, registry rate-limited, private bundles;
- the date of the check.

Never call a name unique. Say no collision was found on the searched sources.

### 6. If a rename is needed

Renaming a bundle is a multi-file change: do the whole list or none. Run it as
its own slice on a branch, and reinstall as a *packed* artifact afterwards (see
`AGENTS.md` → *Install model*).

1. `plugins/<old>/package.json` → `name`, and bump `version`.
2. Directory `plugins/<old>/` → `plugins/<new>/`.
3. `locale/en.json` + `locale/zh.json` → title and description wording.
4. `plugins/<new>/README.md` → title and references to the old name.
5. `README.md` plugin table row + link; `AGENTS.md` Layout line;
   `ZH/README-zh.md` counterpart (keep it in sync via `zh-doc-sync`).
6. `todo/<idea>.md` + the `todo/README.md` row, when the bundle has a backlog
   entry.
7. Profile side: `plugin_manager` `remove_bundle`, `pnpm pack` under the new
   name, `install_bundle` with the new tarball; the profile `package.json` must
   not keep the old `file:` tarball path.
8. `.tmp/packs/` → delete the old tarball only after no profile references it.

## Rules

- Read-only audit. Propose renames; do not perform one without being asked.
- Never rename a delivered bundle on your own initiative: a shipped name is part
  of other people's profiles and notes.
- Record the evidence (URLs, queries, date) next to the verdict. A verdict with
  no evidence is a guess.
- `npm search` / `gh search` are best-effort: an empty result means "not found in
  this source", not "does not exist".
- Run the audit once per naming decision, when the name is introduced — not per
  release.

## Limits

- Network tools differ per session. If none is available, do the offline pass
  (`list-bundles.mjs`, `npm view`, `gh search` when `gh` is authenticated) and
  say which sources stayed unchecked.
- The audit does not check trademark rights or domain names; it only answers
  whether a name is already used by a bundle people are likely to know.
- "Popular" is time-dependent: record the date, so a stale audit looks stale
  instead of quietly wrong.

## Script

`scripts/list-bundles.mjs` — zero dependencies, Node ≥22, run from the
repository root. It reads `plugins/*/package.json` (and `archive/*` with
`--include-archive`), pulls the English locale title when present, derives the
candidate search terms, and prints a Markdown table or JSON. It does no network
access and changes no files; the judgement in steps 3–5 stays human work.
