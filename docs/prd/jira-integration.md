# PRD: Totem ↔ JIRA Push Integration

**Status:** Draft
**Owner:** Jason / Inceptyon Labs
**Date:** 2026-05-13
**Implementation split:** small Totem PR (generic `refs` field) + PASIV plugin (all JIRA-specific logic). See §5 and §11.

> **Note:** The README currently advertises a "JIRA connector" as a Totem feature. This PRD intentionally pushes the JIRA-specific surface into PASIV and keeps Totem agnostic via a generic `refs` field. If the desired direction is a built-in Totem connector instead, revisit §5 before implementing.

---

## 1. Problem

Totem is the source of truth for personal work items (markdown files in `.totem/`).
For client/company engagements, JIRA is the system of record. Today, syncing
"what got done" back to JIRA is manual — copying summaries and commit lists into
ticket comments after a PR merges.

We want to push work completion from Totem → JIRA automatically, **without
polluting Totem with JIRA-specific concerns**. JIRA is one of N possible external
trackers (Linear, Notion, GitHub Issues), and Totem should stay portable.

## 2. Goals

- **Push-only.** Totem → JIRA. No reverse sync, no polling, no webhooks.
- **PASIV owns the integration.** Totem stays a pure issue tracker.
- **Use the JIRA MCP** for auth + API. Do not implement a REST client.
- **Trigger at merge/wrap**, not on totem-status change inside Totem.
- **Minimal Totem surface area:** one generic, opaque `refs` field. Same field
  unlocks Linear / Notion / GitHub later with zero further Totem changes.
- **Bind at backlog/issue creation**, not at every `totem create`.

## 3. Non-goals

- Two-way sync (JIRA → Totem).
- Direct JIRA REST API code in either Totem or PASIV.
- JIRA workflow transitions in v1 (e.g., auto-move issue to Done). Comment-only.
- A JIRA-specific UI in the Totem board (a generic ref badge is fine).
- Real-time status mirroring as work progresses. Push happens at completion.

## 4. User stories

1. As a solo dev, I run `/backlog spec.md --epic PROJ-100`. Every totem
   generated from the spec is tagged with JIRA epic `PROJ-100`.
2. As a solo dev, I run `/issue "fix login bug" --epic PROJ-100`. The created
   totem is tagged with `PROJ-100`.
3. As a solo dev, I complete work via `/kick`, PR merges, `/wrap` runs. PASIV
   posts a comment on `PROJ-100` summarizing the totems finished, their commit
   lists, and the PR URL.
4. As a solo dev, I retrofit an existing untagged totem: `totem ref add
   <totem-id> jira PROJ-200`.
5. As a solo dev, I work without JIRA on a personal project. Nothing about
   Totem behaves differently — `refs` is just unused.

## 5. Architecture

```
┌─────────────┐    GraphQL    ┌─────────────┐    MCP call    ┌──────────┐
│   Totem     │ ◀───────────▶ │    PASIV    │ ─────────────▶ │ JIRA MCP │
│             │  reads totem  │  (skills +  │   add comment  │          │
│ stores opaque│  + commits   │  /wrap hook)│                │          │
│ `refs` field│                │             │                │          │
└─────────────┘                └─────────────┘                └──────────┘
```

**Totem's responsibility:** store and expose opaque external refs.
**PASIV's responsibility:** everything else — config, mapping, push logic, formatting.
**JIRA MCP:** auth, API, retry.

## 6. Functional requirements

### 6.1 Totem changes (small, one PR)

**Frontmatter field:**

```yaml
---
id: totem-abc1
title: Implement login OAuth flow
status: todo
refs:
  jira: PROJ-123
  # future: linear: ENG-456
---
```

- `refs` is a map of `kind: value`. Both keys and values are opaque strings.
- Totem performs **no validation** on contents — kinds are not enumerated.
- Missing or empty `refs` is the default; field is optional.

**GraphQL surface:**

```graphql
type Totem {
  # ... existing fields
  refs: [ExternalRef!]!
}

type ExternalRef {
  kind: String!
  value: String!
}

extend type Mutation {
  setTotemRef(totemId: ID!, kind: String!, value: String!): Totem!
  clearTotemRef(totemId: ID!, kind: String!): Totem!
}
```

