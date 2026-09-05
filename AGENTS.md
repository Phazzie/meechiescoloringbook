<!--
Purpose: Define Seam-Driven Development workflow, mandates, and governance for this repo.
Why: Prevent assumptions, scope drift, and unproven changes.
Info flow: This file -> planning/checklists -> seam docs -> implementation/tests.
-->
# AGENTS.md

This repo uses Seam-Driven Development to keep behavior measurable and deterministic. These instructions adapt the master guide for this repo.

## Wu-Bob
Current Wu-Bob roster: GZA, U-God, Method Man (update when it changes).
Why Wu-Bob exists: It forces synthesis instead of pattern matching, gives non-coders a shared vocabulary to steer AI decisions, and adds Uncle Bob as the clean-code anchor to prevent shortcuts.
When asked for Wu-Bob’s thoughts, respond in a single combined voice that blends the current Wu-Tang roster with Uncle Bob’s clean-code lens. Do not split into separate sections; keep synthesis integrated.

## Why Seam-Driven Development Here
The common failure modes are assuming behavior, skipping probes, widening scope, and claiming compliance without evidence. Seam-Driven Development prevents that by forcing reality capture, fixture-backed mocks, and contract-first tests.

## Codex MCP Server & Programmatic Usage
- **Direct MCP Integration:** Codex is configured as a direct stdio-based Model Context Protocol (MCP) server for Antigravity in `mcp_config.json`. This allows Antigravity to automatically call Codex tools (such as git operations, filesystem edits, and tool searches) without manual copy-paste.
- **Programmatic Codex CLI Calls:** In scripts and background automation, Codex can be invoked programmatically via the command line:
  - `codex exec "<instruction>"` for isolated task delegation.
  - `codex run <skill>` to execute a structured, pre-defined skill workflow.
- **When to Invoke Codex Programmatically:**
  - **PR Conflict Resolution:** To delegate merging, conflict parsing, and resolution of specific stale branches.
  - **Review Harvesting:** To query and compile open PR review comments into local Markdown checklists.
  - **Automated Validation:** To coordinate checkout, test, and verification pipelines on isolated candidate branches.
  - **Repetitive Refactoring:** For repetitive code updates or boilerplate changes across multiple files or seams.

## Core Principles (Keep These Intact)
1. Reality first: probe real behavior for any seam that touches the world.
2. Determinism: mocks load fixtures, not invented data.
3. Contract first: adapters and mocks must match the contract.
4. Red proof: fault fixture must fail before adapter work.
5. Mechanical enforcement: rely on verify/tests, not claims.

## Workflow (Liquid Loop)
Follow this order, no shortcuts. File paths below are the legacy flat layout; new seams use the
self-contained layout instead — see `CLAUDE.md`'s "Two seam layouts coexist" table and
`docs/SEAM_BLUEPRINT.md` for the equivalent self-contained paths (`src/lib/seams/<seam-name>/`).
1. Contract: `contracts/<seam>.contract.ts` (schema + types + failures).
2. Probe: `probes/<seam>.probe.ts` (capture real behavior).
3. Fixtures: `fixtures/<seam>/sample.json` and `fixtures/<seam>/fault.json`.
4. Mock: `src/lib/mocks/<seam>.mock.ts` (loads fixtures by scenario).
5. Test: `tests/contract/<seam>.test.ts` (run against mock first).
6. Adapter: `src/lib/adapters/<seam>.adapter.ts` (real I/O via JailedFs).

## Governance
- **Planning enforcement:** Plan + self-critique before code changes. List files and constraints; the plan must include the exact seam names (already listed in `docs/seams.md`), exact file paths to be touched, and exact commands that will be run.
- For autonomous deep-work requests, create or update `plan.md` with explicit specs and self-checks for each major refactor before implementation.
- Replace "locks" with a mandatory checklist gate (see below). Each checklist entry must be verifiable by a file path, a directory path, or concrete command output (no fuzzy claims).
- When asked for evidence, provide actual command output.
- Always keep track of who Wu-Bob consists of (which 1-3 Wu-Tang members are combined with Robert C. Martin).
- When a seam changes, include exact command output for `npm run verify` and `npm test`.
- Record significant tradeoffs in `DECISIONS.md`.
- Use the full term "Seam-Driven Development" in prose; do not use the acronym.
- Automation is required: `npm run verify` must be used for seam changes; it runs the audit gate (a check that fails the build if any dependency has a known high-severity security vulnerability), chamber lock, verify runner, shaolin lint, assumption alarm, seam ledger, clan chain, and proof tape.
- Use `npm run rewind -- --seam <SeamName>` for seam-scoped contract verification when full verify is not required.
- When introducing jargon or flags (for example: deterministic compressed provider prompt, CLI flags that start with `-`), define them briefly in plain language near their first mention so non-coders can follow along.

