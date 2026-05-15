<!--
Purpose: Define the autonomous execution plan for UI redesign and technical debt refactors.
Why: Keep scope, seams, files, and validation explicit before implementation.
Info flow: User request -> execution specs -> implementation -> review evidence.
-->

# Autonomous Plan (2026-02-14)

## Svelte 5 Runes Migration of +page.svelte (2026-05-09)

### Plan

- Goal: Migrate `src/routes/+page.svelte` from Svelte 4 legacy reactive syntax (`$:`, `on:click`, `let x = initial`) to Svelte 5 runes syntax (`$state`, `$derived`, `onclick`). This is a pure refactoring — zero behavioral changes, zero seam changes.
- Exact seams: none (UI-only change; no seam boundary is crossed).
- Exact file paths to touch:
  - `src/routes/+page.svelte`
  - `plan.md`
  - `DECISIONS.md`
- Exact commands to run:
  1. `npm run check`
  2. `npm test`
  3. `npm run build`

### Self-critique

1. What could be wrong: Converting `$:` to `$derived()` for values that were also declared as `let` requires removing the duplicate declaration, which could create a reference-before-declaration error if ordering changes.
2. What must be proven: All 9 reactive declarations become `$derived`, all 26 mutable state variables get `$state`, and no `$:` remains in the file (Svelte 5 runes mode forbids `$:` once any rune is used).
3. Riskiest assumption: `voice = $state<MeechieStudioVoiceSettings>({...})` deep-binds correctly with `bind:value={voice.intensity}` in Svelte 5.
4. Evidence to prove/disprove: Green `npm run check` (0 errors, 0 warnings), green `npm test` (327 tests pass), green `npm run build`.

## Mode Router Consolidation Pass (2026-05-01)

### Plan

- Goal: Expose eight named Meechie modes from the home page using a single generic mode route that posts to `/api/tools` to avoid per-page duplication.
- Exact seams: `MeechieToolSeam`.
- Exact file paths to touch:
  - `plan.md`
  - `src/routes/+page.svelte`
  - `src/lib/components/MeechieModePage.svelte`
  - `src/routes/m/[mode]/+page.svelte`
- Exact commands to run:
  1. `npm run check`
  2. `npm test`

### Self-critique

1. What could be wrong: Route-param mapping could mismatch a supported tool input and cause runtime validation failures.
2. What must be proven: Each requested mode renders and submits a valid `MeechieToolInput` through `/api/tools` from the shared generic route.
3. Riskiest assumption: A single-mode component can cover different field requirements without reintroducing duplicated route logic.
4. Evidence to prove/disprove: Passing `npm run check` and `npm test`, plus direct code mapping of each slug to a valid tool payload.

## Meechie Redesign Integration Pass (2026-05-02)

### Plan

- Goal: Integrate the stopped Claude Meechie UI redesign into the live Svelte app with a GitHub-trackable atomic checklist, intentional image usage, unobstructed coloring-page preview, visual mode selector, evidence-first input, contained voice controls, and existing seam-backed generation/export/vault behavior.
- Exact seams: `MeechieToolSeam`, `SpecValidationSeam`, `ImageGenerationSeam`, `OutputPackagingSeam`, `CreationStoreSeam`, `SessionSeam`.
- Exact file paths to touch:
  - `docs/superpowers/plans/2026-05-02-meechie-redesign-integration.md`
  - `plan.md`
  - `static/meechie/`
  - `src/routes/+page.svelte`
  - `src/routes/+layout.svelte`
  - `src/lib/components/MeechieTools.svelte` only if shared tool styling must stay visually aligned
  - `src/routes/meechie/+page.svelte` only if dedicated tool route styling must stay visually aligned
- Exact file paths not to touch unless a separate seam-contract gate is opened:
  - `contracts/meechie-tool.contract.ts`
  - `fixtures/meechie-tool/`
  - `src/lib/mocks/meechie-tool.mock.ts`
  - `src/lib/adapters/meechie-tool.adapter.ts`
  - `tests/contract/meechie-tool.test.ts`
- Exact commands to run:
  1. `npm run check`
  2. `npm test`
  3. `npm run verify`
  4. `npm run rewind -- --seam CreationStoreSeam`
  5. `npm run rewind -- --seam SessionSeam`
  6. `npm run rewind -- --seam MeechieToolSeam` only if `MeechieToolSeam` behavior changes
  7. Browser or Playwright checks at desktop, tablet, and mobile widths

### Self-critique

