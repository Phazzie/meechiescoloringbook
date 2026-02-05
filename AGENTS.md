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

## Core Principles (Keep These Intact)
1. Reality first: probe real behavior for any seam that touches the world.
2. Determinism: mocks load fixtures, not invented data.
3. Contract first: adapters and mocks must match the contract.
4. Red proof: fault fixture must fail before adapter work.
5. Mechanical enforcement: rely on verify/tests, not claims.

## Workflow (Liquid Loop)
Follow this order, no shortcuts:
1. Contract: `contracts/<seam>.contract.ts` (schema + types + failures).
2. Probe: `probes/<seam>.probe.ts` (capture real behavior).
3. Fixtures: `fixtures/<seam>/sample.json` and `fixtures/<seam>/fault.json`.
4. Mock: `src/lib/mocks/<seam>.mock.ts` (loads fixtures by scenario).
5. Test: `tests/contract/<seam>.test.ts` (run against mock first).
6. Adapter: `src/lib/adapters/<seam>.adapter.ts` (real I/O via JailedFs).

## Governance
- **Planning enforcement:** Plan + self-critique before code changes. List files and constraints; the plan must include the exact seam names (already listed in `docs/seams.md`), exact file paths to be touched, and exact commands that will be run.
- Replace "locks" with a mandatory checklist gate (see below). Each checklist entry must be verifiable by a file path, a directory path, or concrete command output (no fuzzy claims).
- When asked for evidence, provide actual command output.
- Always keep track of who Wu-Bob consists of (which 1-3 Wu-Tang members are combined with Robert C. Martin).
- When a seam changes, include exact command output for `npm run verify` and `npm test`.
- Record significant tradeoffs in `DECISIONS.md`.
- Use the full term "Seam-Driven Development" in prose; do not use the acronym.
- Automation is required: `npm run verify` must be used for seam changes; it runs chamber lock, evidence capture, shaolin lint, seam ledger, clan chain, and proof tape.
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

## File Header Requirement
- Every file must start with a top-level comment describing what it does, why it does it, and how information flows.
- Use the comment syntax of the file type.
- Example (Markdown):
```md
<!--
Purpose: ...
Why: ...
Info flow: ...
-->
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

## Anti-Laziness / Blocked
- Primary failure modes: skipping steps, guessing instead of probing, declaring completion without evidence.
- If required inputs, permissions, or probes are missing, STOP and declare “BLOCKED” with what is missing.

## Project Docs
- `LESSONS_LEARNED.md`: short, dated entries capturing pitfalls and fixes.
- `DECISIONS.md`: decision log with context, alternatives, and consequences.
- `CHANGELOG.md`: user-visible changes only.
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

## Automation Tools
- `npm run verify`: runs chamber lock, verify runner, shaolin lint, assumption alarm, seam ledger, clan chain, proof tape, and cipher gate; required for seam changes.
- `npm run chamber:lock`: checks seam artifact presence and writes `docs/evidence/YYYY-MM-DD/chamber-lock.json`.
- `npm run verify:runner`: runs `npm run check` + `npm test` and captures evidence.
- `npm run shaolin:lint`: enforces evidence freshness and writes `docs/evidence/YYYY-MM-DD/shaolin-lint.json`.
- `npm run seam:ledger`: writes seam coverage ledger files under `docs/evidence/YYYY-MM-DD/`.
- `npm run clan:chain`: writes clean/dirty seam summaries under `docs/evidence/YYYY-MM-DD/`.
- `npm run proof:tape`: writes a plain-English evidence summary under `docs/evidence/YYYY-MM-DD/`.
- `npm run cipher:gate`: enforces the Cipher Gate entry in `DECISIONS.md` and writes `docs/evidence/YYYY-MM-DD/cipher-gate.json`.
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
