---
name: init
description: Create or improve a project's AGENTS.md by scanning the repository for real commands, architecture and conventions. Use when the user runs /init, asks to initialize project instructions or AGENTS.md, or says 初始化项目说明 / 生成 AGENTS.md. Writes only the project-root AGENTS.md, never the global ~/.dsh/AGENTS.md, and never invents commands.
---

# /init — initialize the project's AGENTS.md

One file, one pass: scan the repository, put what future agent sessions actually
need into `<project root>/AGENTS.md`, and leave everything else alone.

## What DSH loads (read once, then act)

- The first request of a session loads `$DSH_HOME/AGENTS.md` and
  `<agentsHome>/AGENTS.md` (user-global), then `AGENTS.md` and `CLAUDE.md` from
  the project root down to the session's working directory, broad to specific.
  `AGENTS.local.md` / `CLAUDE.local.md` are additive local overlays.
- The project root is the nearest ancestor containing `.git`; without one it is
  the working directory.
- Byte-identical duplicates render once, and nested instruction files become
  visible after an agent successfully reads, writes, or edits inside that
  directory. No restart is needed for the file you write to take effect.
- `dsh-base` budgets each instruction chain at 65,536 bytes by default. That is
  the point of this skill: write less, but write the useful parts.

## Contract

Write exactly one file: `<project root>/AGENTS.md`. Creating or improving it is
the entire job.

Never:

- write `$DSH_HOME/AGENTS.md`, `~/.agents/AGENTS.md`, or any user-global file;
- create `AGENTS.local.md` / `CLAUDE.local.md` (personal overlays, not project
  instructions);
- edit source code, manifests, CI, or `.dsh/` in the same run;
- invent a command, version, service, or rule the repository does not show;
- copy secrets, environment values, tokens, or machine-specific absolute paths
  (use placeholders such as `<repo>/...`, `<dshHome>`);
- overwrite an existing `AGENTS.md` wholesale, or delete content a human wrote;
- run build, test, lint, format, or install commands during init;
- commit or push.

If the working directory is the user's home directory or `$DSH_HOME`, stop and
ask which project directory they mean instead of writing there. If the resolved
project root is above the working directory, state both paths in the report so
the user knows where the file landed.

Language: write `AGENTS.md` in the language of the repository's existing docs
(README, CONTRIBUTING, an existing `AGENTS.md`). Default to English when the repo
is mixed or silent.

## Phase 1 — scan (read-only)

Work from the project root. Read heads and let globs narrow the list; never scan
`node_modules`, `vendor`, `dist`, `build`, generated trees, or lockfiles.

Instruction sources already present: `AGENTS.md`, `CLAUDE.md`, `AGENTS.local.md`,
`CLAUDE.local.md`, `.cursor/rules/`, `.cursorrules`, `.windsurfrules`,
`.clinerules`, `.github/copilot-instructions.md`, `.github/instructions/`,
`CONTRIBUTING.md`, `docs/`.

Build system and commands:

- `package.json` (`scripts`, `packageManager`, `engines`, `workspaces`),
  `pnpm-workspace.yaml`, `turbo.json`, `nx.json`, `lerna.json`, `Makefile`;
- `pyproject.toml`, `setup.cfg`, `tox.ini`, `Cargo.toml`, `go.mod`, `Gemfile`,
  `build.gradle`, `pom.xml`, `composer.json`, `CMakeLists.txt`, `justfile`;
- CI: `.github/workflows/*.yml`, `.gitlab-ci.yml`, `azure-pipelines.yml`,
  `.circleci/config.yml` — the commands CI really runs, in their order, with the
  versions and package manager they use.

Conventions and environment:

- `tsconfig*.json`, eslint/biome/prettier/ruff/rustfmt/clippy configs,
  `.editorconfig`, `.nvmrc`, `.node-version`, `.python-version`,
  `rust-toolchain`;
- `Dockerfile`, `docker-compose*.yml`, `.devcontainer/`, migrations, codegen
  scripts, `.env.example` (variable names only; if an example file looks like it
  holds a real credential, never copy the value — name the variable and flag it
  in the report);
- top-level directories and workspace packages: read enough heads to describe
  each one's responsibility in a phrase; do not inventory files.