1. What could be wrong: The Claude static prototype may tempt a direct React-style port that bypasses the live Svelte seams or reintroduces a floating tweaks panel that covers the preview.
2. What must be proven: The live app still type-checks, tests pass, verify runs, selected assets load, eight modes are reachable, voice controls do not obstruct the preview, and exports/vault behavior remain seam-backed.
3. Riskiest assumption: Current `MeechieToolSeam` output fields are enough for a demo-quality verdict/quote flow without a contract change.
4. Evidence to prove/disprove: Green `npm run check`, `npm test`, `npm run verify`, seam-specific rewind output for storage/session and any changed seam, plus desktop/tablet/mobile browser screenshots or equivalent visual evidence.

## Conflict Resolution Pass for Helper Tests (2026-04-23)

### Plan

- Goal: Resolve PR merge conflicts by minimizing divergence in helper test files that were unintentionally pulled into the seam-change branch.
- Exact seams: `ChatInterpretationSeam` (primary), with conflict-only file alignment in helper tests.
- Exact file paths to touch:
  - `tests/unit/output-packaging-helpers.test.ts`
  - `tests/unit/provider-adapter-helpers.test.ts`
  - `plan.md`
- Exact commands to run:
  1. `npm test -- tests/unit/output-packaging-helpers.test.ts tests/unit/provider-adapter-helpers.test.ts`
  2. `npm test`
  3. `npm run verify`

### Self-critique

1. What could be wrong: Reverting conflict-heavy helper tests might reintroduce strict-check failures that were masked by prior edits.
2. What must be proven: Both helper test files compile and pass without conflict markers and without breaking verify.
3. Riskiest assumption: Upstream/base branch versions of the helper tests already satisfy current type checks.
4. Evidence to prove/disprove: Passing targeted helper tests and green verify evidence on 2026-04-23.

## Chat JSON Parser Simplification Pass (2026-04-23)

### Plan

- Goal: Replace the hand-rolled JSON boundary scanner with a simpler parser-based single-object validator while preserving JSON-only behavior.
- Exact seams: `ChatInterpretationSeam`, `ProviderAdapterSeam`, `SpecValidationSeam`.
- Exact file paths to touch:
  - `src/lib/core/chat-interpretation-pipeline.ts`
  - `tests/unit/pipeline-edge-cases.test.ts`
  - `DECISIONS.md`
  - `plan.md`
- Exact commands to run:
  1. `npm test -- tests/unit/pipeline-edge-cases.test.ts`
  2. `npm test`
  3. `npm run verify`

### Self-critique

1. What could be wrong: Parser simplification could accidentally accept non-object JSON payloads or regress strict no-extra-text behavior.
2. What must be proven: Non-object and wrapped text payloads still fail, and clean single-object payloads still pass.
3. Riskiest assumption: `JSON.parse(trimmed)` alone is sufficient for deterministic single-object enforcement in this seam.
4. Evidence to prove/disprove: Updated unit tests plus green `npm test` and `npm run verify` evidence output.

## Chat JSON Boundary Hardening Pass (2026-04-22)

### Plan

- Goal: Enforce deterministic JSON-only chat payload parsing by accepting exactly one top-level JSON object and rejecting any non-whitespace text outside that boundary.
- Exact seams: `ChatInterpretationSeam`, `ProviderAdapterSeam`, `SpecValidationSeam`.
- Exact file paths to touch:
  - `src/lib/core/chat-interpretation-pipeline.ts`
  - `tests/unit/pipeline-edge-cases.test.ts`
  - `DECISIONS.md`
  - `plan.md`
- Exact commands to run:
  1. `npm test -- tests/unit/pipeline-edge-cases.test.ts`
  2. `npm test`
  3. `npm run verify`

### Self-critique

1. What could be wrong: A strict boundary parser can incorrectly reject valid JSON if brace-matching fails around escaped quotes or nested objects.
2. What must be proven: Valid JSON object payloads still pass, while braces-in-text and multi-object payloads fail with deterministic `CHAT_RESPONSE_INVALID`.
3. Riskiest assumption: Provider chat content for successful cases is already JSON-only and does not rely on explanatory prefix/suffix text.
4. Evidence to prove/disprove: New unit tests in `tests/unit/pipeline-edge-cases.test.ts` plus green `npm test` and `npm run verify` outputs.

## Demo Storage Test Blocker (2026-04-24)

### Plan

- Goal: Restore deterministic browser storage behavior in Vitest so the local demo can be verified without changing production storage behavior.
- Exact seams: `SessionSeam`, `CreationStoreSeam`.
- Exact file paths to touch:
  - `plan.md`
  - `vite.config.ts`
  - `tests/setup/local-storage.ts`
  - `scripts/rewind.mjs`
  - `scripts/verify-runner.mjs`
  - `svelte.config.js`
- Exact commands to run:
  1. `npm run check`
  2. `npm test`
  3. `npm run verify`
  4. `npm run rewind -- --seam SessionSeam`
  5. `npm run rewind -- --seam CreationStoreSeam`
  6. `npm run build`

