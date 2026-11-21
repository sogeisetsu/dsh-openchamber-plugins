# dsh-sidebar-search — pause postmortem

- **Date of incident:** 2026-11-11 / 2026-11-12
- **Paused:** 2026-11-21
- **Plugin:** `dsh-sidebar-search` (client half; Host `apply()` was empty)
- **Impact:** history loading, new sessions, prompts, and model lists failed
  across the whole app until the DSH process was restarted.
- **Status:** paused; source archived in this directory; no longer installed.

## Summary

The plugin shipped a deployment-level override in its own bundle patch:

```yaml
- id: session-query-sqlite
  config:
    path: ':memory:'
    openAt: first-search
```

The override itself was reasonable — the Web bundle ships the session-content
index closed (`openAt: never`), and content search cannot work without opening
it. The problem was **where** it lived. A plugin bundle patch is composed and
re-composed whenever that bundle is installed, removed, enabled, disabled, or
reinstalled. Each of those operations flipped `session-query-sqlite` between
`never` and `first-search`, which reloaded the index, which replaced the
`sessionQuery` service, which forced a rebuild of the Host `sessionController`
service. On DSH `0.2.2-rc.1`, a rebuild that failed inside the initialization
window was not retried, so `sessionController` stayed permanently inactive. The
gateway only routes to active services, so every `session/*` RPC failed.

The plugin's code was not the cause. The coupling in its patch was.

## Symptoms

| Stage | What the user saw |
| --- | --- |
| Opening a historical session | Red banner at the top of the chat; content missing or only partially rendered |
| Banner behaviour | Stayed until a page refresh; no automatic retry; clicking the same session again brought it back |
| New session | Also failed (same Host service) |
| Overall impression | Sidebar and lists still rendered, but every session opened empty — "the whole of DSH is broken" |
| Recovery | Closing the window did nothing (desktop close hides the window); only quitting from the tray, confirming no `DeepSeek Harness.exe` remained, and reopening worked |
| Frequency | Five app restarts on 2026-11-12, each aligned with a plugin install/remove/switch |

## Error text

```
历史加载失败：typert gateway: session/follow: active Service "sessionController" is unavailable（gateway/service-unavailable）
```

`session/follow` is the RPC the chat UI uses to subscribe to a session's event
stream. The message means the Host's `sessionController` Cordis service was not
active when the gateway routed the request.

## Root-cause chain

1. `dsh-sidebar-search`'s `cordis.patch.yml` overrode another bundle's
   `session-query-sqlite` row to `openAt: first-search`.
2. Because the override lived in the plugin's patch, installing, removing,
   enabling, disabling, or reinstalling the plugin flipped that row's effective
   config (`never` ↔ `first-search`).
3. The flip reloaded `session-query-sqlite`, which produced a new
   `sessionQuery` service instance.
4. `sessionController` statically injects 13 services, including
   `sessionQuery`, so it was unloaded and rebuilt alongside the reload.
5. DSH `0.2.2-rc.1` lacked `ctx.fiber.assertActive()` and
   `await this.commands.initialize()` on that rebuild path (both added in
   `0.2.2-rc.2`). A rebuild that failed during the initialization window left
   `sessionController` permanently not active; Cordis does not retry it.
6. The gateway only routes to active services, so every `session/*` RPC failed:
   history, new session, prompt, model catalog. A page refresh could not help
   because the dead component was a Host service.

Two details worth keeping:

- **It was not a process crash.** There were no `DeepSeek Harness` crash dumps.
  The Host service became permanently unavailable, the UI went mute, and only a
  full process restart recovered it.
- **Two isolated SQLite instances exist in one process:** the Host one (used by
  the GUI sidebar search and `/resume`-style lookup) and the one in the model
  tool group. The plugin changed only the Host instance, which is why the
  model-side search tools kept working while the UI looked dead.

## Timeline

