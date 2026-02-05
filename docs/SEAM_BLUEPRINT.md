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
- File: `contracts/<seam>.contract.ts`
- Define schema, types, and explicit failure modes.

## Probe
- File: `probes/<seam>.probe.ts`
- Capture real behavior and produce fixtures.

## Fixtures
- Folder: `fixtures/<seam>/`
- `sample.json`: happy path
- `fault.json`: failing path (must fail before adapter work)
- Include metadata fields if required by `docs/evidence/README.md`.

## Mock
- File: `src/lib/mocks/<seam>.mock.ts`
- Load fixtures by scenario, no invented data.

## Contract Tests
- File: `tests/contract/<seam>.test.ts`
- Run against mock first; assert fault fixture fails.

## Adapter
- File: `src/lib/adapters/<seam>.adapter.ts`
- Real I/O only via JailedFs, async I/O only.

## Verification + Evidence
- Run: `npm run verify` and `npm test`
- Attach outputs per `docs/evidence/README.md`.
- Log decisions in `DECISIONS.md` if tradeoffs exist.