## Plan + Self-Critique Template
- Plan: goal, exact seam names (must already exist in `docs/seams.md`), exact file paths to be touched, exact commands to run. No vague or aspirational language.
- Self-critique: what could be wrong, what must be proven, the riskiest assumption, and the evidence that will prove or disprove it.
- Cipher Gate: for seam changes, record a Cipher Gate entry in `DECISIONS.md` with Date, Seams, Evidence paths, Summary, and Risks.
- Cipher Gate format (in `DECISIONS.md`):
  - `- Cipher Gate:` followed by indented fields `Date`, `Seams`, `Evidence`, `Summary`, `Risks`.
- Assumption Alarm: for blocked probes, record an Assumption entry in `DECISIONS.md` with Date, Seams, Statement, Validation, and Status.
- Assumption format (in `DECISIONS.md`):
  - `- Assumption:` followed by indented fields `Date`, `Seams`, `Statement`, `Validation`, `Status`.

## Surgical Delegation Mandate (Zero-Guesswork Subagent & Task Specification)
To eliminate AI hallucination, scope creep, and wrong guessing during implementation, every task ticket, subagent prompt, and delegation plan MUST adhere to this zero-guesswork specification standard:
- **Ban on Abstract Verbs:** Strictly forbid vague directives like "refactor X", "clean up Y", or "optimize Z". State in plain, concrete language the exact mechanical action being performed and why.
- **Explicit File & Action Inventory:** Every ticket must list the exact file paths with explicit demarcation: `[NEW]`, `[MODIFY]`, or `[DELETE]`. No blanket statements or unlisted files.
- **The Exact Touch Blueprint:** For every touched file, state precisely what is being edited: which specific imports, schemas, function signatures, variables, or lines are changing.
- **Strict Anti-Goals ("Do Not Touch"):** State explicitly what the implementing agent is FORBIDDEN from touching (e.g., "Do not alter localStorage key names; do not touch UI component props in `src/lib/components/`").
- **Literal Definition of Done CLI:** Every single task must close with a literal shell command that executes active runtime verification (e.g. unit/contract tests, build) exiting code 0.

## File Header Requirement
- Every file must start with a top-level comment describing what it does, why it does it, how information flows, and any critical invariants.
- Use the comment syntax of the file type.
- Example (Markdown):
```md
<!--
Purpose: ...
Why: ...
Info flow: ...
Invariants: ...
-->
```
- Example (TypeScript/JavaScript):
```ts
/*
 * Purpose: ...
 * Why: ...
 * Info flow: ...
 * Invariants: ...
 */
```

## Seam-Driven Development Is Always Required
- Default to Seam-Driven Development for all code changes. No shortcuts.
- Any change that touches a seam (filesystem, network, process execution, OS integration, clock/time, randomness) must follow the full workflow.
- Any change under `contracts/`, `probes/`, `fixtures/`, `src/lib/mocks/`, `tests/contract/`, or `src/lib/adapters/` must follow the full workflow.
- Any change that alters the contract or observable behavior across a seam boundary must follow the full workflow.

## Only Exception (Must Be Explicitly Stated)
- Docs/comments/formatting-only changes with zero behavioral impact. If there is any doubt, treat it as a seam change.
- Governance-only doc changes (naming conventions, seam inventory format, enforcement rules) still require a micro Plan + Self-Critique that lists the seams (if any), files, commands, and how behavior stays unchanged.

## Non-Negotiable Mandates (Short)
- Adapters must not import `fs` or `fs.promises` directly.
- No sync I/O in adapters (`*Sync` is banned).
- No `process.cwd()` in core logic; inject paths.
- Core domain logic must not depend on third-party libraries; use Node.js built-ins only.
- Adapters may depend on third-party libraries only behind seams.
- All filesystem/network/process I/O must flow through approved seam adapters only (no helper I/O).

## Checklist Before Saying "Done"
- Plan + self-critique completed.
- Fixtures are fresh (<= 7 days) or waiver recorded in `DECISIONS.md` with the assumption being made, the assumption documented in `LESSONS_LEARNED.md`/`DECISIONS.md`, and a stated plan for later validation.
- Mock loads fixtures by scenario (no logic shortcuts).
- Fault fixture fails before adapter work (red proof).
- Adapter uses JailedFs and async I/O only.
- `npm run verify` and `npm test` are green.
- The checklist gate has entries that can each be tied to an actual file path or command output (e.g., `docs/evidence/2026-01-27/npm-test-2026-01-27-0330.txt`).

