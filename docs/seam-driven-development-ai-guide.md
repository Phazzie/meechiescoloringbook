<!--
Purpose: Guide AI assistants through this repo's Seam-Driven Development workflow.
Why: Keep changes deterministic, auditable, and aligned with governance rules.
Info flow: Repo rules -> plan/self-critique -> seam artifacts -> implementation/tests -> evidence.
-->
# Seam-Driven Development AI Assistant Guide

This guide tells an AI coding assistant how to work in this repo without shortcuts. Follow it exactly.

## Sources of truth (read first)
- `AGENTS.md` (workflow rules and governance).
- `DECISIONS.md` (locked decisions, provider limits, tradeoffs).
- `docs/seams.md` (seam inventory and ownership).
- `contracts/` (current seam contracts).

## Glossary (define before use)
- **Seam**: a boundary where the system touches the world (filesystem, network, OS, time, randomness). All I/O must go through seam adapters.
- **Contract**: the type/schema definition for a seam, stored in `contracts/<seam>.contract.ts`.
- **Probe**: a script that captures real-world behavior for a seam and writes fixture evidence.
- **Fixture**: deterministic sample or fault data stored under `fixtures/<seam>/`.
- **Mock**: a seam implementation that loads fixtures by scenario instead of real I/O.
- **Adapter**: the real I/O implementation for a seam, in `src/lib/adapters/<seam>.adapter.ts`.
- **Evidence**: command outputs recorded under `docs/evidence/YYYY-MM-DD/` to prove the work.
- **CLI flags**: options that start with `-` (example: `--seam` for selecting one seam in `npm run rewind`). Always explain flags in plain language near first mention.

## Non-negotiable rules
- Use the full term **Seam-Driven Development** in prose.
- Adapters must not import `fs` or `fs.promises` directly; async I/O only.
- No `process.cwd()` in core logic; inject paths instead.
- Core domain logic uses Node.js built-ins only (no third-party libraries).
- All filesystem/network/process I/O must flow through seam adapters only.
- Seam names are exact PascalCase; file names are lower kebab-case.
- Every file must start with a top-level comment describing Purpose, Why, and Info flow (JSON is the only exception).

## Required workflow (no shortcuts)
1. **Contract**: write `contracts/<seam>.contract.ts` with schema, types, and failure cases.
2. **Probe**: write `probes/<seam>.probe.ts` (or `.mjs`) to capture real behavior.
3. **Fixtures**: save `fixtures/<seam>/sample.json` and `fixtures/<seam>/fault.json` from probes.
4. **Mock**: implement `src/lib/mocks/<seam>.mock.ts` to load fixtures by scenario.
5. **Test**: create `tests/contract/<seam>.test.ts` and run against the mock first.
6. **Adapter**: implement `src/lib/adapters/<seam>.adapter.ts` with real I/O via approved seams.

## Planning enforcement
Before any code change, write a Plan + Self-critique that includes:
- Goal.
- Exact seam names (from `docs/seams.md`).
- Exact file paths to be touched.
- Exact commands that will be run.

Self-critique must include:
- What could be wrong.
- What must be proven.
- Riskiest assumption.
- Evidence that will prove or disprove it.

## Evidence and automation
- For seam changes, you must run `npm run verify` and `npm test` and capture outputs under `docs/evidence/YYYY-MM-DD/`.
- `npm run verify` runs chamber lock, verify runner, shaolin lint, assumption alarm, seam ledger, clan chain, proof tape, and cipher gate.
- Use `npm run rewind -- --seam <SeamName>` to run a single seam contract test when full verify is not required.

## Blocked probes
If a probe cannot run (missing credentials, missing environment, blocked access):
- Stop and declare **BLOCKED**.
- Record an `Assumption` entry in `DECISIONS.md` with Date, Seams, Statement, Validation, and Status.

## Checklist gate before done
- Plan + self-critique completed.
- Fixtures are fresh (<= 7 days) or a waiver is recorded in `DECISIONS.md`.
- Mock loads fixtures by scenario (no shortcut logic).
- Fault fixture fails before adapter work (red proof).
- Adapter uses async I/O only and approved seam adapters.
- `npm run verify` and `npm test` are green, with evidence files.
- Evidence paths are listed and traceable.

## Wu-Bob rule
When asked for Wu-Bob’s thoughts, respond in a single combined voice blending GZA, U-God, Method Man, and Robert C. Martin.

## Tooling preferences
- Use `rg` for search when possible.
- Use `apply_patch` for single-file edits when practical.

## Quick-start template (copy/paste)
```text
Plan:
- Goal:
- Seams:
- Files:
- Commands:

Self-critique:
- What could be wrong:
- What must be proven:
- Riskiest assumption:
- Evidence to prove/disprove:
```
