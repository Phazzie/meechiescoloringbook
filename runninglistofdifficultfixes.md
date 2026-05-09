<!--
Purpose: Maintain an atomic working checklist for the hardest repo upgrades/fixes.
Why: Make completed vs pending work explicit so follow-up PRs/agent sessions can continue safely.
Info flow: Problem statements -> atomic task checklists -> completed items in PRs -> remaining backlog.
-->

# Running List of Difficult Fixes

## Status legend
- `[ ]` not started
- `[~]` in progress
- `[x]` completed in merged/current PR

## Completed in this PR

### 5) Resolve `ImageGenerationSeam` dual layout (legacy + self-contained coexistence)
- [x] Confirm contract source-of-truth and align the self-contained seam contract shape to `Result<>`
- [x] Replace self-contained seam mock return type with fixture-backed `sample`/`fault` scenario outputs
- [x] Update self-contained seam fixtures/validators to match the active image-generation contract
- [x] Update self-contained seam contract test to assert both sample success and fault failure paths
- [x] Refactor `src/lib/adapters/image-generation-seam/index.ts` to return contract-shaped `Result<>`
- [x] Wire the self-contained seam adapter into `src/lib/core/image-generation-pipeline.ts`
- [x] Update route/pipeline/integration tests to validate the wired seam behavior
- [x] Run targeted tests for image-generation seam + pipeline + route
- [x] Run full validation (`npm test`, `npm run build`, `npm run verify`)

## Pending backlog (ready for next PR/agent session)

### 1) Migrate all 13 flat-layout seams to self-contained
- [ ] Inventory all flat seams and map each to a target self-contained folder path
- [ ] For each seam, create `contract.ts`, `probe.ts`, `fixtures.ts`/fixtures module, `mock.ts`, `test.ts`
- [ ] Move adapter entrypoints to `src/lib/adapters/<seam-name>/index.ts`
- [ ] Update imports/call-sites to new seam paths
- [ ] Retire flat seam files only after passing contract tests and verify
- [ ] Update `docs/seams.md` rows and owners/notes for migrated seams

### 2) Unify sync/async adapter contract to `Promise<Result<T>>`
- [ ] Find all non-async seam methods (`creation-store`, `spec-validation`, `app-config`, others)
- [ ] Convert contract signatures to `Promise<Result<T>>`
- [ ] Update adapters and mocks to async `Result` returns
- [ ] Update all call-sites and tests to await and branch on `ok`
- [ ] Re-run seam-specific rewind checks for each converted seam

### 3) Add retry/timeout/backoff for network adapters
- [ ] Identify network paths in provider/image adapters that currently fail fast
- [ ] Add explicit timeout guard per outbound request
- [ ] Add bounded retry policy for transient failures
- [ ] Add exponential backoff state tracking (attempt number + delay)
- [ ] Add tests for retry success, retry exhaustion, timeout, and non-retriable errors

### 4) Type-safe provider adapter payloads (remove unsafe `as` casts)
- [ ] Introduce Zod schemas for provider chat/image success and error payloads
- [ ] Validate parsed JSON with schemas before field access
- [ ] Replace all `payload as { ... }` and schema-drift-prone casts
- [ ] Add tests for schema drift/fallback error behavior

### 5b) Type-unsafe JSON parsing throughout pipelines
- [ ] Locate all `unknown` -> `Record<string, unknown>` casts in pipelines
- [ ] Add guard/validator functions per payload branch
- [ ] Return deterministic typed errors when guard fails
- [ ] Add regression tests for malformed/missing payload fields

### 6) Expand seam test coverage to fault paths / contract gaps
- [ ] Enumerate all self-contained seams with only happy-path tests
- [ ] Add explicit fault fixtures per seam (or fixture module fault scenario)
- [ ] Add red-proof assertions (fault fixture fails before adapter fix)
- [ ] Ensure self-contained seam tests run in main test path

### 7) Prompt injection hardening
- [ ] Add canonical Unicode normalization before keyword checks
- [ ] Add encoded/bypass pattern checks to guardrails
- [ ] Set max input size limits for user evidence and prompts
- [ ] Add deterministic truncation/rejection policy with explicit error codes
- [ ] Add tests for bypass attempts and oversized inputs

### 8) Modernize probes to TypeScript
- [ ] Inventory `.mjs` probes and create typed `.ts` equivalents
- [ ] Add probe compile/check integration to project tooling
- [ ] Ensure verify references TypeScript probes consistently
- [ ] Update probe docs and execution instructions

### 9) Structured logging and observability
- [ ] Define log event schema (level, message, seam, correlationId, metadata)
- [ ] Generate/request correlation IDs per API call path
- [ ] Emit provider audit trail fields for external calls
- [ ] Add telemetry emission points for success/failure milestones
- [ ] Add tests asserting structured logs in critical failure paths

### 10) Adapter template and migration guide
- [ ] Write a seam adapter template covering contract/probe/fixtures/mock/test/adapter flow
- [ ] Document sync vs async conventions and approved error/result patterns
- [ ] Add a flat→self-contained migration checklist with command gate steps
- [ ] Link guide from `AGENTS.md`/`docs/seams.md`/blueprint docs as appropriate

### 11) `GalleryStoreSeam` has no real adapter
- [ ] Define persistence contract expectations (local/browser/server target)
- [ ] Implement a real adapter under `src/lib/adapters/gallery-store-seam/`
- [ ] Add fixture-backed contract tests for adapter behavior
- [ ] Wire gallery persistence call-sites away from mock-only paths

### 12) `MeechieToolSeam` `quoteScore` never populated
- [ ] Trace where quote scoring object should be built
- [ ] Populate all defined subscores in adapter output
- [ ] Validate schema compliance in contract tests
- [ ] Add failure-path test when scoring input is incomplete

### 13) Route handlers swallow JSON parse errors
- [ ] Replace `.catch(() => null)` body parsing with explicit malformed-JSON error branch
- [ ] Return deterministic malformed JSON error code separate from schema-invalid code
- [ ] Update API tests to assert malformed vs invalid-schema distinction

### 14) `output-packaging.adapter.ts` SVG image load timeout
- [ ] Add timeout around `Image.onload`/conversion path
- [ ] Add deterministic abort/fallback error code when timeout triggers
- [ ] Add tests for timeout and success cases

### 15) Strict mode intent violations (`unknown`/`as` casts)
- [ ] Inventory risky casts across adapters/mocks/core
- [ ] Replace with narrowing functions and schema validation
- [ ] Add targeted tests for narrowed failure cases

### 16) Fixture/probe staleness
- [ ] Refresh stale probes and update dated evidence outputs
- [ ] Update stale fixture datasets from fresh probe captures
- [ ] Resolve `verify pending` seam notes in `docs/seams.md`
- [ ] Replace TBD provider model entries in `DECISIONS.md` with probed values

## Template to add more difficult fixes

Copy/paste this section when adding a new item:

```md
### <ID>) <short issue title>
- [ ] Define exact seam(s) affected
- [ ] Define exact files to change
- [ ] Add/refresh contract + fixture expectations
- [ ] Implement adapter/core/route changes
- [ ] Add/update unit + contract tests
- [ ] Run targeted tests
- [ ] Run full validation (`npm test`, `npm run build`, `npm run verify`)
- [ ] Update docs/decision log/evidence paths
```
