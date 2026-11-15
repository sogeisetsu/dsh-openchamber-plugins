# dsh-openchamber-plugins

🚧 **Work in progress.** This repository ports useful features from
[OpenChamber](https://github.com/openchamber/openchamber) — a desktop/web
workspace for OpenCode — plus selected skills from other agent ecosystems, into
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), so DSH users
get the conveniences DSH does not ship.

Nothing here is stable yet. APIs, layouts, and plugin names may change.

Chinese docs: [ZH/README.md](ZH/README.md) — the Chinese translation of this
file. The Chinese `AGENTS.md` (`ZH/AGENTS.md`) is maintained locally and is not
committed.

## Plugins

| Plugin | What it does | Status |
| --- | --- | --- |
| [`dsh-sidebar-search`](plugins/dsh-sidebar-search) | Adds a search button beside Settings at the sidebar foot. The palette searches session message content, session titles, and projects, and offers quick actions (new session, settings, plugins). | in development |
| [`dsh-summary-command`](plugins/dsh-summary-command) | Adds a `/summary [topic]` slash command that asks the current session for a non-destructive, hand-off-ready summary. Prompt text ported from OpenChamber's `/summary` magic prompt. | delivered — dev-linked install; packed install pending |

## Skills

User-level skills live under [`skills/`](skills/): one directory per skill, each
a `SKILL.md` bundle (plus zero-dependency node scripts where needed). Copy a
directory into `<dshHome>/skills/` to install it; DSH discovers the change
without a restart.

Project-level skills live under [`.dsh/skills/`](.dsh/skills/): they are
committed with the repository and discovered at rank 100, so they need no
install step. [`zh-doc-sync`](.dsh/skills/zh-doc-sync) keeps the Chinese docs in
`ZH/` aligned with their English sources.

| Skill | What it does | Origin |
| --- | --- | --- |
| [`reflect`](skills/reflect) | Reviews recent work, finds repeated friction, and proposes the smallest reusable asset — an `AGENTS.md` rule, a skill, a plugin setting, a scheduled task, or nothing. | OMO Slim `reflect`, DSH-adapted |
| [`grilling`](skills/grilling) | Stress-tests a plan or decision with a design-tree interview: frontier rounds, `❓ / ➡️` format, facts looked up by a subagent. | Matt Pocock's `grilling`, near-verbatim |
| [`install-review`](skills/install-review) | Read-only pre-install review of a skill, DSH plugin, npm package, tarball or GitHub repo, ending in `PASS` / `WARN` / `BLOCK`. | `skill-vetter` (track A) merged with a DSH-built plugin review (track B) |

## Install

Requires DSH `>= 0.2.2-rc.1`.

Each plugin is an independent DSH bundle. Install it through the Plugin Manager
(or `plugin_manager` with `install_bundle`) from a packed artifact:
`pnpm pack` inside the plugin directory, then install the resulting tarball.

> **During development** the plugins are installed by linking the working
> directory into the DSH profile (`link:` dependency plus a junction), so edits
> appear live. That is a development-only convenience. A finished feature must
> be installed as a real package — see [AGENTS.md](AGENTS.md) (*Install model*).

Two behaviours worth knowing:

- A `client.js` change appears after a page/window reload; a Host change
  (`index.js`) or a `cordis.patch.yml` change needs a DSH restart, because the
  bundle patch is composed at start-up.
- `dsh-sidebar-search` overrides the `session-query-sqlite` row to
  `openAt: first-search`. DSH ships that index closed for a quiet start-up, so
  content search would otherwise be disabled.

## Layout

```
.dsh/skills/
  zh-doc-sync/          # keep ZH/ translations in sync with English docs
todo/                   # idea backlog; see todo/README.md
plugins/
  dsh-sidebar-search/   # search trigger + palette (client half, host stub)
  dsh-summary-command/  # /summary human command (host half)
skills/
  reflect/              # review repeated work → smallest reusable asset
  grilling/             # design-tree interview for plans and decisions
  install-review/       # pre-install review of skills, plugins, npm packages
ZH/                     # Chinese docs; README.md is committed, AGENTS.md is local-only
```

`openchamber/` is a read-only reference clone used while porting. It is
git-ignored and is not part of this repository.

## Credits

- The `/summary` prompt text is ported from OpenChamber's
  `packages/ui/src/lib/magicPrompts.ts` (`session.summary.*`), MIT licensed.
- `grilling` is adapted from [Matt Pocock's skills](https://github.com/mattpocock/skills), MIT licensed.
- `reflect` is adapted from [OMO Slim](https://github.com/alvinunreal/oh-my-opencode-slim), MIT licensed.
- `install-review` merges the third-party `skill-vetter` skill with a DSH-built plugin review track; see [`skills/README.md`](skills/README.md) for provenance and license notes.
- Search behaviour and palette shape are inspired by dsh-claude-style's sidebar
  search and by OpenChamber's search surface.

## License

MIT — see [LICENSE](LICENSE).