### Self-critique

1. What could be wrong: The failing tests may reveal a real adapter compatibility issue instead of only a Vitest environment issue.
2. What must be proven: `localStorage` supports `getItem`, `setItem`, `removeItem`, and `clear` during unit and contract tests while production browser behavior remains unchanged.
3. Riskiest assumption: A deterministic test storage shim is sufficient for the demo blocker and Windows command spawning does not hide real test failures behind blank evidence.
4. Evidence to prove/disprove: Green `tests/unit/session-auth-helpers.test.ts`, `tests/unit/creation-store-helpers.test.ts`, `tests/contract/session.test.ts`, plus green `npm run check`, `npm test`, `npm run verify`, and seam-specific rewind commands with populated evidence output.

## Ghost Workflow Retirement Pass (2026-02-15)

### Plan

- Goal: Remove the legacy generation workflow path that is not used by the active UI or API routes.
- Exact seams: `PromptCompilerSeam`, `SafetyPolicySeam`, `GalleryStoreSeam`, `TelemetrySeam`.
- Exact file paths to touch:
  - `src/lib/core/generation-workflow.ts` (delete)
  - `src/lib/core/types.ts` (delete)
  - `src/lib/composition/deps.mock.ts` (delete)
  - `src/lib/composition/deps.server.ts` (delete)
  - `tests/unit/generation-workflow.test.ts` (delete)
  - `docs/seams.md`
  - `docs/gemini-findings-2026-02-15.md`
  - `docs/next-steps-plan-2026-02-14.md`
  - `CHANGELOG.md`
  - `DECISIONS.md`
- Exact commands to run:
  1. `npm run check`
  2. `npm test`
  3. `npm run verify`

### Self-critique

1. What could be wrong: Removing legacy files might accidentally break hidden imports or historical workflows still relied on by tests/scripts.
2. What must be proven: No active route or test references the deleted modules after retirement.
3. Riskiest assumption: The removed workflow path is fully superseded by current pipeline routes and no runtime code calls it.
4. Evidence to prove/disprove: `rg` reference scan shows no imports, plus green `npm run check`, `npm test`, and `npm run verify`.

## Autonomous Pass (2026-02-15)

### Plan

- Goal: Complete a second structural cleanup pass by extracting route orchestration logic for chat and tools into core pipelines, then clear governance gate failures.
- Exact seams: `ChatInterpretationSeam`, `MeechieToolSeam`, `SafetyPolicySeam`, `ProviderAdapterSeam`, `SpecValidationSeam`.
- Exact file paths to touch:
  - `src/lib/core/chat-interpretation-pipeline.ts` (new)
  - `src/routes/api/chat-interpretation/+server.ts`
  - `src/lib/core/tools-pipeline.ts` (new)
  - `src/routes/api/tools/+server.ts`
  - `tests/unit/api-chat-interpretation.test.ts` (new)
  - `tests/unit/api-tools.test.ts`
  - `docs/seams.md`
  - `DECISIONS.md`
- Exact commands to run:
  1. `npm run check`
  2. `npm test`
  3. `npm run verify`

### Self-critique

1. What could be wrong: Extracting pipelines can accidentally change HTTP status and error payload behavior.
2. What must be proven: Existing API behavior and contracts remain unchanged for valid and invalid inputs.
3. Riskiest assumption: Safety checks currently implemented for tools remain equivalent after moving logic into a core module.
4. Evidence to prove/disprove: Green `tests/unit/api-tools.test.ts`, new passing `tests/unit/api-chat-interpretation.test.ts`, and green `npm run verify` with updated Cipher Gate evidence.

## Goal

Deliver a brand-new modern/sleek/polished UI with strong visual identity, refresh all Meechie writing to the latest voice pattern, and complete three high-ROI refactors that reduce structural technical debt.

## Execution Order

1. UI redesign + copy rewrite.
2. Refactor 1: Generate pipeline extraction.
3. Refactor 2: Prompt template single-source refactor.
4. Refactor 3: Typed client request layer + API key plumbing consolidation.
5. Verify, review, and document decisions/changelog.

## UI Redesign Spec

- Outcome: Main builder and Meechie pages look intentionally premium, clean, and modern with clearer information hierarchy.
- Files:
  - `src/routes/+layout.svelte`
  - `src/routes/+page.svelte`
  - `src/lib/components/MeechieTools.svelte`
  - `src/routes/meechie/+page.svelte`
- Implementation notes:
  - Use consistent design tokens, cleaner spacing rhythm, stronger typography contrast, and polished action styling.
  - Keep non-technical copy for core actions; keep advanced diagnostics behind a secondary disclosure.
  - Keep Meechie tools on a dedicated path with explicit entry point from the builder page.
