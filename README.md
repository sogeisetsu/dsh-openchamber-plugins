# dsh-openchamber-plugins

🚧 **Work in progress.** This repository ports useful features from
[OpenChamber](https://github.com/openchamber/openchamber) — a desktop/web
workspace for OpenCode — into [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
as installable plugins, so DSH users get the conveniences DSH does not ship.

Nothing here is stable yet. APIs, layouts, and plugin names may change.

## Plugins

| Plugin | What it does | Status |
| --- | --- | --- |
| [`dsh-sidebar-search`](plugins/dsh-sidebar-search) | Adds a search button beside Settings at the sidebar foot. The palette searches session message content, session titles, and projects, and offers quick actions (new session, settings, plugins). | in development |
| [`dsh-summary-command`](plugins/dsh-summary-command) | Adds a `/summary [topic]` slash command that asks the current session for a non-destructive, hand-off-ready summary. Prompt text ported from OpenChamber's `/summary` magic prompt. | in development |

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
plugins/
  dsh-sidebar-search/   # search trigger + palette (client half, host stub)
  dsh-summary-command/  # /summary human command (host half)
```

`openchamber/` is a read-only reference clone used while porting. It is
git-ignored and is not part of this repository.

## Credits

- The `/summary` prompt text is ported from OpenChamber's
  `packages/ui/src/lib/magicPrompts.ts` (`session.summary.*`), MIT licensed.
- Search behaviour and palette shape are inspired by dsh-claude-style's sidebar
  search and by OpenChamber's search surface.

## License

MIT — see [LICENSE](LICENSE).