| Time | Event |
| --- | --- |
| 2026-11-10 23:32 | Installed `dsh-sidebar-search` 1.0.0 (no override yet) |
| 2026-11-11 05:19 | ★ Added the `session-query-sqlite` override to the plugin patch — coupling introduced |
| 2026-11-11 16:32 → 16:38 | Remove → reinstall → restart; first error at 16:39 |
| 2026-11-12 06:22 → 06:34 | Pack/install 1.1.1, remove twice, install; the "it happened twice more" episode |
| 2026-11-12 21:42 → 21:44 | Removed again, switched back to a `link:` install, restarted |
| 2026-11-16 14:42 | Bundle unchecked in the Plugin Manager; its patch stopped applying |
| 2026-11-21 | Paused, removed from the profile, source archived here |

## Fixes and rules

Ordered by importance. These apply to every plugin in this repository, not just
this one.

1. **Never put a deployment-level override of another bundle's row in a plugin's
   own bundle patch.** Write it into the profile's user patch layer
   (`~/.dsh/profiles/<profile>/cordis.patch.yml`). That layer is applied last,
   the final value stays fixed, and installing or removing a plugin does not
   flip it. DSH's Web bundle comments recommend this location for exactly this
   case.
2. **Before overriding a core row, compute what it pulls in.** Which services
   inject that row? Would a flip rebuild a long-initializing, heavily depended-on
   service such as `sessionController`? If the answer is not obviously safe,
   add only your own row instead of changing someone else's.
3. **Remember that a patch replaces the row's whole `config`.** It is not a
   field-level merge; unspecified fields fall back to their defaults. That is
   why `path: ':memory:'` had to be restated next to `openAt`.
4. **Turn HMR off while developing** (or accept `restart-required`):

   ```yaml
   - id: hmr
     disabled: true
   ```

   With HMR on, every install/remove/enable/disable is a live recomposition —
   the Host service chain is torn down and rebuilt. Do not repeatedly
   install/uninstall a plugin from inside the session you are using.
5. **Verify plugin UI in an isolated environment.** Use a separate `DSH_HOME`,
   link the plugin into a `web` profile, and start a host there (the
   `dsh-plugin-ui-preview` skill does this). Do not use the daily profile as a
   test bench.
6. **Stay on DSH `>= 0.2.2-rc.2`.** That release adds the `assertActive` guard
   and `commands.initialize()` on the rebuild path, so a reload landing in the
   initialization window no longer permanently kills the service. This hardens
   the root cause; it does not make rule 1 optional.
7. **Do not `link:` a directory that may disappear.** A separate failure from
   the same period: the source directory behind
   `link:<repo>/plugins/dsh-sidebar-search` was deleted by another session's
   scanner, leaving a dangling junction in the profile `node_modules`, an
   unresolvable dependency, and a plugin that silently was not installed. Pack
   the plugin and install the tarball for anything that must survive.
8. **Write a recovery runbook.** For this error: do not refresh first; try
   creating a new session. If that also fails, it is the persistent fault — quit
   from the tray, confirm the process is gone, then reopen. Only a single
   unopenable session is the transient window.
9. **Make plugin failure audible.** When the content index is off or the
   session service is unavailable, the UI must say "content search is disabled"
   rather than degrading silently. This plugin did this part well; it was the
   configuration coupling that was wrong.

## Recovery runbook

1. Try to create a new session.
2. If new sessions also fail: the Host `sessionController` is gone for this
   process. Refreshing the page will not recover it.
3. Quit DSH from the tray (closing the window is not enough on desktop).
4. Confirm no `DeepSeek Harness.exe` process remains.
5. Reopen. Then remove or disable the plugin that was installed or switched
   most recently before the failure.

## Remaining uncertainty

- The `0.2.2-rc.2` fix is based on comparing the `rc.1` and `rc.2` source at the
  time; it was not reproduced on this machine afterwards. Treat it as very
  likely, not proven.
- No crash dump existed, so there is no evidence for a separate "window
  disappeared / white screen" path. The failure described here is a dead Host
  service, not a process crash.

## Current state of this repository

- The source is archived in `archive/dsh-sidebar-search/`.
- `cordis.patch.yml` is insert-only; the content-index override was removed.
- The profile dependency and its leftover junction were removed on 2026-11-21.
- The backlog entry and resume conditions live in
  [`todo/sidebar-search.md`](../../todo/sidebar-search.md).
