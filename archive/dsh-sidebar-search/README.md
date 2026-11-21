# dsh-sidebar-search (archived)

**Status: paused in November 2026.** The plugin is no longer installed in DSH,
is not listed among the maintained plugins, and is not part of any profile. The
source is kept here so the work can resume without starting over.

Why it was paused: its bundle patch overrode another bundle's
`session-query-sqlite` row. Every install, remove, enable, or disable flipped
that row's effective config, rebuilt the Host `sessionController` service, and
on the DSH version in use could leave it permanently unavailable — which broke
history loading for every session, not just this plugin's own UI. The full
analysis, the timeline, and the rules for resuming are in
[POSTMORTEM.md](POSTMORTEM.md). The backlog entry is
[`todo/sidebar-search.md`](../../todo/sidebar-search.md).

## What it did

A search trigger beside Settings at the sidebar foot, plus a keyboard-driven
dialog in the frame-wide overlay. The dialog searched:

- sessions by message content (through the Host session-query index) and by
  title, shown together and de-duplicated;
- projects (workspaces) by title or path;
- quick actions: new session, settings, plugins.

Results were grouped, filterable (`All` / `Sessions` / `Projects` / `Actions`),
keyboard-navigable (`↑` / `↓`, `Enter`, `Esc`), and styled only with
`--dsw-alias-*` theme tokens.

## Files

| Path | Purpose |
| --- | --- |
| `client.js` | The whole feature: trigger, overlay dialog, search, i18n fallback. |
| `index.js` | Host half; intentionally empty (`apply()` only). |
| `package.json` | Bundle manifest (version 1.0.0 at pause time). |
| `cordis.patch.yml` | Insert-only row. The content-index override was removed on purpose. |
| `locale/en.json`, `locale/zh.json` | Plugin metadata dictionaries. |
| `icon.svg` | Plugin icon. |

This is the source as committed at the pause point. It was a client-only
plugin: all behaviour lived in `client.js`, and the Host module never
registered a service or route.

## Resuming safely

1. Read [POSTMORTEM.md](POSTMORTEM.md) first. In particular, do not put the
   content-index override back into this bundle's patch.
2. Restore the feature as a normal plugin under `plugins/dsh-sidebar-search/`
   and keep `cordis.patch.yml` insert-only.
3. Enable content search in the **profile's** patch layer
   (`~/.dsh/profiles/<profile>/cordis.patch.yml`), which is applied last and is
   not re-composed when this bundle is installed or removed:

   ```yaml
   - id: session-query-sqlite
     config:
       path: ':memory:'
       openAt: first-search
   ```

4. Develop against an isolated `DSH_HOME` (for example with the
   `dsh-plugin-ui-preview` skill), not the daily profile, and turn HMR off while
   iterating.
5. Install a packed tarball for validation, not a `link:` to a directory that
   another session or scanner may delete.
6. Keep DSH at `>= 0.2.2-rc.2`, where a reload landing in the service
   initialization window no longer kills `sessionController` permanently.

## Requirements

- DSH `>= 0.2.2-rc.2` recommended (`0.2.2-rc.1` was the version on which the
  outage happened).
- React `^18.2.0` (peer dependency).
