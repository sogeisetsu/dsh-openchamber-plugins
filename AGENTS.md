# AGENTS.md

Guidance for AI agents (and humans) working in this repository.

## What this repository is

It ports useful features from **OpenChamber** (a desktop/web workspace for
OpenCode) into **DeepSeek Harness (DSH)** as persistent plugins, one independent
bundle per feature. This repository is not affiliated with OpenChamber or
DeepSeek.

`openchamber/` is a read-only reference checkout used while porting. It is
git-ignored: never commit it, never modify it, and never copy its build output
into a plugin.

## Layout

```
plugins/
  dsh-sidebar-search/   # sidebar search trigger + command palette (client half, host stub)
  dsh-summary-command/  # /summary human command (host half)
README.md
AGENTS.md
```

Each plugin directory is a self-contained DSH bundle: `package.json` declaring
`dsh.bundle.patch` (and `dsh.client` when it renders UI), `cordis.patch.yml`,
locale files, icon, and its implementation files.

## Install model — development vs release

**MUST — 最终开发完成之后，必须用「真正安装」的方式来安装，不能用开发期的 link 方式。**

There are two different installation shapes, and they must not be confused:

| | Development (while building) | Release / hand-off (when done) |
| --- | --- | --- |
| How | `install_bundle` with the plugin **directory** | `pnpm pack` inside the plugin directory, then `install_bundle` with the **tarball** (or a registry spec after publishing) |
| What the profile records | a `link:<absolute path>` dependency plus a directory junction in the profile's `node_modules` | a normal versioned dependency; a real extracted package |
| Edit → effect | live: the profile reads the workspace file itself (client: reload the page; host: restart DSH) | none: the installed copy is independent of the working tree |
| Acceptable for a finished feature? | **No** | **Yes** |

Rules that follow from this:

1. A feature is not "done" while it is installed by link. Before reporting a
   feature complete, reinstall it as a packed artifact and exercise it again.
2. Verify the release install really is a real install: the profile
   `package.json` entry must show a version (not `link:`), and the profile
   `node_modules/<plugin>` entry must be a real directory (PowerShell
   `LinkType` empty), not a junction.
3. Why: a link depends on an absolute path on one machine. Move or delete the
   working tree and the installed plugin breaks; nobody consuming the package
   can reproduce the result.
4. Keep the development link while iterating — it is the fastest loop — but
   treat the release install as part of "done".

## Developing a plugin

Start from the DSH-generated docs and inspection, never from guesswork:

- Query the live Harness before writing code: `cordis_inspect_query` for Client
  `Slots`/`Service`, Host `Service`/`Config`/`Event`, and `Theme` tokens.
- Do not import Harness client packages from a plugin. Copy the pattern you need
  and keep only `--dsw-alias-*` theme tokens as a styling dependency.
- Client half: `window.__ModuleLoader__.load({ id, factory })`, register through
  `ctx.slots.inject(slotKey, () => ctx.slots.register(...))`, and keep factories
  free of side effects. Localize visible text through `ctx.locale` (ship `zh`
  and `en`).
- Host half: `export function apply(ctx)`; register resources with
  `ctx.effect`/`ctx.on` and return their cleanup.
- A bundle patch may insert rows and override another bundle's row by id (for
  example `session-query-sqlite` → `openAt: first-search`). A patch replaces the
  targeted row's whole `config`, so restate the keys it owns and write a comment
  explaining why the override exists.
- Never hand-write the DSH profile's `package.json` or `cordis.patch.yml`; use
  `plugin_manager` for install/enable/disable/remove.
- Never append a new Session event type, and never require a specific
  Harness-internal module by deep path.

## Verify before claiming a plugin works

1. Syntax: `node --check` on every JS file; parse every JSON file.
2. Manifest: `package.json` has `name`, `version`, `files`, `dsh.bundle.patch`,
   and the icon/locale exports it promises.
3. Install: `install_bundle` reports `application: applied` with no warnings.
4. Live registration: confirm the Client slot occupants and Host rows through
   `cordis_inspect_query`, not by trusting the install result alone.
5. Behaviour: exercise the feature in the running app, including the failure
   path (for example: what the UI shows when the search index is disabled), and
   report anything that stayed unverified — for example when no browser control
   is available.

## Conventions

- Code, comments, and repository docs in English. User-visible UI strings are
  localized (`zh` + `en`); keep both dictionaries complete.
- One plugin per feature. Plugins are independent bundles and must not import
  each other.
- Bump the plugin's `version` for any user-visible change, and update its
  `README.md` when behaviour or requirements change.
- Keep patches and config small, and document each override with a comment.
- Prefer theme tokens and host-native controls over hand-rolled visuals; match
  the surrounding DSH UI.

## Safety

- Never commit secrets, API keys, tokens, or credentials.
- Never commit machine-specific absolute paths, profile paths, `node_modules`,
  build output, scratch files, or the reference clone.
- Do not run destructive Git operations (reset --hard, clean -fd, force push) on
  someone else's work tree.

## License

MIT. See [LICENSE](LICENSE).