### Merge When The Gates Are Green
A pull request that meets every condition below is **merged without asking**. Merging is not a
separate permission, and waiting to be asked is the failure mode this rule exists to prevent.

1. CI is green on the PR's **current head** — every required check, not just the last one seen.
   Read **both** surfaces: check runs *and* commit statuses. A deployment reports as a commit
   status, so a pull request can be red while every check run is green.
   A check established as not this pull request's failure does **not** block the merge — but
   the bar is the same failure *signature*, not the same check name. A check can be red on
   two heads for two different reasons, and this pull request genuinely breaking it looks
   identical from the outside. Establish it by matching the actual finding — the same error,
   the same files, the same branch pair — on the base commit or an unrelated head, and write
   that comparison in a comment on the pull request before merging. "It is red elsewhere too"
   is not evidence.
2. Every review comment is addressed: fixed, or answered on the thread with why not.
3. `npm run verify` and `npm test` are green, with committed evidence.
4. No unpushed local work, and no merge conflict against the base branch.

Do **not** auto-merge when any of the following holds. Say which one applies, then wait:

- A human reviewer has requested changes and they are unresolved. Bot findings do not count — address those and merge.
- The PR carries a schema, contract, or data migration.
- An open Assumption in `DECISIONS.md` covers the behavior being shipped. Resolve it first, or state why the change is safe without it.
- The owner has said to hold it.

This rule was added on 2026-08-25 after a PR sat green and unmerged because merging was
treated as needing permission. It was then deleted the same day by a concurrent session
restoring an older `AGENTS.md` blob. **Do not remove it without an owner ruling recorded in
`DECISIONS.md`.**

Reaffirmed by the owner on 2026-09-03, recorded in `DECISIONS.md`, after an agent held a
green pull request waiting to be told to merge it. Asking "shall I merge this?" when the
conditions above are met is itself the defect. Merge, then report what was merged.

## Anti-Laziness / Blocked
- Primary failure modes: skipping steps, guessing instead of probing, declaring completion without evidence.
- If required inputs, permissions, or probes are missing, STOP and declare “BLOCKED” with what is missing.

## Scheduled Quick-Wins Routine
This repo runs a recurring scheduled task with no live human watching: find two small, low-risk,
self-contained bugs, fix them, open a PR, drive it through review to merge, and never leave the PR
open. If a run genuinely can't finish, it says so in the log with why and whether a future run
should pick it up — it does not leave a PR open silently.

- **Log every run** in `QUICK_WINS_LOG.md` (append-only — never edit or delete a prior entry, only
  add a new one at the bottom). Read it in full before starting; it records every fix, every
  deferred candidate with its reasoning, and every stood-down CI failure signature so a new run
  doesn't re-derive or re-surface any of that.
- **Scope:** two independently small, verifiable, non-seam fixes per run. A candidate is out of
  scope for this routine if fixing it would touch `contracts/`, `probes/`, `fixtures/`,
  `src/lib/mocks/`, `src/lib/adapters/`, or `src/lib/seams/*` — those need the full
  Seam-Driven Development workflow, disproportionate here. Prefer `src/lib/core/*`,
  `src/routes/**`, `src/lib/components/**`, and docs.
