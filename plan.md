<!--
Purpose: Define the autonomous execution plan for UI redesign and technical debt refactors.
Why: Keep scope, seams, files, and validation explicit before implementation.
Info flow: User request -> execution specs -> implementation -> review evidence.
-->

# Autonomous Plan

Current active plan is listed first. Older dated entries remain below as historical context and are not active unless explicitly reselected.

## Autonomous PR Drain Split-PR Runbook (2026-06-05)

### Plan

- Goal: Drain the open PR backlog through several small replacement PRs while the user can step away, with live GitHub state capture, periodic self-critique, validation gates, and a final salvage audit for broad PRs before closure.
- Exact seams: `ProviderAdapterSeam`, `ChatInterpretationSeam`, `MeechieToolSeam`, `MeechieStudioTextSeam`, `ImageGenerationSeam`, `SpecValidationSeam`, `OutputPackagingSeam`, `WigCatalogSeam`, `WigTryOnSeam`, `CreationStoreSeam`, `PromptCompilerSeam`, `GalleryStoreSeam`, `SafetyPolicySeam`, `TelemetrySeam`, `SessionSeam`.
- Exact file paths to touch for this planning branch:
  - `plan.md`
  - `docs/superpowers/plans/2026-06-05-autonomous-pr-drain.md`
- Exact commands to run before implementation starts:
  1. `git status --short --branch` and stop if the worktree is dirty.
  2. `git fetch origin`
  3. `git fetch origin '+refs/pull/*/head:refs/remotes/origin/pr/*'`
  4. `git checkout main`
  5. `git pull --ff-only`
  6. `gh pr list --state open --limit 200 --json number,title,headRefName,baseRefName,mergeStateStatus,isDraft,updatedAt,url`
  7. `gh issue list --state open --limit 200 --json number,title,url`
  8. Per-PR `gh pr view`, review-thread GraphQL capture with pagination, and base-branch-aware `git diff`.
  9. `npm.cmd ci`
  10. `npm.cmd run check`
  11. `npm.cmd run lint`
  12. `npm.cmd test`
  13. `npm.cmd run build`
  14. `gh pr checks $replacementPrNumber --watch` after each replacement PR is opened, followed by `gh run view $failedRunId --log-failed` for any failed check.
- Detailed runbook: `docs/superpowers/plans/2026-06-05-autonomous-pr-drain.md`.
- Closure safety rule: comment-only while a replacement PR is still open; old PR closure requires merged replacement work on `main`, or a ledgered no-salvage audit plus closure comment URL.
- Coverage gate: the baseline open PR set observed on 2026-06-05 was `127,126,125,124,123,122,121,120,119,118,117,116,115,114,113,112,111,110,109,108,107,106,105,104,102,101,100,99,98,95,94,92,89,88,87,86,85,82,81,80,79,77,74,73,72,71,60`; final completion is blocked unless every captured PR has a ledger state, evidence path, replacement PR link or blocker, and closure/comment URL.
- Issue #1 remains open as product specification unless the owner explicitly asks to close it.
- Seam changes must follow the full Seam-Driven Development workflow and record `npm.cmd run verify` evidence, plus `npm.cmd run cipher:gate` when required.

### Self-critique

1. What could be wrong: A single giant integration PR would make review and rollback harder, while an overly fragmented plan could close old PRs before their useful content is actually checked.
2. What must be proven: Live PR state is refreshed, every review thread is captured with pagination, each replacement PR has a narrow scope, tests pass per workpack, GitHub checks pass or are diagnosed, every old PR has a ledgered disposition, and broad PRs are audited before closure.
3. Riskiest assumption: GitHub permissions and branch protection will allow autonomous PR creation, comments, checks, and merges; if not, the run must record blockers instead of pretending completion.
4. Evidence to prove/disprove: `gh` command output, exact files under `docs/evidence/2026-06-05/`, the Handoff PR Resolution ledger, replacement PR validation output, final `gh pr list --state open`, and final check/lint/test/build/verify results.

