# dsh-files-show-hidden

Adds an eye toggle to the right Sidebar's **files page** header that shows or
hides dotfiles and dot-directories in the workspace tree.

## Why

The file browser can already show hidden entries: expand its search bar with the
header's magnifier and press the eye inside it ("Show hidden entries"). That
choice is saved per workspace root and also drives the workspace search. The
files page starts with the search bar collapsed, so the control is easy to miss.

This plugin puts the switch where readers look for it, in the page header, and
keeps the file browser as the single owner of the preference: the button invokes
the browser's own magnifier and eye controls instead of reimplementing the tree
or storing a second setting.

## Usage

1. Open a Session whose workspace you want to browse.
2. Open the files page in the right Sidebar (`workspace.files`).
3. Press the eye button after the search toggle. The button drives the browser's
   own eye for you and restores the search bar to the state it was in before the
   press: a collapsed bar stays collapsed, and an open bar stays open.
4. The choice persists per workspace root across reloads, because it is the file
   browser's own saved preference.

The button shows the eye glyph while hidden entries are shown, reflects
`aria-pressed`, and follows changes made with the browser's own eye.

## Requirements and compatibility

- DSH `>= 0.2.2-rc.3` with the shipped file browser
  (`@deepseek-ai/dsh-client-ui-sidebar-files`) enabled.
- Verified against DSH `0.2.2-rc.3`.

The plugin is Client-only; its Host half is an empty `apply()`, and it registers
one entry in the Session-scoped slot `sidebar.right.tab.files.actions` (order
`-10`, so it sits after the header's search toggle and before the directory
opener).

## How it works

- It looks up the page that owns the button (`[data-files-page]`), so two docked
  panes never drive each other.
- It expands the search bar through `[data-files-search-toggle]` only to reach
  `[data-files-show-hidden]`, clicks the eye, and collapses the bar again when
  it was the one that opened it.
- It reads the pressed state from that control and, on first render, from the
  documented preference in browser storage
  (`dsh.sidebar-files.workspace-search.v1`). It **never writes** that value; the
  file browser keeps ownership of both the setting and its persistence.
- If the DSH build does not expose those controls, the button shows a localized
  "unsupported" tooltip, logs one warning, and leaves the page untouched.

## Known limitations

- Only the files page header is extended. Beside a file preview the search bar
  is always shown, so the browser's own eye is already reachable there.
- The coupling to `data-files-search-toggle`, `data-files-show-hidden`, and the
  storage key is intentional but not a public API: a DSH upgrade that renames
  them makes the button take its unsupported path.
- The pressed state can lag if another browser window changes the same
  preference; this mirrors the file browser's own multi-window limitation.
- The browser mounts its eye only while the search bar is open. When the bar
  starts collapsed, the button opens it for the click and restores it in the
  same task, forcing React to commit with `flushSync`, so no frame shows the open
  bar. If a build does not expose `flushSync`, the fallback may show a brief
  flash.

## Uninstall

Disable or remove the bundle in **Settings → Plugins**. The entry disappears and
the files page returns to its unmodified state; no preference is written by the
plugin, so nothing needs cleanup.
