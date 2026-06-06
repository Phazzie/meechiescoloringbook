<!--
Purpose: Define development and verification rules specific to self-contained seams in this folder.
Why: Ensure strict contract-first implementation and prevention of invented mock data.
Info flow: contract.ts -> probe.ts -> fixtures.ts -> mock.ts -> test.ts -> adapters/ -> docs/seams.md.
-->
# Seam Development Governance (src/lib/seams/ Directory)

All seams under this folder must follow the Seam-Driven Development (SDD) contract-first lifecycle. Do not take shortcuts.

## 1. Artifact File Checklist
For any new or modified seam folder (e.g. `src/lib/seams/MyNewSeam/`), you must verify the existence and structure of these co-located files:
- `contract.ts`: Declares types, Zod schemas, and explicit failure modes.
- `fixtures.ts`: Provides sample + fault data (optionally loading JSON assets).
- `mock.ts`: Exposes a deterministic mock loading those fixtures under specific scenarios (no inline random/invented data).
- `probe.ts`: Contains the real-world probe code to check external behavior manually.
- `test.ts`: Contains the contract tests asserting mock and adapter behavior.
- `validators.ts`: Shared Zod validation helpers.

## 2. Adapter Isolation
- Adapters must not import standard Node `fs` or `fs.promises` directly. Use approved seam interfaces or JailedFs.
- Adapters live under `src/lib/adapters/<seam-name>/index.ts`. If a seam is pure, it does not require an adapter.

## 3. Red-Proof Verification (Mandatory)
Before writing or modifying the adapter logic:
1. Define the contract schemas and failures.
2. Build the fault fixtures.
3. Verify that the contract tests fail when running the mock against the fault fixture (Red Proof).
4. Run seam-scoped testing using the rewind command:
   ```bash
   npm run rewind -- --seam MyNewSeam
   ```
5. Do not proceed to adapter implementation until this test fails cleanly.
