# dsh-summary-command

Adds a `/summary` row to the composer's `/` menu. `/summary <topic>` submits one
model-visible user message asking the current session for a compact,
non-destructive summary suitable for handing the work off to a new session
(OpenChamber's `session.summary` magic prompt).

The row is localized (`总结` / `Summary`) with its own icon and description, so
it reads like the first-party slash commands instead of a bare plugin entry.
The user's draft and attachments are left untouched: the request is submitted
through the session's own prompt path.

## Why it is Client-side

A Host `CommandDefinition` carries only `name`, `description` and `input`;
the `/` menu gives a localized label, localized description and icon to the six
first-party commands alone (a hardcoded face table keyed by `definitionId`).
A third-party row can own that presentation only by registering as a Client
trigger source or a `commandUi` contribution. The contribution form accepts bare
invocations only, so `/summary <topic>` needs the trigger-source form. Both are
incompatible with a Host command of the same name, which is why this plugin no
longer registers one.

Consequence: `/summary` exists in Web/Desktop sessions only. CLI and other
non-Web surfaces, which have no Client module, cannot run it.

## Files

| Path | Purpose |
| --- | --- |
| `client.js` | The whole feature: `/` trigger source, menu row, claim, submission. |
| `index.js` | Host half; intentionally empty (`apply()` only). |
| `cordis.patch.yml` | Insert-only row, so the package enters the Web boot graph. |
| `locale/en.json`, `locale/zh.json` | Plugin metadata dictionaries (plugin list copy). |

The menu copy itself lives in `client.js` (`DICTS`) and goes through the Client
locale service, so it follows the app language immediately.

## Requirements

- DSH `>=0.2.2-rc.3`
- The browser module table must expose `@deepseek-ai/dsh-client-ui-primitives`
  (declared in `dsh.client.inject`); without it the row still works, text-only.
