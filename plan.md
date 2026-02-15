<!--
Purpose: Define the autonomous execution plan for UI redesign and technical debt refactors.
Why: Keep scope, seams, files, and validation explicit before implementation.
Info flow: User request -> execution specs -> implementation -> review evidence.
-->
# Autonomous Plan (2026-02-14)

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
