# archive/

Paused or abandoned work that is worth keeping. Nothing here is installed,
released, or part of the plugin set. Each entry keeps its source plus the notes
needed to resume or to avoid repeating a mistake.

| Entry | Status | Why it is here |
| --- | --- | --- |
| [`dsh-sidebar-search/`](dsh-sidebar-search) | paused 2026-11 | A bundle patch overrode another bundle's `session-query-sqlite` row and could leave the Host `sessionController` permanently unavailable. Source and full postmortem kept for a future restart. See [`POSTMORTEM.md`](dsh-sidebar-search/POSTMORTEM.md) and [`todo/sidebar-search.md`](../todo/sidebar-search.md). |

Conventions:

- Keep the archived bundle intact (`package.json`, `client.js`/`index.js`,
  locales, icon) so it can be moved back under `plugins/` when work resumes.
- Remove or neutralise the part that caused the pause before archiving, and say
  why in the README. For `dsh-sidebar-search`, the unsafe row override was
  deleted from its patch.
- Record the pause reason, the resume conditions, and any unverified guesses in
  the entry's README/postmortem. Link the matching `todo/` entry.
