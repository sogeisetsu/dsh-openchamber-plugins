# skills/

User-level skills ported or adapted for DeepSeek Harness, one directory per
skill. Each directory is a DSH skill bundle: a `SKILL.md` with YAML frontmatter
(`name` + `description` are required) and, when the skill needs one, a
zero-dependency `scripts/` directory.

## Install

Copy a skill directory into the DSH home's skills root:

```
copy skills\<name>  <dshHome>\skills\<name>      # Windows
# or: cp -r skills/<name> ~/.dsh/skills/<name>
```

`<dshHome>` defaults to `~/.dsh` and can be overridden with `$DSH_HOME`. DSH
scans `<dshHome>/skills/<name>/SKILL.md` at rank 400 (user-dsh) and picks up new,
renamed, edited, or removed skills without a restart. A skill is user-invocable
(`/<name>` in the composer) and model-invocable unless its frontmatter disables
one of those.

## Skills

| Skill | What it does | Upstream / origin | License | DSH adaptation |
| --- | --- | --- | --- | --- |
| [`reflect/`](reflect/) | Reviews recent work, finds repeated friction, and proposes the smallest reusable asset (an `AGENTS.md` rule, a skill, a plugin setting, a scheduled task, or nothing). | [OMO Slim](https://github.com/alvinunreal/oh-my-opencode-slim) `reflect` | MIT | Conversation-based argument parsing (DSH has no slash-command arguments), a zero-dependency session miner (`scripts/mine-sessions.mjs`, multi-frame zstd + cache), and a hard scope gate (single-workspace evidence may not become a global rule). |
| [`grilling/`](grilling/) | Stress-tests a plan or decision with a design-tree interview: frontier rounds, `❓ Q` / `➡️ recommendation` format, facts looked up by a subagent, done when the frontier is empty. | [Matt Pocock's skills](https://github.com/mattpocock/skills) `grilling` | MIT | Near-verbatim port. |
| [`install-review/`](install-review/) | Read-only pre-install review of a skill, DSH plugin, npm package, tarball, or GitHub repo: source check, full file read, permission scope, red-flag rules, graded `PASS` / `WARN` / `BLOCK` verdict. | Track A: third-party `skill-vetter` (ClawdHub ecosystem); Track B: DSH-built `plugin-security-review` | Track A upstream declared no license; review before redistributing | Merged into one entry point with a shared red-flag list, one verdict template, zero-dependency offline scan scripts, and tarball / GitHub targets. |

## Notes

- Scripts are plain Node (`.mjs`) with no third-party dependencies; the
  `install-review` scanner is read-only and only downloads when explicitly
  asked to review an npm / GitHub target.
- Skills are user-level: keep personal rules in a project's `AGENTS.md` or in
  the skill itself, and never commit machine-specific absolute paths, secrets,
  or credentials into a skill.
- Provenance lives in the table above; the corresponding `todo/` entries record
  what was borrowed, what changed for DSH, and how it was verified.