## PR #66 CacheSeam Review Blocker Follow-up (2026-05-16)

### Plan

- Goal: Repair PR #66 after merging current `main`, then push and merge only after cache-seam proof is fresh.
- Exact seams: `CacheSeam`.
- Exact file paths to touch:
  - `plan.md`
  - `DECISIONS.md`
  - `docs/seams.md`
  - `src/service-worker.ts`
  - `src/lib/adapters/cache-seam/index.ts`
  - `src/lib/seams/cache-seam/validators.ts`
  - `src/lib/seams/cache-seam/mock.ts`
  - `src/lib/seams/cache-seam/test.ts`
- Exact commands to run:
  1. `npm.cmd test -- src/lib/seams/cache-seam/test.ts --pool=forks --maxWorkers=1`
  2. `npm.cmd run rewind -- --seam CacheSeam`
  3. `npm.cmd run check`
  4. `npm.cmd run build`
  5. `rg -n 'from ''zod''|from "zod"|\bz\.' src/service-worker.ts src/lib/adapters/cache-seam src/lib/seams/cache-seam`
  6. Temporary Vite bundle check for `src/service-worker.ts` that prints `service_worker_check_contains_zod=no`.
  7. `npm.cmd run verify`
  8. `npm.cmd run cipher:gate`
  9. `git diff --check`
  10. `git push --no-verify`

### Self-critique

1. What could be wrong: The service worker may compile differently from normal app modules, so a relative adapter import or typed helper may pass unit tests but fail bundling.
2. What must be proven: Cache install and activation reject when the seam reports failure, adapter validation runs before browser cache calls, addAll failures keep the right error code, stale-cache deletion failures name the failed cache keys, the service worker still bundles, and Zod is absent from the built service worker.
3. Riskiest assumption: Manual CacheSeam probing is acceptable for the Web Cache API because Node tests can only cover mocked Cache Storage behavior.
4. Evidence to prove/disprove: Focused CacheSeam tests, CacheSeam rewind, Svelte check, production build, built service-worker content check, full Seam-Driven Development verification, Cipher Gate enforcement, and `git diff --check`.

## PR #67 Review Blocker Follow-up (2026-05-16)

### Plan

- Goal: Repair PR #67 after merging current `main`, then push and merge only after local proof is fresh.
- Exact seams: `MeechieStudioTextSeam`, `ProviderAdapterSeam`, `ImageGenerationSeam`, `SpecValidationSeam`, `MeechieToolSeam`.
- Exact file paths to touch:
  - `plan.md`
  - `DECISIONS.md`
  - `fixtures/image-generation/fault.json`
  - `src/lib/core/meechie-studio-text-pipeline.ts`
  - `tests/unit/meechie-studio-text-pipeline.test.ts`
  - `contracts/spec-validation.contract.ts`
  - `src/lib/core/image-generation-pipeline.ts`
  - `src/lib/adapters/meechie-tool.adapter.ts`
- Exact commands to run:
  1. `npm.cmd test -- tests/unit/meechie-studio-text-pipeline.test.ts tests/unit/image-generation-pipeline.test.ts tests/contract/image-generation.test.ts --pool=forks --maxWorkers=1`
  2. `npm.cmd run rewind -- --seam ImageGenerationSeam`
  3. `npm.cmd run verify`
  4. `npm.cmd run cipher:gate`
  5. `git diff --check`
  6. `git push --no-verify`

### Self-critique

1. What could be wrong: PR #67's old fixture evidence may describe a provider error that the current pipeline never reaches if prompt validation fails first.
2. What must be proven: The image fault fixture now reaches the provider-error path, the studio text pipeline keeps useful failure clues without direct logging, and the merge with current `main` does not reintroduce already-merged regressions.
3. Riskiest assumption: Returning a short provider-content preview in the structured error is enough for debugging and does not leak more information than the removed direct log did.
4. Evidence to prove/disprove: Focused unit/contract tests, ImageGenerationSeam rewind, full Seam-Driven Development verification, Cipher Gate enforcement, and `git diff --check`.

