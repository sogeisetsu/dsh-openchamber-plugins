# First-party-looking rows in the `/` menu

How a third-party command can sit in the composer's slash menu looking like the
built-in commands, and what that costs. Verified against the installed DSH
`0.2.2-rc.3` in November 2026; re-verify the order table and the entry points
after a DSH upgrade.

## Why a Host command cannot do it

`@deepseek-ai/dsh-commands` exposes `CommandDefinition` with `name`,
`description`, `input` and nothing else. The `/` menu renders each catalog row
as `{ name, description }` — no label, no icon.

The localized label, the localized description and the glyph exist only for the
six first-party commands, through a hardcoded face table in
`@deepseek-ai/dsh-client-ui-commands` (`src/client/presentation.ts`,
`HOST_FACES`): `goal`, `plan`, `feedback`, `compact`, `permission`, `export`,
matched by `definitionId` in `builtinCommandName()`. A third-party
`definitionId` never matches, so its row keeps the catalog's English text and
gets no glyph.

## The two routes, and the one that only looks right

| Route | Row placement | Localized label/icon | Free-form argument |
| --- | --- | --- | --- |
| `ctx.commandUi.register(contribution)` | real member of the 指令 section (`sectionRows()` stamps `section: '指令'`) | yes | **no** — a contribution's `ui` is `action` or `popupSelect`, and `matchEnter` returns `undefined` for any non-bare line |
| `ctx.inputTriggers.registerSource(source)` with `order` + `showGroupTitle: false` | adjacent, titleless group rendered right after the command group | yes | **yes** — the source owns the claim |

A contribution name that collides with a Host command throws while candidates
are synthesized (`ui-commands: contribution /x collides with a host command`),
which breaks the whole `/` menu, not just that row. So a plugin migrating from a
Host command must remove the Host registration in the same change.

## Making an own source look sectioned

1. `order` decides group order: sources are sorted ascending and the built-in
   command source defaults to `0`. In this build `skill` is `2` and a typical
   plugin uses `50`; `1` therefore lands the group between the command block and
   the skills block. Pick a value nobody else uses — ties fall back to
   registration order.
2. `showGroupTitle: false` stops the group from drawing a heading. Without it
   the menu prints the source's `name`, and an unregistered dictionary key
   returns that name verbatim, which gives the trick away.
3. Rows from a separate source still render through the same view
   (`@deepseek-ai/dsh-client-ui-input-trigger`, `src/client/MenuView.tsx`), so
   they get the same icon gutter, spacing and right-aligned description.

What this does **not** buy: `SECTION_ROWS` in `presentation.ts` fixes the
first-party order (`compact`, `permission`, `model`, `export`), so a third-party
row can only be appended after the command group, never interleaved. Under a
typed query the command source ranks its own rows with `rankByName` while a
separate source filters and appends its own, so the two do not mix-rank.

## Row fields worth knowing

```js
{
  name: 'summary',                                // the pick payload, first search key
  label: t('label'),                              // 总结: a label differing from name renders the name as a trailing alias
  description: t('description'),                  // right-aligned secondary text
  icon: primitives.IconListPenOutlineRegular,     // component, or 'file' | 'folder' | 'session' for the reference glyphs
  hint: t('hint'),                                // ghost text after the claim, e.g. [topic]
}
```

- Only show the row for a leading `/`: `request.position !== 'leading'` returns
  `[]`, otherwise a `/` inside a sentence (a path) also offers the command.
- Icons come from the browser module table:
  `require('@deepseek-ai/dsh-client-ui-primitives')` inside the factory. This
  is a runtime lookup, not a dependency or a compiled import — no Harness
  package appears in the plugin's `package.json`, and a compiled source declares
  such non-baseline runtime imports in `dsh.client.external`. Keep the lookup
  behind `try`/`catch` so a composition without the module degrades to a
  text-only row. This build exposes twelve ids (`cordis`,
  `dsh-api-session-controller`, `dsh-client-modules`, `dsh-client-store`,
  `dsh-client-ui-chat`, `dsh-client-ui-dockkit`, `dsh-client-ui-layout`,
  `dsh-client-ui-primitives`, `dsh-client-ui-renderer`, `dsh-client-ui-session`,
  `dsh-client-ui-sidebar`, `dsh-client-ui-slots`). `dsh.client.inject` lists the
  client *plugin* modules to load, not these ids, so a table id does not belong
  there.
- Localize through `ctx.locale.register(namespace, { en, zh })` plus
  `ctx.locale.bind(namespace)`, and read the strings on every `candidates()`
  pass so a language switch reaches the next menu open without re-registration.
- The source must exist before the menu opens: set `dsh.client.immediately: true`
  in `package.json`, otherwise the row appears only once something else loads
  the module.

## Keeping the argument working

```js
onPick:     pick => ({ claim: claimFor(pick.session.sessionId) }),
matchSpace: (session, token) => token.trim().toLowerCase() === '/summary' ? { claim: claimFor(session.sessionId) } : undefined,
matchEnter: async (session, line) => /^\/summary(?:\s|$)/.test(line.trim()) ? { claim: claimFor(session.sessionId) } : undefined,
matchClaim: async (session, token) => /* same */ undefined,   // restores a persisted command chip
```

The claim carries `name`, `token` (command spelling **with** its trailing
space), `hint`, optionally `attachments: true`, and `submit(args, actx,
attachments)`. A line whose attachments the command cannot take should `throw`
from `matchEnter`; the input machine turns that into one composer notice and
leaves the draft and attachments in place.

## Submitting without eating the draft

`SessionInput.setDraft()` + `submit()` replaces whatever the user was writing.
Send through the session instead, and register an echo so the message shows up
before the Host round-trip lands:

```js
const session = sessions.binding(sessionId).session
const echo = session.beginSubmission({ mode: 'queue', text, attachments: [] })
const result = await session.prompt([{ type: 'text', text }], 'queue', undefined, echo?.requestId)
if (result?.ok !== true) echo?.abandon?.()
```

(`@deepseek-ai/dsh-api-session-controller`, `src/client/contract/session.ts`.)

## Migration checklist

1. Remove the Host `ctx.commands.register(...)`; leave `apply()` empty if the
   plugin is client-only, and keep the insert-only patch row so the package
   still enters the Web boot graph.
2. Do not keep the same name on both routes: a contribution would throw, and a
   Host command still shows up as its own un-joined row.
3. Restart the Host, not just the page. The old command lives in the running
   Host's registry until it reloads — until then the menu shows two rows, one
   English and one localized.
4. Re-install from a packed tarball and re-check the menu, because a link
   install keeps reading the working tree and hides packaging mistakes.

## How this was verified

Isolated `DSH_HOME` + `dsh web --no-open --port 0` + bsk: open `/`, confirm the
row sits after `下载日志 export` and before the skills block with the same icon
gutter and right-aligned description, then submit both `/summary` and
`/summary <topic>` and check the delivered user message. The reference run and
its caveats are recorded in
[`todo/summary-command-plugin.md`](../todo/summary-command-plugin.md).

Not covered here: the attachment-refusal branch and the English-locale row were
not exercised in that preview.
