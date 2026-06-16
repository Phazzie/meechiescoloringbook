<!--
Purpose: Note that contract files here belong to the legacy flat seam layout, or are shared/HTTP-boundary schemas.
Why: Prevent new seams from being added here; new seams use src/lib/seams/<name>/.
Info flow: contracts/<seam>.contract.ts -> src/lib/mocks/ -> tests/contract/ -> src/lib/adapters/
-->
# Legacy flat-layout seams

As of 2026-06-16, only seams that still use the **legacy flat layout** keep their contract here. Each one has companions at:

- Mock: `src/lib/mocks/<seam>.mock.ts`
- Adapter: `src/lib/adapters/<seam>.adapter.ts`
- Tests: `tests/contract/<seam>.test.ts`
- Fixtures: `fixtures/<seam>/` (JSON files)

Remaining flat-layout seam contracts: `auth-context`, `chat-interpretation`, `creation-store`, `meechie-studio-text`, `output-packaging`, `provider-adapter`, `session`, `wig-try-on`.

Two files here are not seam-specific:
- `generate.contract.ts` — the `/api/generate` HTTP request/response schema, shared by the route and pipeline.
- `shared.contract.ts` — common types (e.g. `ScenarioSchema`) reused across multiple contracts and fixtures.

`image-generation.contract.ts` is a hybrid: `ImageGenerationSeam` itself now lives at `src/lib/seams/image-generation-seam/`, but its HTTP API request/response schemas remain here because they are consumed at the route boundary, not just inside the seam.

Five seams that previously duplicated contracts here — `PromptAssemblySeam`, `DriftDetectionSeam`, `MeechieVoiceSeam`, `MeechieToolSeam`, `SpecValidationSeam` — were migrated to the self-contained layout under `src/lib/seams/<seam-name>/` and their flat-layout contract/mock/adapter/test files were deleted. Their `fixtures/<seam>/*.json` directories remain (the canonical `src/lib/seams/<seam-name>/fixtures.ts` modules still import the JSON from there); only the duplicate `.contract.ts`/`.mock.ts`/`.adapter.ts`/`.test.ts` files were removed.

**Do not add new contracts here.** New seams go under `src/lib/seams/<seam-name>/` using the self-contained layout — see `src/lib/seams/CLAUDE.md`.

See `docs/seams.md` for the full seam registry with probe status and owners.
