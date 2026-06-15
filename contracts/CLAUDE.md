<!--
Purpose: Note that contract files here are shared infrastructure, not seam-specific contracts.
Why: Prevent new seam contracts from being added here; seam contracts use src/lib/seams/<name>/contract.ts.
Info flow: contracts/shared.contract.ts -> seam contracts at src/lib/seams/<name>/contract.ts -> adapters/mocks/tests
-->
# Contracts folder

This folder contains **shared infrastructure contracts** only. Seam-specific contracts live at `src/lib/seams/<seam-name>/contract.ts`.

Remaining files:
- `shared.contract.ts` — shared Zod schemas (`NonEmptyStringSchema`, `resultSchema`, `Result` type) used across all seams
- Other non-seam contracts (generate, image-generation, output-packaging, etc.)

**Do not add new seam contracts here.** New seams go under `src/lib/seams/<seam-name>/` using the self-contained layout — see `src/lib/seams/CLAUDE.md`.

See `docs/seams.md` for the full seam registry with probe status and owners.
