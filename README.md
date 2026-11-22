# dsh-openchamber-plugins

🚧 **Work in progress.** This repository ports useful features from
[OpenChamber](https://github.com/openchamber/openchamber) — a desktop/web
workspace for OpenCode — plus selected skills from other agent ecosystems, into
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), so DSH users
get the conveniences DSH does not ship.

Nothing here is stable yet. APIs, layouts, and plugin names may change.

Chinese docs: [ZH/README-zh.md](ZH/README-zh.md) — the Chinese translation of
this file. The Chinese `AGENTS.md` (`ZH/AGENTS-zh.md`) is maintained locally and
is not committed.

## Plugins

| Plugin | What it does | Status |
| --- | --- | --- |
| [`dsh-files-show-hidden`](plugins/dsh-files-show-hidden) | Adds an eye toggle to the right Sidebar's files page header. It shows or hides dotfiles and dot-directories by invoking the file browser's own hidden-entry setting, so the browser keeps ownership of the preference. | delivered — packed install |
| [`dsh-summary-command`](plugins/dsh-summary-command) | Adds a localized `/summary [topic]` row to the composer's slash menu (icon, `总结` / `Summary`, description) that asks the current session for a non-destructive, hand-off-ready summary without touching the draft. Prompt text ported from OpenChamber's `/summary` magic prompt. | delivered — packed install |

## Paused work

[`dsh-sidebar-search`](archive/dsh-sidebar-search) is paused as of November 2026
and is no longer installed. Its source is kept under [`archive/`](archive/),
together with a [postmortem](archive/dsh-sidebar-search/POSTMORTEM.md) of the
Host service outage that stopped it and the rules for resuming safely. The
backlog entry is [`todo/sidebar-search.md`](todo/sidebar-search.md).

## Skills

User-level skills live under [`skills/`](skills/): one directory per skill, each
a `SKILL.md` bundle (plus zero-dependency node scripts where needed). Copy a
directory into `<dshHome>/skills/` to install it; DSH discovers the change
without a restart.

Project-level skills live under [`.dsh/skills/`](.dsh/skills/): they are
committed with the repository and discovered at rank 100, so they need no
install step. [`zh-doc-sync`](.dsh/skills/zh-doc-sync) keeps the Chinese docs in
`ZH/` aligned with their English sources, and
[`plugin-name-audit`](.dsh/skills/plugin-name-audit) checks the bundles under
`plugins/` against the plugin bundles that are popular in the agent ecosystem,
so a new plugin does not ship under a name the community already owns.

| Skill | What it does | Origin |
| --- | --- | --- |
| [`reflect`](skills/reflect) | Reviews recent work, finds repeated friction, and proposes the smallest reusable asset — an `AGENTS.md` rule, a skill, a plugin setting, a scheduled task, or nothing. | OMO Slim `reflect`, DSH-adapted |
| [`grilling`](skills/grilling) | Stress-tests a plan or decision with a design-tree interview: frontier rounds, `❓ / ➡️` format, facts looked up by a subagent. | Matt Pocock's `grilling`, near-verbatim |
| [`install-review`](skills/install-review) | Read-only pre-install review of a skill, DSH plugin, npm package, tarball or GitHub repo, ending in `PASS` / `WARN` / `BLOCK`. | `skill-vetter` (track A) merged with a DSH-built plugin review (track B) |
| [`init`](skills/init) | Scans a repository and creates or improves its project-root `AGENTS.md` from verified commands, architecture and conventions; leaves global instructions untouched. | OpenCode `/init` behaviour, DSH-native |

## Reference notes

[`docs/dsh-slash-menu-rows.md`](docs/dsh-slash-menu-rows.md) — how a
third-party command gets a first-party-looking row in the composer's `/` menu:
why a Host `CommandDefinition` cannot carry a label or icon, the difference
between a `commandUi` contribution and an own `inputTriggers` source, how the
group order and the titleless-group trick work, and what each route costs.

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
- A bundle patch is re-composed on every install, remove, enable and disable.
  Never put a deployment-level override of another bundle's row in a plugin
  patch — write it in the profile's own patch layer instead. The archived
  [`dsh-sidebar-search`](archive/dsh-sidebar-search) shows what that coupling
  can break.

## Layout

```
.dsh/skills/
  zh-doc-sync/          # keep ZH/ translations in sync with English docs
  plugin-name-audit/    # flag plugin names that collide with popular community plugins
todo/                   # idea backlog; see todo/README.md
docs/                   # reference notes on DSH internals
plugins/
  dsh-files-show-hidden/ # files-page hidden-entry toggle (client half, host stub)
  dsh-summary-command/  # /summary slash-menu row (client half, host stub)
archive/
  dsh-sidebar-search/   # paused sidebar search; source + postmortem
skills/
  reflect/              # review repeated work → smallest reusable asset
  grilling/             # design-tree interview for plans and decisions
  install-review/       # pre-install review of skills, plugins, npm packages
  init/                 # initialize project AGENTS.md (/init)
ZH/                     # Chinese docs; README-zh.md is committed, AGENTS-zh.md is local-only
```

`openchamber/` is a read-only reference clone used while porting. It is
git-ignored and is not part of this repository.

## Credits

- The `/summary` prompt text is ported from OpenChamber's
  `packages/ui/src/lib/magicPrompts.ts` (`session.summary.*`), MIT licensed.
- `grilling` is adapted from [Matt Pocock's skills](https://github.com/mattpocock/skills), MIT licensed.
- `reflect` is adapted from [OMO Slim](https://github.com/alvinunreal/oh-my-opencode-slim), MIT licensed.
- `install-review` merges the third-party `skill-vetter` skill with a DSH-built plugin review track; see [`skills/README.md`](skills/README.md) for provenance and license notes.
- `init` ports the behaviour of OpenCode's `/init` command ([Rules → Initialize](https://opencode.ai/docs/rules#initialize)), MIT licensed; no upstream prompt text is copied.
- The archived sidebar search took its behaviour and palette shape from
  dsh-claude-style's sidebar search and from OpenChamber's search surface.

## License

MIT — see [LICENSE](LICENSE).

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