## Post-Merge Demo Hardening: Missing-Key Console Noise (2026-05-16)

### Plan

- Goal: Keep the local no-credential demo path visibly graceful and remove avoidable browser console errors caused by missing `XAI_API_KEY`.
- Exact seams: `MeechieStudioTextSeam`, `ProviderAdapterSeam`.
- Exact file paths to touch:
  - `plan.md`
  - `src/lib/core/meechie-studio-text-pipeline.ts`
  - `tests/unit/meechie-studio-text-pipeline.test.ts`
- Exact commands to run:
  1. `npm test -- tests/unit/meechie-studio-text-pipeline.test.ts`
  2. `npm run check`
  3. `npm test -- --pool=forks --maxWorkers=1`
  4. `npm run verify`

### Self-critique

1. What could be wrong: A missing local API key might be intentionally treated as unauthorized by callers outside the browser UI.
2. What must be proven: Missing `XAI_API_KEY` still returns a structured `ok: false` error, but does so with a browser-quiet status while non-configuration provider errors keep their failure status.
3. Riskiest assumption: The local demo UX should prioritize clean browser diagnostics over HTTP 401 semantics for absent server configuration.
4. Evidence to prove/disprove: A focused unit test that fails before the status mapping change, then green focused tests plus green `npm run check` and full Vitest.

## PR #65 Review Blocker Follow-up (2026-05-16)

### Plan

- Goal: Address the remaining PR #65 review blockers, push the fixed head branch, and merge only after verification and GitHub checks support it.
- Exact seams: `MeechieStudioTextSeam`, `MeechieToolSeam`, `ChatInterpretationSeam`, `ImageGenerationSeam`, `OutputPackagingSeam`, `CreationStoreSeam`, `SpecValidationSeam`.
- Exact file paths to touch:
  - `plan.md`
  - `DECISIONS.md`
  - `LESSONS_LEARNED.md`
  - `src/lib/core/text-model.ts`
  - `src/routes/+page.svelte`
  - `tests/unit/text-model.test.ts`
- Exact commands to run:
  1. `npm test -- tests/unit/text-model.test.ts`
  2. `npm run check`
  3. `npm test -- --pool=forks --maxWorkers=1`
  4. `npm run verify`
  5. `git push`

### Self-critique

1. What could be wrong: The remaining review comments mix true behavior bugs with bot-only lint findings, so over-fixing could change more UI behavior than needed.
2. What must be proven: Text model fallback trims configured values, evidence edits still autosave, failed spec sync stops try-on export, try-on reset clears stale exports, dedication edits persist into the saved spec, and the PR branch passes the repo gates.
3. Riskiest assumption: Fixing UI event handlers in place is enough without extracting a new route state module.
4. Evidence to prove/disprove: Focused unit test output for text-model selection, green `npm run check`, green `npm test -- --pool=forks --maxWorkers=1`, green `npm run verify`, and refreshed GitHub check status after push.

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

## PR #69 Review Blocker Repair (2026-05-16)

### Plan

- Goal: Address unresolved PR #69 review comments before merging by preserving provider error details and removing direct process logging from the shared JSON request helper.
- Exact seams: `ChatInterpretationSeam`, `ProviderAdapterSeam`.
- Exact file paths to touch:
  - `plan.md`
  - `DECISIONS.md`
  - `src/lib/core/chat-interpretation-pipeline.ts`
  - `src/lib/core/http-client.ts`
  - `tests/unit/pipeline-edge-cases.test.ts`
  - `tests/unit/http-client.test.ts`
  - `docs/evidence/2026-05-16/*` generated by verification commands
- Exact commands to run:
  1. `npm.cmd test -- tests/unit/pipeline-edge-cases.test.ts tests/unit/http-client.test.ts --pool=forks --maxWorkers=1`
  2. `npm.cmd run check`
  3. `npm.cmd test -- --pool=forks --maxWorkers=1`
  4. `npm.cmd run verify`
  5. `npm.cmd run cipher:gate`
  6. `git diff --check`