- Self-check:
  - Hero, primary CTA, and section structure can be understood in under 10 seconds.
  - Mobile and desktop layouts both preserve primary CTA visibility and readable spacing.

## Refactor 1 Spec: Generate Pipeline Extraction

- Problem: `/api/generate` currently mixes request validation, seam orchestration, and response shaping in one route handler.
- Outcome: Move orchestration into a dedicated core pipeline module; route becomes a thin transport wrapper.
- Files:
  - `src/lib/core/generate-pipeline.ts` (new)
  - `src/routes/api/generate/+server.ts`
  - `tests/unit/api-generate.test.ts` (adjust only if behavior contract changes)
- Self-check:
  - Route keeps identical HTTP behavior and error codes.
  - Pipeline is testable as plain logic with injected fetch/deps.

## Refactor 2 Spec: Prompt Template Single Source

- Problem: Prompt line generation logic is duplicated across PromptAssemblySeam and DriftDetectionSeam.
- Outcome: Shared prompt line helpers live in one core module to prevent drift.
- Files:
  - `src/lib/core/prompt-template.ts` (new)
  - `src/lib/adapters/prompt-assembly.adapter.ts`
  - `src/lib/adapters/drift-detection.adapter.ts`
- Self-check:
  - Existing prompt contract tests continue passing.
  - Output text remains deterministic and alignment/page-size checks still work.

## Refactor 3 Spec: Typed Client Request Layer

- Problem: Client-side fetch/request-header logic is duplicated and inconsistently typed.
- Outcome: Centralized typed request helper and shared API key header logic used by builder and Meechie tools.
- Files:
  - `src/lib/core/http-client.ts` (new)
  - `src/routes/+page.svelte`
  - `src/lib/components/MeechieTools.svelte`
- Self-check:
  - API key behavior remains identical (save/load/clear + header injection).
  - Both `/api/generate` and `/api/tools` requests use the shared helper.

## Seam Scope

- Seams touched: `MeechieVoiceSeam`, `MeechieToolSeam`, `PromptAssemblySeam`, `DriftDetectionSeam`.

## Commands

1. `npm run check`
2. `npm test`
3. `npm run verify`

## Review Criteria

- UI is visually coherent and clearly improved from prior pass.
- Refactors reduce duplication and isolate orchestration logic.
- `npm run check`, `npm test`, and `npm run verify` all pass.

## Open PR Review Comment Repair Pass (2026-05-14)

### Plan

- Goal: Address actionable review comments from open PRs #55, #56, #57, #61, #62, and #64 in one follow-up PR while documenting fixed and unfixed items by PR and by related problem.
- Exact seams: `ImageGenerationSeam` for the HTTP-error adapter contract test and typed error helpers. Shared result-schema typing is a contract helper cleanup, not a seam name; UI-only editor state changes use existing `CreationStoreSeam`, `SpecValidationSeam`, and `OutputPackagingSeam` without changing their contracts; `ProviderAdapterSeam`/text-model usage is a helper-only cleanup with no seam contract change.
- Exact file paths to touch:
  - `plan.md`
  - `DECISIONS.md`
  - `LESSONS_LEARNED.md`
  - `src/routes/+page.svelte`
  - `src/lib/core/text-model.ts`
  - `src/lib/adapters/meechie-tool.adapter.ts`
  - `src/lib/core/chat-interpretation-pipeline.ts`
  - `src/lib/core/meechie-studio-text-pipeline.ts`
  - `tests/contract/image-generation.test.ts`
  - `contracts/shared.contract.ts`
  - `src/lib/adapters/image-generation-seam/index.ts`
  - `src/lib/seams/image-generation-seam/mock.ts`
  - `tests/unit/api-image-generation.test.ts`
  - `tests/unit/image-generation-pipeline.test.ts`
- Exact commands to run:
  1. `npm run rewind -- --seam ImageGenerationSeam`
  2. `npm run check`
  3. `npm test`
  4. `npm run verify`
  5. `git diff --check`

### Self-critique

1. What could be wrong: Some review comments target code that was already changed on PR #64 or on branches not present in this checkout, so attempting to reapply them may duplicate behavior.
2. What must be proven: The try-on CTA can package the portrait directly, editor setting changes await spec synchronization and draft saves, image-generation adapter HTTP failures are covered, empty revised prompts still fall back, and model fallback selection is centralized.
3. Riskiest assumption: Browser UI behavior can be proven sufficiently by type-checks and unit/contract tests in this non-interactive pass without a visual screenshot.
4. Evidence to prove/disprove: Green `npm run rewind -- --seam ImageGenerationSeam`, `npm run check`, `npm test`, `npm run verify`, and `git diff --check`; any environment-limited failure must be captured and listed as not fully proven.
