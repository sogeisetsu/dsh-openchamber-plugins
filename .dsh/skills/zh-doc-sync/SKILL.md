---
name: zh-doc-sync
description: Keep the Chinese docs in ZH/ in sync with their English sources (README.md → ZH/README-zh.md, AGENTS.md → ZH/AGENTS-zh.md). Use when English docs changed, when asked to 同步中文文档 / 更新中文版 / 中英文对不上 / 翻译过期 / check zh docs, or before committing a change that touches README.md or AGENTS.md.
---

# zh-doc-sync

Keep this repository's Chinese documentation honest. English is the source of
truth; `ZH/` holds translations that must track it:

| Source | Translation | Tracking |
| --- | --- | --- |
| `README.md` | `ZH/README-zh.md` | committed |
| `AGENTS.md` | `ZH/AGENTS-zh.md` | local only, git-ignored |

Structure parity is checkable; translation quality is not. This skill makes the
structural drift visible and gives a repeatable update workflow, not an
automatic translator.

## When to use

- `README.md` or `AGENTS.md` changed (or is about to be committed).
- The user asks to sync/catch up the Chinese docs, or suspects the translations
  are stale.
- Before merging a branch that touched either English file.

Do not use it to translate unrelated files, plugins, or todo entries.

## Workflow

1. Run the checker from the repository root:

   ```sh
   node .dsh/skills/zh-doc-sync/scripts/check-sync.mjs
   ```

   Read the report: it names the pair, the mismatching headings, fenced code
   blocks, tables, and link targets. Add `--json` for machine-readable output;
   `--strict` also fails on link-target differences.

2. Make sure both translations exist. If `ZH/AGENTS-zh.md` is missing, translate
   the current `AGENTS.md` into it. It is local-only by design; confirm it stays
   ignored:

   ```sh
   git check-ignore -v ZH/AGENTS-zh.md
   ```

   Never commit `ZH/AGENTS-zh.md`; `ZH/README-zh.md` is committed with the
   English change.

3. Update the translation section by section, following the English source.
   Translate prose only. Keep verbatim: headings' level/order, every fenced code
   block (language and content), table column counts, link targets, inline code,
   commands, paths, URLs, identifiers, front-matter keys, and numbers.

4. Re-run the checker until it reports the pair in sync. Treat link warnings as
   real: fix them or explain why a known language-switch link differs.

5. Report what changed: which sections were updated, what still needs human
   review (wording, terminology), and whether the tracked `ZH/README-zh.md` was
   staged in the same commit as the English change.

## Rules

- `ZH/` links use a `../` prefix (e.g. `../plugins/...`); the checker normalizes
  it, so the English and Chinese link targets must match after normalization.
- Keep a language-switch line at the top of `ZH/README-zh.md`
  (`[English](../README.md) | 中文`). The checker treats the two README/AGENTS
  targets as the same language-pair target.
- Name translations after the English file plus `-zh`
  (`ZH/README-zh.md`, `ZH/AGENTS-zh.md`); do not reuse the English name as-is.
- Prefer established DSH/OpenChamber terminology from the English docs; do not
  invent new translations for product names, commands, or file paths.
- If the English docs intentionally differ (new section, removed table), update
  both sides in the same change and note it.
- This is a project-level DSH skill under `.dsh/skills/`; it needs no install
  step and is discovered at rank 100 while the repository root is the session
  working directory.

## Checker

`.dsh/skills/zh-doc-sync/scripts/check-sync.mjs` — zero dependencies, Node ≥22:

- compares heading level sequences, fenced code blocks (language + content),
  Markdown tables (count and column counts) for each pair;
- compares link targets after normalizing `../`, `./`, trailing `/`, and the
  README/AGENTS language-pair aliases;
- exits `1` on missing files or structural drift, `0` when only link warnings
  remain (or all clean); `--strict` turns link warnings into failures.

Limitations: it checks structure, not meaning. A structurally identical but
mistranslated section passes; the workflow's step 5 is the human check.
