<!--
Purpose: Standard blueprint for creating or changing a seam.
Why: Make Seam-Driven Development steps repeatable and auditable.
Info flow: Blueprint -> contract/probe/fixtures -> mock/tests -> adapter.
-->
# Seam Blueprint

New seams use the self-contained layout below (see `CLAUDE.md`'s "Two seam layouts coexist" table and
`src/lib/seams/CLAUDE.md`) — do not add flat-layout seams. The legacy flat layout at the bottom of this
file documents the older convention still used by seams that have not migrated.

## Summary
- Goal:
- Seam name:
- External dependency:
- Risk notes:

## Self-contained layout (new seams)

All files live under `src/lib/seams/<seam-name>/`, except the adapter:

## Contract
- File: `src/lib/seams/<seam-name>/contract.ts`
- Define schema, types, and explicit failure modes.

## Probe
- File: `src/lib/seams/<seam-name>/probe.ts`
- Capture real behavior and produce fixtures. Every self-contained seam has one, including pure or
  dependency-injected seams — for those, the probe simply calls the seam directly, since "real
  behavior" is the deterministic function itself rather than a live external system.

## Fixtures
- File: `src/lib/seams/<seam-name>/fixtures.ts` (in-module, or backed by co-located JSON assets)
- Sample (happy path) and fault (failing path, must fail before adapter work) data.
- Include metadata fields if required by `docs/evidence/README.md`.

## Mock
- File: `src/lib/seams/<seam-name>/mock.ts`
- Loads fixture scenarios from `fixtures.ts`; no invented data.

## Contract Tests
- File: `src/lib/seams/<seam-name>/test.ts`
- Run against mock first; assert fault fixture fails.

## Validators
- File: `src/lib/seams/<seam-name>/validators.ts`
- Shared Zod validators exported for adapter and test reuse.

## Adapter
- File: `src/lib/adapters/<seam-name>/index.ts` (lives outside the seam folder)
- Real I/O only via JailedFs, async I/O only. Some seams are pure or dependency-injected and have
  no adapter at all.

## Verification + Evidence
- Run: `npm run verify` and `npm test`
- Attach outputs per `docs/evidence/README.md`.
- Log decisions in `DECISIONS.md` if tradeoffs exist.

## Legacy flat layout (existing un-migrated seams only)

- Contract: `contracts/<seam>.contract.ts`
- Probe: `probes/<seam>.probe.ts` (when required — most legacy seams are pure and have none)
- Fixtures: `fixtures/<seam>/sample.json`, `fixtures/<seam>/fault.json`
- Mock: `src/lib/mocks/<seam>.mock.ts`
- Contract Tests: `tests/contract/<seam>.test.ts`
- Adapter: `src/lib/adapters/<seam>.adapter.ts`
- No `validators.ts` in this layout.
