<!--
Purpose: Note that contract files here belong to the legacy flat seam layout.
Why: Prevent new seams from being added here; new seams use src/lib/seams/<name>/.
Info flow: contracts/<seam>.contract.ts -> src/lib/mocks/ -> tests/contract/ -> src/lib/adapters/
-->
# Legacy flat-layout seams

Contract files in this folder belong to the **legacy flat layout**. Each one has companions at:

- Mock: `src/lib/mocks/<seam>.mock.ts`
- Adapter: `src/lib/adapters/<seam>.adapter.ts`
- Tests: `tests/contract/<seam>.test.ts`
- Fixtures: `fixtures/<seam>/` (JSON files)

**Do not add new contracts here.** New seams go under `src/lib/seams/<seam-name>/` using the self-contained layout — see `src/lib/seams/CLAUDE.md`.

See `docs/seams.md` for the full seam registry with probe status and owners.