**UI (optional, can defer):** small badge on board cards when `refs` is
non-empty. Shows `kind:value`. Click does nothing in v1 (no link inference).

**CLI:** `totem ref add <id> <kind> <value>`, `totem ref clear <id> <kind>`,
`totem ref list <id>`.

### 6.2 PASIV changes (the bulk of the work)

**`.pasiv.yml` schema additions:**

```yaml
jira:
  enabled: true
  mcp_server: "jira-mcp"        # name of the configured MCP server
  default_project: "PROJ"        # optional, used to expand bare numbers
  push_on:
    - wrap                       # auto-push when /wrap runs
    # - kick-complete            # (future) push when a /kick finishes
  comment_format: markdown       # markdown | adf (depends on MCP)
  group_by: epic                 # epic | totem — one comment per epic, or per totem
  transition_on_done: null       # v2: e.g. "Done" to move the JIRA issue
```

**Session-level "current epic" pointer:**

- File: `.pasiv/session.json` → `{ "current_jira_epic": "PROJ-100" }`
- Set via `/jira-epic PROJ-100` slash command.
- `/backlog` and `/issue` default to session epic if `--epic` not passed.
- Cleared via `/jira-epic clear` or expires after N days (config).

**Skill changes:**

| Skill          | Change                                                           |
|----------------|------------------------------------------------------------------|
| `/backlog`     | Accept `--epic`, `--story`, `--project`. Tag all generated totems via `setTotemRef`. Use session epic if no flag. |
| `/issue`       | Same flags, same behavior.                                       |
| `/wrap`        | After merge: identify touched totems (the ones in the merged PR), call `/jira-push --auto`. |
| `/jira-push`   | **New skill.** Manual or auto push. Accepts `--totem <id>`, `--pr <num>`, or `--auto` (latest merged PR). |
| `/jira-epic`   | **New skill.** Set/clear/show session current epic.              |

**`/jira-push` algorithm:**

1. Determine scope:
   - `--totem <id>`: just that totem.
   - `--pr <num>` or `--auto`: parse `Refs: totem-xxxx` from each commit message
     in the PR. Collect unique totem IDs.
2. For each totem, read its `refs.jira` value. Skip totems without one.
3. Group totems by JIRA key (if `group_by: epic`).
4. For each JIRA key:
   - Build payload: list of totem titles, list of commit SHAs + subjects, PR URL,
     timestamp.
   - Format per `comment_format`.
   - Call JIRA MCP `add_comment` tool with `(issue_key, body)`.
5. Log result per totem to `.pasiv/jira-push.log`. On failure, retry once, then
   surface error to the user — do not silently drop.

**Comment template (markdown, group_by: epic):**

```markdown
## Work completed — 2026-05-13

**PR:** [#42 — feat: implement login OAuth flow](https://github.com/.../pull/42)

### Totems finished
- **totem-abc1** — Implement login OAuth flow
- **totem-abc2** — Add token refresh handling

### Commits
- `a1b2c3d` feat: add OAuth provider config
- `d4e5f6g` feat: implement token refresh (Refs: totem-abc2)
- `h7i8j9k` test: cover refresh edge cases

_Pushed by PASIV._
```

## 7. Flow diagrams

### 7.1 Backlog creation

```
User: /backlog spec.md --epic PROJ-100
  │
  ├─ PASIV parses spec → N totem candidates
  ├─ For each candidate:
  │   ├─ totemId = createTotem(...)  via GraphQL
  │   └─ setTotemRef(totemId, "jira", "PROJ-100")  via GraphQL
  └─ Done. Totems exist on disk with `refs: { jira: PROJ-100 }`.
```

### 7.2 Merge + push