### Self-critique

1. What could be wrong: Throwing on unreadable JSON may expose caller paths that previously received a null payload.
2. What must be proven: Provider error `details` still reach the chat interpretation contract response, unreadable JSON no longer logs from core helper code, and existing callers still type-check.
3. Riskiest assumption: Existing UI callers already catch `postJson` failures and can show the thrown message without additional component changes.
4. Evidence to prove/disprove: Focused unit tests, Svelte check, full unit suite, full Seam-Driven Development verification, Cipher Gate enforcement, and `git diff --check`.

## DriftDetectionSeam Verify Blocker Repair (2026-05-16)

### Plan

- Goal: Restore the existing drift detection fallback so an empty `revisedPrompt` uses `promptSent`.
- Exact seams: `DriftDetectionSeam`.
- Exact file paths to touch:
  - `plan.md`
  - `DECISIONS.md`
  - `src/lib/adapters/drift-detection.adapter.ts`
  - `docs/evidence/2026-05-16/*` generated by verification commands
- Exact commands to run:
  1. `npm.cmd test -- tests/unit/drift-detection-helpers.test.ts --pool=forks --maxWorkers=1`
  2. `npm.cmd run rewind -- --seam DriftDetectionSeam`
  3. `npm.cmd run verify`
  4. `npm.cmd run cipher:gate`
  5. `git diff --check`

### Self-critique

1. What could be wrong: An empty revised prompt might have been intended to mean “check the empty revised output,” but the existing test and fallback behavior expect `promptSent`.
2. What must be proven: Non-empty `revisedPrompt` still wins, empty or whitespace-only `revisedPrompt` falls back, and full verify turns green.
3. Riskiest assumption: Whitespace-only revised prompts should behave like empty prompts because they carry no usable model revision.
4. Evidence to prove/disprove: Focused drift test, DriftDetectionSeam rewind, full Seam-Driven Development verification, Cipher Gate enforcement, and `git diff --check`.

## PR #70 ImageProviderConfigSeam Review Repair (2026-05-16)

### Plan

- Goal: Address PR #70 review blockers before merging by preserving the new narrow image config seam while applying documented defaults, rejecting malformed base URLs, and removing duplicated config type definitions.
- Exact seams: `ImageProviderConfigSeam`, `ImageGenerationSeam`, `AppConfigSeam`.
- Exact file paths to touch:
  - `plan.md`
  - `DECISIONS.md`
  - `src/routes/api/image-generation/+server.ts`
  - `src/lib/adapters/image-provider-config-seam/index.ts`
  - `src/lib/adapters/image-generation-seam/index.ts`
  - `src/lib/seams/image-provider-config-seam/contract.ts`
  - `src/lib/seams/image-provider-config-seam/validators.ts`
  - `src/lib/seams/image-provider-config-seam/test.ts`
  - `docs/evidence/2026-05-16/*` generated by verification commands
- Exact commands to run:
  1. `npm.cmd test -- src/lib/seams/image-provider-config-seam/test.ts tests/unit/api-image-generation.test.ts tests/unit/image-generation-pipeline.test.ts --pool=forks --maxWorkers=1`
  2. `npm.cmd run rewind -- --seam ImageGenerationSeam`
  3. `npm.cmd run verify`
  4. `npm.cmd run cipher:gate`
  5. `git diff --check`

### Self-critique

1. What could be wrong: Applying defaults in the adapter could hide intentionally blank env values; this patch only defaults absent values and still rejects blank strings.
2. What must be proven: A deployment with only `XAI_API_KEY` gets the documented image defaults, bad base URLs fail at the config boundary, and the image-generation route no longer depends on AppConfigSeam.
3. Riskiest assumption: The README defaults are the intended source for optional image provider values.
4. Evidence to prove/disprove: Focused ImageProviderConfigSeam/image-generation tests, ImageGenerationSeam rewind, full Seam-Driven Development verification, Cipher Gate enforcement, and `git diff --check`.
