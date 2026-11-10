# dsh-sidebar-search

Standalone sidebar search for the DeepSeek Harness (dsh) Web UI: a search button
at the sidebar foot opens a quick dialog that finds conversations by message
content. Extracted from the `dsh-claude-style` theme so it works without that
theme installed.

## What it adds

- A search trigger beside Settings at the sidebar foot (icon + label in the wide
  column, icon only in the 56px rail).
- A keyboard-driven dialog in the frame-wide overlay layer: type to search, `↑`/`↓`
  to move, `Enter` to open the session, `Esc` to close. Each result shows the
  session title, a relative time, and a highlighted snippet of the matching
  message.

## Install

```
install_bundle <path-to-this-directory>
```

Or, from a terminal:

```
dsh plugin add ./dsh-sidebar-search
```

## Required deployment change (shipped with this bundle)

The dialog reads message content through the Host's `session-query` index. The
shipped Web bundle deliberately closes that index (`openAt: never`) so startup
stays quiet, and its own comments name the supported override for a deployment
that enables content search: `openAt: first-search` in a later patch layer.

This bundle's `cordis.patch.yml` carries exactly that override:

```yaml
- id: session-query-sqlite
  config:
    path: ':memory:'
    openAt: first-search
```

A patch replaces the targeted row's whole `config`, so `path` is restated. The
index stays in memory (`:memory:`) — nothing is written to disk, and it is built
lazily on the first search, so the first query may take a few seconds while the
history is indexed; later queries are immediate.

Because patch layers are composed at start-up, a fresh install may need one
restart before the index override is live. Until then the dialog reports that
content search is disabled instead of failing silently.

If your profile's own patch layer later sets `openAt` back to `never`, message
content search stays off and the dialog says so.

## Plugin metadata

- Package: `dsh-sidebar-search`
- Host row: `sidebar-search` (no services; the Client module does the work)
- Client row: `dsh-sidebar-search`, registering `sidebar.footer.action` (trigger)
  and `shell.overlay` (dialog)
- Locales: `en`, `zh`
