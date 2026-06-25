<!--
Purpose: Standard blueprint for creating or changing a seam.
Why: Make Seam-Driven Development steps repeatable and auditable.
Info flow: Blueprint -> contract/probe/fixtures -> mock/tests -> adapter.
-->
# Seam Blueprint

## Summary
- Goal:
- Seam name:
- External dependency:
- Risk notes:

## Contract
- File: `src/lib/seams/<seam-name>/contract.ts`
- Define schema, types, and explicit failure modes.

## Probe
- File: `src/lib/seams/<seam-name>/probe.ts`
- Capture real behavior and produce fixtures.

## Fixtures
- File: `src/lib/seams/<seam-name>/fixtures.ts`
- Sample data: happy path
- Fault data: failing path (must fail before adapter work)
- Defined in-module or backed by co-located JSON files.
- Include metadata fields if required by `docs/evidence/README.md`.

## Mock
- File: `src/lib/seams/<seam-name>/mock.ts`
- Load fixtures by scenario from `fixtures.ts`, no invented data.

## Contract Tests
- File: `src/lib/seams/<seam-name>/test.ts`
- Run against mock first; assert fault fixture fails.

## Adapter
- File: `src/lib/adapters/<seam-name>/index.ts`
- Real I/O only via JailedFs, async I/O only.

## Verification + Evidence
- Run: `npm run verify` and `npm test`
- Attach outputs per `docs/evidence/README.md`.
- Log decisions in `DECISIONS.md` if tradeoffs exist.