- **Investigation:** run `npm ci`, `npm run check`, `npm run lint`, `npm test` on a clean checkout
  first to establish a baseline. A background Explore agent (pointed at `QUICK_WINS_LOG.md` in
  full so it doesn't re-surface fixed/deferred items) plus a manual pass is the established
  pattern for finding candidates.
- **Other open PRs:** never touch a PR or branch this run didn't create. A long-stale backlog of
  unrelated open PRs is expected and out of scope; note it in the log, don't drain it.
- **Verification:** `npm run check`, `npm run lint`, `npm test`, `npm run build` before every push;
  run the full `npm run verify` chain and refresh `docs/evidence/YYYY-MM-DD/` even when no seam is
  touched, to keep evidence current for the day.
- **CI noise already established as pre-existing, not this routine's fault:**
  `Rosentic - Conflict Detection`'s advisory comments scanning the whole open-PR backlog for
  cross-branch incompatibilities the diff doesn't touch, and Vercel's free-tier daily
  deployment-rate-limit failure. Stand down per the reproduction bar in "Merge When The Gates Are
  Green" above (match the same failure signature on an unrelated or already-merged head, comment
  once, don't block on it) rather than treating either as this run's problem to fix.
- **If a run can't finish:** record in `QUICK_WINS_LOG.md` exactly what's blocking, and whether a
  future run could or should pick it up. Don't leave the PR open without that note.

## Scheduled Worst-Feature Routine
A second recurring scheduled task with no live human watching: find the single worst feature in
the app, rebuild it into the best one, open a PR, drive it through review to merge, and log the
run. It is distinct from the quick-wins routine above — that one takes two small bug fixes; this
one takes one feature end to end.

- **Log every run** in `WORST_TO_BEST_LOG.md` (append-only). Read it in full before starting: it
  records every feature already rebuilt, every candidate passed over with the reasoning, and
  anything a future run should pick up.
- **"Worst" means the widest gap between what a feature promises and what it does** — measured in
  what it costs the user, not in how ugly the code is. State the case with file and line evidence.
- **Scope:** prefer `src/lib/core/*`, `src/routes/**`, `src/lib/components/**`. If the rebuild has
  to change `contracts/`, `probes/`, `fixtures/`, `src/lib/mocks/`, `src/lib/adapters/`, or
  `src/lib/seams/*`, do the full Seam-Driven Development workflow including a Cipher Gate entry —
  or pick a rebuild that does not need it. Never half-do it.
- **Verification:** `npm run check`, `npm run lint`, `npm test`, `npm run build` before every push,
  the full `npm run verify` chain, and `npx playwright test` when the change is user-facing.
- The pre-existing CI noise listed under the quick-wins routine applies here unchanged.

## Project Docs
- `LESSONS_LEARNED.md`: short, dated entries capturing pitfalls and fixes.
- `DECISIONS.md`: decision log with context, alternatives, and consequences.
- `CHANGELOG.md`: user-visible changes only.
- `QUICK_WINS_LOG.md`: append-only log of every scheduled quick-wins run — what was found, fixed,
  deferred, and merged.
- `WORST_TO_BEST_LOG.md`: append-only log of every scheduled "worst feature -> best feature" run —
  which feature was picked, the case against it, what shipped, and what was deferred.
- `docs/seams.md`: inventory of seams and their owners/contracts.
- `docs/SEAM_BLUEPRINT.md`: standard blueprint for new seams.
- `docs/evidence/README.md`: evidence capture conventions and storage.

## AI Agent Reference Notes
- Sources of truth: `AGENTS.md`, `DECISIONS.md`, `docs/seams.md`, and `contracts/`.
- Seam names are exact PascalCase; file names are lower kebab-case.
- Before touching a seam, confirm it exists in `docs/seams.md` and follow the full workflow.
- Provider limits and external API specifics are locked in `DECISIONS.md` (do not infer or guess).
- Evidence lives under `docs/evidence/YYYY-MM-DD/`; keep outputs traceable to commands.
- Prefer `rg` for search and `apply_patch` for single-file edits.
- At the end of every assistant message, provide exactly three concise next-step options, each with a one-sentence reason for why it is the best next move.

## Automation Tools
- `npm run verify`: runs audit gate (a check that fails the build if any dependency has a known high-severity security vulnerability), chamber lock, verify runner, shaolin lint, assumption alarm, seam ledger, clan chain, and proof tape; required for seam changes.
- `npm run chamber:lock`: checks seam artifact presence and writes `docs/evidence/YYYY-MM-DD/chamber-lock.json`.
- `npm run verify:runner`: runs `npm run check` + `npm test` and captures evidence.
- `npm run shaolin:lint`: enforces evidence freshness and writes `docs/evidence/YYYY-MM-DD/shaolin-lint.json`.
- `npm run seam:ledger`: writes seam coverage ledger files under `docs/evidence/YYYY-MM-DD/`.
- `npm run clan:chain`: writes clean/dirty seam summaries under `docs/evidence/YYYY-MM-DD/`.
- `npm run proof:tape`: writes a plain-English evidence summary under `docs/evidence/YYYY-MM-DD/`.
- `npm run cipher:gate`: enforces the Cipher Gate entry in `DECISIONS.md` and writes `docs/evidence/YYYY-MM-DD/cipher-gate.json`. Not part of the verify chain; run manually if needed.
- `npm run assumption:alarm`: enforces Assumption entries for blocked probes and writes `docs/evidence/YYYY-MM-DD/assumption-alarm.json`.
- `npm run rewind -- --seam <SeamName>`: runs a single seam contract test and captures seam evidence.
- `npm run hooks:install`: configures local git hooks to run `npm run verify` on commit and push.
- CI: `.github/workflows/verify.yml` runs `npm run verify` on push and pull request.

## If You Deviate Mid-Work
1. Stop immediately.
2. Restate the instruction and the law.
3. Roll back the approach to contract/probe/fixture.
4. Run `npm run verify` and `npm test`.
5. Re-scope to one seam and continue.

## Reference
See `SDD_MASTER_GUIDE_COPY.md` for the full workflow and rationale.