Instruction files drift: when `CLAUDE.md` or the README names a command the
manifest no longer declares, do not repeat it as fact and do not silently fix it
— trust the manifest and CI, and record the discrepancy under
`## Environment and gotchas`.

Tests: where tests live, how to run the full suite, and how to run a single test
file in the project's runner.

Setup notes: README / CONTRIBUTING / CI for non-obvious prerequisites (services,
ports, migrations, build order in a monorepo, platform quirks).

## Phase 2 — choose what to write

Only facts a new session cannot infer in its first minute. Use these sections,
and drop any that would be empty:

- `## Commands` — install, dev, build, lint, typecheck, format, test, plus the
  narrow single-test form; then the order CI verifies them in. Mark commands that
  only CI runs.
- `## Architecture` — only non-obvious structure: workspace packages and their
  roles, request/data flow, generated code, boundary rules. No file listing.
- `## Conventions` — project-specific rules traceable to configs or existing
  code (module style, error handling, state, naming, localization, dependency
  rules, commit/PR expectations). No generic best practices.
- `## Environment and gotchas` — required env var **names**, local services and
  ports, codegen and migration steps, known flaky areas, platform notes.
- `## More instructions` — one line per external rule source you found
  (`CLAUDE.md` is loaded by DSH itself; Cursor/Copilot rules are not), so future
  sessions know where the rest lives instead of duplicating it.
- `## Do not` — destructive or forbidden actions the repository states
  explicitly (never invent prohibitions).

If a section would only restate the obvious, omit it. A short, precise file beats
a complete-looking one.

## Phase 3 — ask only what the code cannot answer

Ask at most 1–2 questions, in one message, and only when the answer changes a
command or a hard rule. Every question must show what you found and a recommended
answer. Never ask for a fact you can verify yourself.

Good: "CI runs both `pnpm test` and `pnpm test:e2e`; the e2e suite needs Docker.
Should `AGENTS.md` tell agents to run only the unit suite by default?" Bad: "what
does this project do?"

If the user declines, says "just do it", or no human is available (a delegated or
headless run), proceed on the conservative path and list every assumption in the
report.

## Phase 4 — create or improve

Creating (no `AGENTS.md`, no `CLAUDE.md`): write a short intro line, then the
sections above, with commands in fenced blocks.

Creating when `CLAUDE.md` exists: DSH already loads it verbatim. Add only what it
does not cover and reference it by path under `## More instructions`; do not copy
its content. A rules-only `CLAUDE.md` usually has no commands, so verified
commands in `AGENTS.md` are not duplication. If it already covers everything,
write the short pointer plus any verified commands that are missing, and say so in
the report.

Improving an existing `AGENTS.md`: read it fully first. Preserve its headings,
order, tone, and every correct statement. Use targeted edits for what is missing,
wrong, or stale; add a section rather than restructure. Rewrite only when the user
explicitly asks for a rewrite.

Monorepos: write the root file only. Mention the package layout; if a package
clearly needs its own rules, offer `<package>/AGENTS.md` instead of creating it
unasked (DSH loads it when an agent touches that directory).

## Phase 5 — verify and report

Before reporting:

1. read the file back in full;
2. check every command against a manifest, Makefile, or CI file; drop or label
   anything you cannot trace;
3. check no secret, environment value, or absolute host path leaked in;
4. check the file stays focused — no file inventory, no generic advice;
5. if nothing needed changing, report "no change needed" instead of editing.

Report:

```
Initialized <path> — created | updated | no change needed

Commands verified against: <package.json / CI / Makefile / ...>
Added or changed: <sections, one line each>
Assumptions: <only if any>
Not verified: <only if any>
Suggested: git add AGENTS.md && git commit -m "docs: add project instructions"
```

The `Suggested` line is text for the user — never run it, and never commit on
your own.

## Reading the request

| The user says | Do |
| --- | --- |
| `/init`, "初始化一下项目说明", "set up AGENTS.md" | full scan, then write |
| "先看看别写", "dry run", "只给建议" | phases 1–3 and a report only; no file changes |
| "重写", "rewrite it" | explicit permission to replace the existing body; still keep verified facts |
| "也给 packages/x 写一份" | add `<package>/AGENTS.md` for the named package only |