```
PR #42 merges (totem-abc1, totem-abc2 touched)
  │
  ├─ /wrap runs
  ├─ Touched totems → IDs from commit `Refs:` trailers
  ├─ /jira-push --auto invoked
  │   ├─ For each totem: read refs.jira
  │   ├─ Group: { "PROJ-100": [totem-abc1, totem-abc2] }
  │   ├─ Build comment payload (titles, commits, PR URL)
  │   └─ MCP call: add_comment(issue_key="PROJ-100", body=...)
  └─ Log result.
```

## 8. Decisions made (from design chat)

| Question                                          | Decision           |
|---------------------------------------------------|--------------------|
| Push-only or two-way?                             | Push-only.         |
| Where does the JIRA key live?                     | Totem frontmatter, generic `refs` map. |
| Bind at creation or at every totem create?        | At backlog/issue creation only. |
| Direct REST or MCP?                               | MCP.               |
| Owns the integration: Totem or PASIV?             | PASIV. Totem stays light. |
| One comment per totem or per epic?                | Per epic (rolled up). Configurable. |
| Auto-transition JIRA issue status?                | No in v1. Comment-only. Flag for v2. |
| JIRA Cloud only?                                  | Whatever the MCP supports — agnostic at our layer. |

## 9. Open questions

1. **Comment format:** Markdown or ADF (Atlassian Document Format)?
   - Recommendation: defer to MCP capability. If MCP accepts markdown, use that.
2. **Failure mode** when MCP call fails:
   - Recommendation: retry once, log to `.pasiv/jira-push.log`, surface to user.
     Do not queue or silently drop.
3. **Session epic lifetime:**
   - Recommendation: persist in `.pasiv/session.json`. No auto-expiry. Show
     current value in `/status`.
4. **Multiple JIRA refs per totem** (e.g., epic + story)?
   - Recommendation: support via separate keys (`refs.jira_epic`, `refs.jira_story`),
     but v1 only pushes to whichever is set. Document precedence.
5. **PR description enrichment:** should PASIV add JIRA links to the PR
   description automatically?
   - Recommendation: yes, gated by config flag, off by default.

## 10. Success criteria

- Run `/backlog spec.md --epic PROJ-100` → 5 totems created with
  `refs: { jira: PROJ-100 }` visible in their markdown.
- Complete one totem via `/kick`, merge PR.
- `/wrap` triggers `/jira-push` automatically.
- JIRA issue `PROJ-100` receives one comment containing the totem title, commit
  list, and PR URL.
- Zero JIRA-specific code in the Totem repo.
- Disabling JIRA in `.pasiv.yml` removes all JIRA behavior; Totem is unaffected.

## 11. Phasing

**Phase 1 — Totem `refs` field (small PR, Totem repo)**
- Frontmatter parsing, GraphQL types + mutations, CLI `totem ref` commands.
- Optional badge in board UI.
- Tests: round-trip frontmatter, mutation persistence, CLI flag.

**Phase 2 — PASIV core integration (main work, PASIV repo)**
- `.pasiv.yml` schema addition.
- `/jira-epic` skill (session epic management).
- `/backlog` + `/issue` accept epic flag, write ref.
- `/jira-push` skill: manual mode (`--totem`, `--pr`).
- MCP wiring + comment formatting.

**Phase 3 — Automation (PASIV repo)**
- `/wrap` invokes `/jira-push --auto` on merge.
- Failure logging.
- Optional PR description enrichment.

**Phase 4 — Future (out of scope for v1)**
- JIRA status transitions.
- Linear / Notion / GitHub Issues integration via the same `refs` field
  (validates the abstraction).
- Two-way sync (if ever).

## 12. Risk / mitigations

| Risk                                                  | Mitigation                                  |
|-------------------------------------------------------|---------------------------------------------|
| MCP API surface changes                               | Wrap MCP calls in one PASIV helper.         |
| `Refs: totem-xxxx` commit trailers missing            | Fall back to PR-level grouping; warn user.  |
| User forgets to set session epic                      | `/issue` and `/backlog` print a notice when no epic is in scope. |
| JIRA comment spam on chatty PRs                       | `group_by: epic` (rolled-up) is the default.|
| Credentials in `.pasiv.yml` committed by accident     | Never store creds — MCP owns auth.          |

---

_Related: [[pasiv]], [[totem]]_
