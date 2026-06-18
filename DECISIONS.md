<!--
Purpose: Decision log for architecture and process choices.
Why: Preserve rationale and prevent re-litigation.
Info flow: Decision -> consequences -> future changes.
-->
# Decisions

Short, durable decisions with context and tradeoffs.

## 2026-06-07 - Manually integrate PR #114 ordinal and AppConfig parsing cleanup

- Date: 2026-06-07
- Decision: Port PR #114's still-current ordinal formatting and AppConfig integer parsing fixes onto current `main` while leaving stale generate-pipeline, studio-text, and HTTP-client hunks out of this slice.
- Context: PR #114 is dirty against current `main`. The HTTP double-parse/error-policy concern was already salvaged by the HPR HTTP client policy work, and current generate/studio-text pipelines have newer behavior that should not be overwritten. The remaining useful behavior was correct English ordinal suffixes for Meechie lineup positions and safer `MAX_IMAGES_PER_REQUEST` parsing that does not accept whitespace or floats as valid optional integers.
- Alternatives: Merge PR #114 wholesale; rejected because it would reintroduce stale code. Close it without salvage; rejected because the ordinal and integer parsing bugs were still current. Keep formatter logic duplicated in each adapter; rejected because the legacy and self-contained MeechieToolSeam adapters would drift.
- Consequences: `formatOrdinal` is shared by both Meechie tool adapter layouts, 11th/12th/13th and 21st/22nd/23rd display correctly, and `MAX_IMAGES_PER_REQUEST` only accepts integer strings before schema validation handles bounds.
- Revisit criteria: Revisit if AppConfigSeam moves to typed env parsing before adapter construction or if MeechieToolSeam drops the legacy flat adapter.
- Plan:
  - Goal: Manually integrate PR #114's still-current ordinal and AppConfigSeam parsing improvements without regressing current pipeline behavior.
  - Seams: MeechieToolSeam, AppConfigSeam.
  - Files: `plan.md`, `DECISIONS.md`, `src/lib/core/ordinal.ts`, `src/lib/adapters/meechie-tool.adapter.ts`, `src/lib/adapters/meechie-tool-seam/index.ts`, `src/lib/adapters/app-config-seam/index.ts`, `tests/unit/meechie-tool-adapter.test.ts`, `tests/unit/app-config-seam.test.ts`, `tests/unit/ordinal.test.ts`, `src/lib/seams/meechie-tool-seam/test.ts`, `docs/evidence/2026-06-07/pr-114-*.txt`.
  - Commands: `npm.cmd test -- tests/unit/meechie-tool-adapter.test.ts tests/unit/app-config-seam.test.ts tests/unit/ordinal.test.ts src/lib/seams/meechie-tool-seam/test.ts --pool=forks --maxWorkers=1`, `npm.cmd run rewind -- --seam MeechieToolSeam`, `npm.cmd run rewind -- --seam AppConfigSeam`, `npm.cmd run check`, `npm.cmd run lint`, `npm.cmd test -- tests/unit/meechie-tool-adapter.test.ts tests/unit/meechie-tool-adapter.responses.test.ts tests/contract/meechie-tool.test.ts tests/unit/app-config-seam.test.ts tests/unit/ordinal.test.ts src/lib/seams/meechie-tool-seam/test.ts --pool=forks --maxWorkers=1`, `git diff --check`.
- Self-critique: The riskiest assumption is that malformed optional integer strings should default instead of hard-fail; this matches the existing non-numeric default behavior while still allowing schema validation to reject integer strings outside the configured range.

- Cipher Gate:
  - Date: 2026-06-07
  - Seams: MeechieToolSeam, AppConfigSeam
  - Evidence: docs/evidence/2026-06-07/pr-114-focused-tests.txt; docs/evidence/2026-06-07/pr-114-check.txt; docs/evidence/2026-06-07/pr-114-lint.txt; docs/evidence/2026-06-07/pr-114-rewind-MeechieToolSeam.txt; docs/evidence/2026-06-07/pr-114-rewind-AppConfigSeam.txt; docs/evidence/2026-06-07/pr-114-impact-tests.txt; docs/evidence/2026-06-07/pr-114-diff-check.txt
  - Summary: Added shared ordinal formatting for both Meechie tool adapter layouts and tightened AppConfigSeam optional integer parsing before schema validation.
  - Risks: `npm run verify` and a direct full-suite `npm test -- --pool=forks --maxWorkers=1` timed out locally after partial green output, so final merge should rely on CI for full-suite confirmation while this slice uses focused, seam rewind, check, lint, impact-test, and diff-check evidence.

## 2026-06-06 - PR #127 reviews resolution & canonical seam migration

- Date: 2026-06-06
- Decision: Extract duplicate Meechie voice pack literal into a shared module, update forbidden token check to use RegExp word boundaries (`\b`), normalize styleHint in prompt assembly, and switch all pipeline imports to use the self-contained canonical adapters. Document the pure compiler exception for `PromptCompilerSeam` mock dynamic compilation.
- Context: Outstanding review comments on PR #127 required fixing potential false positives in drift detection, stripping markdown fences in tool responses, and extraction of the huge duplicate voice pack. The review also highlighted that migrated self-contained seams were bypassed at runtime because the legacy flat adapters were still imported.
- Alternatives: Keep dynamic logic out of the PromptCompilerSeam mock and use static fixtures. However, this causes integration tests to falsely pass when inputs are dropped. Since PromptCompilerSeam is a pure compiler with no external I/O or state, allowing dynamic mock compilation is a safe and necessary exception to strict fixture-only mocking.
- Consequences: Shared voice pack is extracted, reducing duplication and preventing divergence. Harmless substrings (e.g., "lifestyle") are no longer false positives in drift detection. Pipelines now run on the canonical self-contained seams.
- Revisit criteria: Revisit if the compiler logic changes or if further flat seams are migrated.

- Cipher Gate:
  - Date: 2026-06-06
  - Seams: MeechieVoiceSeam, DriftDetectionSeam, PromptAssemblySeam, PromptCompilerSeam, MeechieToolSeam, SpecValidationSeam
  - Evidence: docs/evidence/2026-06-06/npm-verify-pr-127-resolution.txt
  - Summary: Extracted Meechie voice pack to shared module, added word-boundary check for forbidden tokens, normalized styleHint in legacy prompt-assembly adapter, tightened legacy meechie-tool adapter toolId union types, and wired all newly migrated canonical self-contained seams into production pipelines. Documented PromptCompilerSeam exception allowing dynamic mock interpolation.
  - Risks: PromptCompilerSeam mock uses dynamic logic rather than hardcoded fixture loading to prevent falsely passing integration test cases that drop compiler inputs. This is documented as a pure-compiler exception to the strict fixture-mock rule.

## 2026-06-05 - HPR HTTP client structured error policy

- Date: 2026-06-05
- Decision: Change the shared browser `postJson` helper to parse response text once, return parsed JSON for non-2xx contract responses, return `undefined` for `204`, `205`, and empty successful bodies, and throw URL/status/status-text/parse-reason errors for invalid or empty failure bodies.
- Context: Multiple open PRs attempted `postJson` or `response.ok` cleanup but risked losing structured API error payloads. The app intentionally returns contract-shaped JSON such as `{ ok: false, error: ... }` on non-2xx statuses, so the client helper must preserve that body instead of converting it to an exception.
- Alternatives: Keep throwing on every non-OK response after parsing, or move special-case logic into each caller. Throwing masks contract payloads; caller-specific handling would duplicate policy and invite drift.
- Consequences: API callers can inspect structured non-2xx payloads consistently, no-content responses are safe, and malformed provider/proxy responses still fail loudly with actionable diagnostics.
- Revisit criteria: Revisit if API routes stop using contract-shaped non-2xx JSON or if callers need a typed `HttpError` object instead of `Error` messages for malformed responses.

- Cipher Gate:
  - Date: 2026-06-05
  - Seams: ProviderAdapterSeam, ChatInterpretationSeam, MeechieToolSeam, MeechieStudioTextSeam, ImageGenerationSeam
  - Evidence: docs/evidence/2026-06-05/hpr-http-error-policy-red-http-client-threads.txt; docs/evidence/2026-06-05/hpr-http-error-policy-green-http-client-threads.txt; docs/evidence/2026-06-05/hpr-http-error-policy-targeted-forks.txt; docs/evidence/2026-06-05/hpr-http-error-policy-check.txt; docs/evidence/2026-06-05/hpr-http-error-policy-lint.txt; docs/evidence/2026-06-05/hpr-http-error-policy-test.txt; docs/evidence/2026-06-05/hpr-http-error-policy-build.txt; docs/evidence/2026-06-05/hpr-http-error-policy-verify-long.txt
  - Summary: Locked the central `postJson` policy with red/green tests so structured non-2xx JSON payloads survive, `204`/`205` and empty successful bodies return `undefined`, and invalid/empty failure bodies produce rich diagnostics.
  - Risks: Some UI callers may still assume `postJson` rejects on all non-2xx responses; targeted chat/tools tests passed, and broader caller behavior remains covered by later generate/UI workpacks.

## 2026-05-15 — CacheSeam: Route Service Worker Cache I/O Through Approved Seam Adapter

- Cipher Gate:
  - Date: 2026-05-15
  - Seams: CacheSeam
  - Evidence: src/lib/seams/cache-seam/test.ts (9 contract tests), src/lib/adapters/cache-seam/index.ts
  - Summary: Replaced direct `caches.*` calls in `src/service-worker.ts` with a new `CacheSeam` (contract + mock + validators + fixtures + probe + tests + adapter). The service worker now imports `createCacheSeam()` from the adapter and calls `primeCache`, `evictStaleCaches`, and `matchRequest`. Functional behavior is unchanged; only the I/O boundary is now behind a contract. Probe is manual (browser DevTools) because the Web Cache API cannot be exercised in Node.js CI.
  - Risks: Service worker build with relative import (`./lib/adapters/cache-seam/index`) must be validated by `npm run build`. If Vite's SW bundler cannot resolve the import, the fallback is to inline the adapter logic back into service-worker.ts (a known escape hatch documented in probe.ts).

**Context**: `src/service-worker.ts` directly called `caches.open()`, `caches.keys()`, `caches.delete()`, and `caches.match()` in violation of the SDD mandate that all I/O must flow through approved seam adapters. The TODO comment was the only acknowledgement.

**Decision**: Introduce `CacheSeam` as a self-contained seam under `src/lib/seams/cache-seam/`. The contract exposes three operations matching the three service worker lifecycle events: `primeCache` (install), `evictStaleCaches` (activate), `matchRequest` (fetch). The adapter wraps the Web Cache API with `Result<>` error handling. The mock uses an in-memory Map for deterministic unit tests.

**Rationale**: The Web Cache API is a stable browser platform API with no Node.js equivalent. The seam provides a contract boundary for future testing (e.g., Playwright PWA tests) without changing observable behavior. Using `Result<>` makes cache failures explicit rather than silently swallowed.

**Files added**: `src/lib/seams/cache-seam/{contract,fixtures,validators,mock,probe,test}.ts`, `src/lib/adapters/cache-seam/index.ts`

**Files modified**: `src/service-worker.ts` (import + use seam), `docs/seams.md` (registry entry)
## 2026-05-16 — Split AppConfigSeam: Introduce ImageProviderConfigSeam

**Context**: The image-generation route (`/api/image-generation`) depended on `AppConfigSeam` via `createAppConfigSeam()`. `AppConfigSeam` validates all config including `XAI_TEXT_MODEL`, `GEMINI_API_KEY`, and other unrelated keys. If any of those are absent, the image-generation endpoint fails at startup even though it only needs 4 image-provider env keys.

The 2026-05-10 decision explicitly flagged this: "Revisit if xAI config keys are split into a narrower image-provider config seam."

**Decision**: Extract `ImageProviderConfigSeam` — a narrow seam containing only `xaiApiKey`, `xaiImageModel`, `xaiBaseUrl`, and `xaiImageEndpointPath`. Wire `ImageGenerationSeam` adapter to depend on `ImageProviderConfigSeam` instead of `AppConfigSeam`. Update the image-generation route to use `createImageProviderConfigSeam()`. `AppConfigSeam` is unchanged and still used by `wig-try-on` and other routes that need the full config.

**Rationale**:
- Minimum coupling principle: the image-generation adapter only reads 4 env vars; it should declare only those as dependencies
- Startup resilience: a deployment with only `XAI_IMAGE_*` keys configured (no text model, no Gemini) can now serve image generation without a config error
- Follows existing self-contained seam layout; full Seam-Driven Development workflow applied (contract → probe → fixtures → mock → test → adapter)

**Files added**:
- `src/lib/seams/image-provider-config-seam/contract.ts`
- `src/lib/seams/image-provider-config-seam/validators.ts`
- `src/lib/seams/image-provider-config-seam/fixtures.ts`
- `src/lib/seams/image-provider-config-seam/mock.ts`
- `src/lib/seams/image-provider-config-seam/test.ts`
- `src/lib/seams/image-provider-config-seam/probe.ts`
- `src/lib/adapters/image-provider-config-seam/index.ts`

**Files modified**:
- `src/lib/adapters/image-generation-seam/index.ts` — changed `AppConfigSeam` dep to `ImageProviderConfigSeam`
- `src/routes/api/image-generation/+server.ts` — use `createImageProviderConfigSeam()`, removed TODO
- `docs/seams.md` — added `ImageProviderConfigSeam` entry
- `src/lib/seams/CLAUDE.md` — added to current seams table

- Cipher Gate:
    Date: 2026-05-16
    Seams: ImageProviderConfigSeam, ImageGenerationSeam, AppConfigSeam
    Evidence: pending — ImageProviderConfigSeam is env-var-only (N/A probe); ImageGenerationSeam probe still blocked (no XAI_API_KEY). Contract tests pass locally under npm test.
    Summary: Extracted ImageProviderConfigSeam from AppConfigSeam to narrow the image-generation route's config dependency to the 4 xAI image-provider env keys. AppConfigSeam is unmodified.
    Risks: If a new image-generation config key is added to AppConfigSeam in future, developers must remember to add it to ImageProviderConfigSeam as well. Mitigated by the seam registry and contract tests.

- Assumption (historical note):
    Date: 2026-05-16
    Seams: ImageProviderConfigSeam
    Statement: The 4 image-provider keys (XAI_API_KEY, XAI_IMAGE_MODEL, XAI_BASE_URL, XAI_IMAGE_ENDPOINT_PATH) are the complete set needed by the ImageGenerationSeam adapter. No other env var will be needed without a contract update.
    Validation: Verified by reading the ImageGenerationSeam adapter source — only these 4 keys are accessed from config.
    Status: Confirmed by code inspection; no live probe required for a config-only seam.

## 2026-05-11 — Wig Try-On Feature: Seam-Driven Development Architecture

**Context**: Add a wig try-on feature integrated into the coloring book experience. Users browse a static affiliate wig catalog, upload a selfie, and receive an AI-illustrated portrait showing themselves wearing the selected wig. The portrait style matches the coloring-book aesthetic.

**Decision**: Build two new seams following Seam-Driven Development conventions — WigCatalogSeam (reads static data, no I/O) and WigTryOnSeam (calls Gemini 2.0 Flash image generation API). One new API route `/api/wig-try-on` orchestrated by `wig-try-on-pipeline.ts`. UI integrated into `+page.svelte` as a new "Style Your Look" section below the workbench.

**Rationale**:
- WigCatalogSeam is pure (static JSON import) — no external I/O, instant, testable
- WigTryOnSeam uses Gemini 2.0 Flash (`gemini-2.0-flash-preview-image-generation`) because: (a) existing `GEMINI_API_KEY` in env, (b) model accepts multi-image input (selfie + product photo) and generates illustrated output, (c) ~$0.04–0.06/call competitive with alternatives, (d) illustrated style pairs naturally with the downstream Grok coloring-page step
- Affiliate-first monetization: catalog links to Beautyforever, Wigsbuy, Luvmehair with UTM tracking. Zero inventory, zero fulfillment, live immediately
- `geminiApiKey` added to `AppConfigSeam` with `z.string().default('')` (not `min(1)`) so existing deployments without `GEMINI_API_KEY` set do not fail at startup — the error surfaces at runtime as `WIG_TRY_ON_CONFIG_ERROR`
- Try-on is optional — if user does not select a wig, the generate flow is unchanged. If a wig is selected, its name/style is appended to `currentStyleHint()` to influence the coloring-page prompt

**Files added**:
- `src/lib/data/wigs.json` — static catalog (8 wigs, 3 affiliate programs)
- `src/lib/seams/wig-catalog-seam/` — contract / fixtures / mock / probe / test / validators
- `src/lib/seams/wig-try-on-seam/` — contract / fixtures / mock / probe / test / validators
- `src/lib/adapters/wig-catalog-seam/index.ts` — reads wigs.json, per-request instantiation
- `src/lib/adapters/wig-try-on-seam/index.ts` — Gemini multi-image API, per-request instantiation
- `src/lib/core/wig-try-on-pipeline.ts` — orchestrates catalog lookup + image fetch + Gemini call
- `src/routes/api/wig-try-on/+server.ts` — thin handler, injects seams per request
- `src/lib/components/WigCarousel.svelte` — horizontal scrollable wig picker with affiliate links
- `src/lib/components/SelfieUpload.svelte` — file input with base64 conversion and preview
- `contracts/wig-try-on.contract.ts` — API request/response schema

**Files modified**:
- `src/lib/seams/app-config-seam/contract.ts` — added `geminiApiKey: string`, `geminiBaseUrl: string`
- `src/lib/seams/app-config-seam/validators.ts` — added schema fields with safe defaults
- `src/lib/adapters/app-config-seam/index.ts` — reads `GEMINI_API_KEY` and `GEMINI_BASE_URL` from env
- `src/routes/+page.svelte` — added wig try-on section, state, `handleWigTryOn()`, wig-influenced `currentStyleHint()`

**Environment variable required**: `GEMINI_API_KEY` — add to Vercel project settings and `.env.example`


## 2026-05-10 - Fix ImageGenerationSeam dual-system mismatch
- Date: 2026-05-10
- Decision: Add `Result<>` return type to `ImageGenerationSeam`, wire adapter into pipeline, and fix broken import path, null safety on `payload.data`, and separate validation vs config error codes.
- Context: The seam contract used a broken relative import path (`../../../contracts/shared.contract` instead of `../../../../contracts/shared.contract`), causing CI failures. The adapter also lacked null safety on `payload.data` and reused `IMAGE_VALIDATION_ERROR` for both request and config failures.
- Alternatives: Leave the seam disconnected and continue calling the provider adapter directly; this bypasses seam boundaries and prevents proper test interception.
- Consequences: `ImageGenerationSeam` now returns `Result<>` on all code paths, config errors use the distinct `IMAGE_CONFIG_ERROR` code, and `vi.mock` paths in tests use `$lib/` alias for correct interception.
- Revisit criteria: Revisit if xAI config keys are split into a narrower image-provider config seam.

- Cipher Gate:
    Date: 2026-05-10
    Seams: ImageGenerationSeam
    Evidence: pending — verify pipeline requires XAI_API_KEY not available in this environment
    Summary: Added Result<> type to ImageGenerationSeam, wired into pipeline. Fixed broken import path, null safety on payload.data, separated validation vs config error codes.
    Risks: Cannot produce live probe evidence without XAI_API_KEY.

## 2026-05-09 - Svelte 5 runes migration of +page.svelte
- Date: 2026-05-09
- Decision: Migrate `src/routes/+page.svelte` from Svelte 4 legacy reactive syntax (`$:`, `on:event`) to Svelte 5 runes (`$state`, `$derived`, `onclick`). This is a zero-seam, zero-behavior-change refactoring.
- Context: The project targets Svelte 5 (`^5.53.0`) and the layout already uses runes (`$props`, `{@render}`). The main page remained on legacy `$:` reactive declarations. In runes mode, `$:` is forbidden; mixing it with `$state` is a compile error. Migrating now prevents subtle ordering issues with legacy reactivity and removes all deprecation risk.
- Alternatives: Leave in legacy mode (Svelte 5 supports it indefinitely but accumulates divergence) or wrap individual declarations in `$effect` (less idiomatic for derived values).
- Consequences: All 9 `$:` reactive declarations replaced by `$derived`; 26 mutable state variables wrapped in `$state`; 18 `on:event` directives updated to Svelte 5 `onevent` syntax. No runtime behavior change. `svelte-check` now shows 0 warnings on this file.
- Revisit criteria: If future Svelte versions change runes semantics, re-evaluate deep binding behavior for the `voice` object.

## 2026-05-02 - Meechie studio AI text seam and redesign
- Date: 2026-05-02
- Decision: Add `MeechieStudioTextSeam` for AI-backed verdict, quote, and coloring-page text actions, then redesign the home page around the Meechie studio flow with cost metadata and a default three-action AI text budget.
- Context: The prior deterministic Meechie tools could not represent regenerate, make prettier, make meaner, and make more specific without overloading unrelated tool IDs; the product needed real AI wording while keeping local export, copy, theme, page-size, border, glitter, and vault controls outside the text budget.
- Alternatives: Reuse `MeechieToolSeam` templates for all wording actions or add ad hoc client-only prompts; both would either keep creative output hard-coded or bypass Seam-Driven Development evidence.
- Consequences: Studio wording now flows through `ProviderAdapterSeam` behind a dedicated contract, tests use injected provider fixtures, and the home page has explicit `free`/`unclassified` control metadata for future pricing gates.
- Revisit criteria: Revisit if pricing rules are finalized, if text actions need per-user limits, or if provider output should tolerate non-JSON wrappers.
- Plan:
  - Goal: Build a branded Meechie coloring-page studio with AI text actions, eight modes, local exports, and budget guardrails.
  - Seams: MeechieStudioTextSeam, ProviderAdapterSeam, SpecValidationSeam, ImageGenerationSeam, OutputPackagingSeam, CreationStoreSeam, SessionSeam.
  - Files: `contracts/meechie-studio-text.contract.ts`, `fixtures/meechie-studio-text/`, `src/lib/mocks/meechie-studio-text.mock.ts`, `src/lib/adapters/meechie-studio-text.adapter.ts`, `src/lib/core/meechie-studio.ts`, `src/lib/core/meechie-studio-text-pipeline.ts`, `src/routes/api/meechie-studio-text/+server.ts`, `src/routes/+page.svelte`, `docs/seams.md`, `DECISIONS.md`, `tests/contract/meechie-studio-text.test.ts`, `tests/unit/meechie-studio.test.ts`, `tests/unit/meechie-studio-text-pipeline.test.ts`, `static/meechie/`.
  - Commands: `git diff --check`, `npm run check`, `npm test`, `npm run verify`, `npm run cipher:gate`.
- Self-critique: The riskiest assumption is that strict JSON-only text responses are acceptable for provider reliability; the evidence is the pipeline contract test and the clear provider-invalid error path. The UI risk is page density; browser smoke checks should verify no preview obstruction before merge.

- Cipher Gate:
  - Date: 2026-05-02
  - Seams: MeechieStudioTextSeam, ProviderAdapterSeam, SpecValidationSeam, ImageGenerationSeam, OutputPackagingSeam, CreationStoreSeam, SessionSeam
  - Evidence: docs/evidence/2026-05-02/test.txt; docs/evidence/2026-05-02/verify.txt; docs/evidence/2026-05-02/chamber-lock.json; docs/evidence/2026-05-02/shaolin-lint.json; docs/evidence/2026-05-02/assumption-alarm.json; docs/evidence/2026-05-02/seam-ledger.json; docs/evidence/2026-05-02/clan-chain.json; docs/evidence/2026-05-02/proof-tape.json
  - Summary: Added AI-backed studio text seam, fixture-backed tests, cost/budget metadata, selected Meechie static assets, and a redesigned studio UI that keeps local actions outside the AI text budget.
  - Risks: Real text generation depends on `XAI_API_KEY` and strict JSON-only model output; browser visual polish still needs screenshot review on target devices.

## Template
- Date:
- Decision:
- Context:
- Alternatives:
- Consequences:
- Revisit criteria:

## 2026-04-23 - Delegate chat JSON grammar validation to JSON.parse
- Date: 2026-04-23
- Decision: Replace the custom brace scanner in chat interpretation with a parser-based check that trims content, parses once with `JSON.parse`, and accepts only top-level JSON objects.
- Context: Review feedback called out maintenance risk and potential grammar edge-case drift in the hand-rolled scanner implementation.
- Alternatives: Keep the custom scanner and continue maintaining escape/string/depth logic in application code.
- Consequences: JSON grammar validation now relies on the native parser while preserving deterministic rejection of non-object and extra-text payloads.
- Revisit criteria: If we ever need partial extraction from mixed prose+JSON outputs, reintroduce an explicit extractor with contract updates and new fixtures.

- Cipher Gate:
  - Date: 2026-04-23
  - Seams: ChatInterpretationSeam, ProviderAdapterSeam, SpecValidationSeam
  - Evidence: docs/evidence/2026-04-23/test.txt; docs/evidence/2026-04-23/verify.txt; docs/evidence/2026-04-23/chamber-lock.json; docs/evidence/2026-04-23/shaolin-lint.json; docs/evidence/2026-04-23/seam-ledger.json; docs/evidence/2026-04-23/clan-chain.json; docs/evidence/2026-04-23/proof-tape.json; docs/evidence/2026-04-23/assumption-alarm.json
  - Summary: Replaced the hand-rolled JSON scanner with parser-based object validation and expanded chat edge-case tests for non-object payload rejection.
  - Risks: Strict JSON-only enforcement can still reject provider responses that prepend prose despite prompt instructions.

## 2026-04-22 - Enforce strict single-object JSON parsing for chat interpretation
- Date: 2026-04-22
- Decision: Harden chat interpretation parsing to accept exactly one top-level JSON object and reject any extra non-whitespace text before or after the object boundary.
- Context: The prior extraction strategy accepted the first `{` through last `}` substring, which could silently accept narrative wrappers or ambiguous multi-object responses.
- Alternatives: Keep permissive extraction and rely only on stronger prompt wording that requests JSON-only responses.
- Consequences: Chat responses are now deterministically rejected when providers prepend prose, include brace snippets in text, or emit multiple objects; tests were updated to lock this behavior.
- Revisit criteria: If provider behavior requires tolerant parsing for reliability, revisit with an explicit contract change and fixture-backed seam evidence.

- Cipher Gate:
  - Date: 2026-04-22
  - Seams: ChatInterpretationSeam, ProviderAdapterSeam, SpecValidationSeam
  - Evidence: docs/evidence/2026-04-22/test.txt; docs/evidence/2026-04-22/verify.txt; docs/evidence/2026-04-22/chamber-lock.json; docs/evidence/2026-04-22/shaolin-lint.json; docs/evidence/2026-04-22/seam-ledger.json; docs/evidence/2026-04-22/clan-chain.json; docs/evidence/2026-04-22/proof-tape.json; docs/evidence/2026-04-22/assumption-alarm.json
  - Summary: Replaced loose brace slicing with strict single-object boundary parsing, added edge-case tests for braces-in-text and multi-object payloads, and aligned chat pipeline tests to JSON-only provider output.
  - Risks: Some providers may still emit non-JSON wrappers despite prompt instructions, increasing rejection rate until upstream behavior is fully aligned.

## 2026-02-15 - Extract chat/tools pipelines, retire ghost workflow, and refresh seam governance
- Date: 2026-02-15
- Decision: Extract `/api/chat-interpretation` and `/api/tools` orchestration into core pipeline modules, keep route handlers transport-thin, remove the unused legacy workflow/composition path, and update seam inventory coverage for seam modules under `src/lib/seams/`.
- Context: Route handlers were carrying orchestration logic directly, behavior was harder to test in isolation, and the repo retained a dead legacy workflow path (`generation-workflow.ts`) that no active route consumed.
- Alternatives: Keep orchestration inline in route files and leave the legacy workflow/composition modules in place for hypothetical future use.
- Consequences: Chat/tools behavior is centralized in testable pipeline modules; active runtime flow is clearer; legacy workflow dead code is removed; seam inventory explicitly covers PromptCompilerSeam/SafetyPolicySeam/GalleryStoreSeam/TelemetrySeam as contract-level modules.
- Revisit criteria: If a future product flow needs those seam modules at runtime, reintroduce composition wiring from current route pipelines rather than restoring the retired legacy workflow.

- Cipher Gate:
  - Date: 2026-02-15
  - Seams: ChatInterpretationSeam, MeechieToolSeam, PromptCompilerSeam, SafetyPolicySeam, GalleryStoreSeam, TelemetrySeam, ProviderAdapterSeam, SpecValidationSeam
  - Evidence: docs/evidence/2026-02-15/test.txt; docs/evidence/2026-02-15/verify.txt; docs/evidence/2026-02-15/chamber-lock.json; docs/evidence/2026-02-15/shaolin-lint.json; docs/evidence/2026-02-15/seam-ledger.json; docs/evidence/2026-02-15/clan-chain.json; docs/evidence/2026-02-15/proof-tape.json; docs/evidence/2026-02-15/assumption-alarm.json
  - Summary: Added `chat-interpretation` and `tools` core pipelines, converted both API routes to wrappers, removed unused legacy workflow/composition modules, and updated seam inventory documentation.
  - Risks: Behavior-preserving extraction still depends on existing status-code conventions (several error responses intentionally stay HTTP 200 for contract compatibility); retired legacy runtime path would need fresh composition if revived.

## 2026-02-14 - Stabilize adapter rules and reduce architecture drift
- Date: 2026-02-14
- Decision: Centralize shared prompt/safety/chat constants, remove arbitrary client-side chat blocking, and decouple ProviderAdapterSeam from SvelteKit env imports by using injected/process config.
- Context: Audit findings showed rule duplication, framework coupling in provider adapter, and brittle preflight filtering in chat interpretation.
- Alternatives: Keep per-file literals and env imports; keep the `isFaultMessage` precheck.
- Consequences: Shared constants now reduce drift across seams/routes; provider adapter can be instantiated in isolation; chat interpretation rejects only by contract/server validation.
- Revisit criteria: If we introduce runtime policy/phrase configuration or split legacy/new generation pipelines.

- Cipher Gate:
  - Date: 2026-02-14
  - Seams: ProviderAdapterSeam, ChatInterpretationSeam, PromptCompilerSeam, SafetyPolicySeam, ImageGenerationSeam
  - Evidence: docs/evidence/2026-02-14/test.txt; docs/evidence/2026-02-14/verify.txt; docs/evidence/2026-02-14/chamber-lock.json; docs/evidence/2026-02-14/shaolin-lint.json; docs/evidence/2026-02-14/seam-ledger.json; docs/evidence/2026-02-14/clan-chain.json; docs/evidence/2026-02-14/proof-tape.json; docs/evidence/2026-02-14/assumption-alarm.json
  - Summary: Applied high-ROI repairs: shared constants, prompt-compiler mock alignment, provider config decoupling, and chat gate cleanup.
  - Risks: Legacy and current generation stacks still coexist; full unification remains a separate effort.

## 2026-02-14 - Full UI redesign + core refactor consolidation
- Date: 2026-02-14
- Decision: Ship a full visual/copy redesign while extracting generate orchestration into a core pipeline, centralizing prompt line builders, and unifying client request helpers with API-key header flow.
- Context: The UI needed a full quality reset for the intended audience, and the codebase had technical debt from route-level orchestration and duplicated prompt/fetch logic.
- Alternatives: Keep incremental CSS tweaks only; leave orchestration in route handlers; keep duplicated prompt/fetch helpers.
- Consequences: UI is now cleaner and more opinionated; `/api/generate` is thinner; prompt wording drift risk is reduced; API key behavior is now consistent across builder and Meechie tools.
- Revisit criteria: If generation orchestration grows again, move pipeline dependencies into explicit composition wiring.

- Cipher Gate:
  - Date: 2026-02-14
  - Seams: MeechieVoiceSeam, MeechieToolSeam, PromptAssemblySeam, DriftDetectionSeam, ImageGenerationSeam
  - Evidence: docs/evidence/2026-02-14/test.txt; docs/evidence/2026-02-14/verify.txt; docs/evidence/2026-02-14/chamber-lock.json; docs/evidence/2026-02-14/shaolin-lint.json; docs/evidence/2026-02-14/seam-ledger.json; docs/evidence/2026-02-14/clan-chain.json; docs/evidence/2026-02-14/proof-tape.json; docs/evidence/2026-02-14/assumption-alarm.json
  - Summary: Delivered a full UI overhaul, refreshed Meechie voice output/fixtures, extracted generate pipeline logic, centralized prompt template helpers, and unified client request plumbing.
  - Risks: Voice copy remains manual and requires fixture sync discipline; image generation still depends on external provider availability.

## 2026-02-12 - Add MeechieVoiceSeam voice pack
- Date: 2026-02-12
- Decision: Add MeechieVoiceSeam and route MeechieToolSeam through a voice pack to centralize editable copy and templates.
- Context: Meechie tool responses were embedded directly in the tool adapter, making edits harder and mixing copy with logic.
- Alternatives: Keep copy embedded in MeechieToolSeam or move it into ad hoc constants without a seam contract.
- Consequences: Voice copy now lives behind a seam with fixtures and contract tests; updates require fixture sync and verification.
- Revisit criteria: If we add multiple selectable voices or move voice packs to a user-managed store.

- Cipher Gate:
  - Date: 2026-02-12
  - Seams: MeechieVoiceSeam, MeechieToolSeam
  - Evidence: docs/evidence/2026-02-12/npm-test.txt; docs/evidence/2026-02-12/npm-verify.txt; docs/evidence/2026-02-12/chamber-lock.json; docs/evidence/2026-02-12/shaolin-lint.json; docs/evidence/2026-02-12/seam-ledger.json; docs/evidence/2026-02-12/clan-chain.json; docs/evidence/2026-02-12/proof-tape.json; docs/evidence/2026-02-12/assumption-alarm.json; docs/evidence/2026-02-12/verify.txt; docs/evidence/2026-02-12/test.txt
  - Summary: Added MeechieVoiceSeam with a fixture-backed voice pack and refactored MeechieToolSeam to read from it.
  - Risks: Voice pack edits must keep fixtures in sync to avoid contract drift.

## 2026-02-11 - Normalize xAI base URL usage and model config
- Date: 2026-02-11
- Decision: Normalize `XAI_BASE_URL` inside ProviderAdapterSeam to avoid double `/v1`, read `XAI_IMAGE_MODEL` in the `/api/image-generation` route, and align AppConfig seam defaults to base `https://api.x.ai` with endpoint `/v1/images/generations`.
- Context: The sample base URL included `/v1`, causing `/v1/v1` in ProviderAdapterSeam; the image route hardcoded the model and could drift from environment config.
- Alternatives: Keep the existing base URL and document the required format; hardcode the model permanently in the route.
- Consequences: ProviderAdapterSeam now tolerates base URLs that include `/v1`; image-generation route follows environment configuration; fixtures reflect the normalized defaults.
- Revisit criteria: If xAI changes the base URL pattern or the route is fully replaced by seam-based config.

- Cipher Gate:
  - Date: 2026-02-11
  - Seams: ProviderAdapterSeam, ImageGenerationSeam, AppConfigSeam
  - Evidence: docs/evidence/2026-02-11/npm-test.txt; docs/evidence/2026-02-11/npm-verify.txt; docs/evidence/2026-02-11/probe-provider-adapter.txt; docs/evidence/2026-02-11/probe-image-generation.txt; docs/evidence/2026-02-11/chamber-lock.json; docs/evidence/2026-02-11/shaolin-lint.json; docs/evidence/2026-02-11/seam-ledger.json; docs/evidence/2026-02-11/clan-chain.json; docs/evidence/2026-02-11/proof-tape.json; docs/evidence/2026-02-11/assumption-alarm.json; docs/evidence/2026-02-11/verify.txt; docs/evidence/2026-02-11/test.txt
  - Summary: Normalized `XAI_BASE_URL` handling, aligned the image route to `XAI_IMAGE_MODEL`, and refreshed probes/fixtures.
  - Risks: Misconfigured base URLs beyond `/v1` may still require manual correction.

## 2026-02-11 - Switch xAI image model to grok-imagine-image
- Date: 2026-02-11
- Decision: Switch the default xAI image model to `grok-imagine-image`, refresh ProviderAdapterSeam/ImageGenerationSeam probes and fixtures, and move AppConfigSeam fixtures into `fixtures/app-config/` to satisfy chamber lock.
- Context: The new model id was provided and required fresh probes; chamber lock expects seam fixtures in `fixtures/<seam>/`.
- Alternatives: Keep `grok-2-image-1212` until account access is confirmed; keep AppConfigSeam fixtures embedded in TypeScript.
- Consequences: Fixtures now reflect `grok-imagine-image`; AppConfigSeam fixtures are file-backed and align with seam inventory checks.
- Revisit criteria: If xAI deprecates `grok-imagine-image` or AppConfigSeam is migrated to a different seam layout.

- Cipher Gate:
  - Date: 2026-02-11
  - Seams: ImageGenerationSeam, ProviderAdapterSeam, AppConfigSeam
  - Evidence: docs/evidence/2026-02-11/npm-test.txt; docs/evidence/2026-02-11/npm-verify.txt; docs/evidence/2026-02-11/probe-provider-adapter.txt; docs/evidence/2026-02-11/probe-image-generation.txt; docs/evidence/2026-02-11/chamber-lock.json; docs/evidence/2026-02-11/shaolin-lint.json; docs/evidence/2026-02-11/seam-ledger.json; docs/evidence/2026-02-11/clan-chain.json; docs/evidence/2026-02-11/proof-tape.json; docs/evidence/2026-02-11/assumption-alarm.json; docs/evidence/2026-02-11/verify.txt; docs/evidence/2026-02-11/test.txt
  - Summary: Probed `grok-imagine-image`, refreshed provider/image fixtures, and aligned AppConfigSeam fixtures with chamber-lock expectations.
  - Risks: Model availability could change; rerun probes if xAI access or defaults drift.

- Assumption:
  - Date: 2026-02-11
  - Seams: ImageGenerationSeam, ProviderAdapterSeam
  - Statement: The `grok-imagine-image` image model is available to the configured xAI API key and responds at `/v1/images/generations`.
  - Validation: Re-run `node probes/provider-adapter.probe.mjs` and `node probes/image-generation.probe.mjs` with an API key that has access to `grok-imagine-image` and confirm fixtures show ok image output.
  - Status: Validated (evidence: docs/evidence/2026-02-11/probe-provider-adapter.txt; docs/evidence/2026-02-11/probe-image-generation.txt).

## 2026-02-10 - Reconcile origin/main seams and add AI guide
- Date: 2026-02-10
- Decision: Reconcile origin/main seam scaffolding (AppConfig, PromptCompiler, SafetyPolicy, ImageGeneration, GalleryStore, Telemetry) into the local Seam-Driven Development workflow and add an AI assistant guide.
- Context: The remote history introduced a parallel seam scaffolding that needed to be merged with the existing seam-first workflow and governance docs.
- Alternatives: Keep the scaffolding isolated on a separate branch or reapply changes manually instead of merging histories.
- Consequences: The seam artifacts and tests are now aligned in one branch, and the assistant guide documents required workflow steps.
- Revisit criteria: If seam ownership or contract paths change again after a future rebase.

- Cipher Gate:
  - Date: 2026-02-10
  - Seams: AppConfigSeam, PromptCompilerSeam, SafetyPolicySeam, ImageGenerationSeam, GalleryStoreSeam, TelemetrySeam
  - Evidence: docs/evidence/2026-02-10/verify.txt; docs/evidence/2026-02-10/test.txt; docs/evidence/2026-02-10/chamber-lock.json; docs/evidence/2026-02-10/shaolin-lint.json; docs/evidence/2026-02-10/seam-ledger.json; docs/evidence/2026-02-10/clan-chain.json; docs/evidence/2026-02-10/proof-tape.json; docs/evidence/2026-02-10/assumption-alarm.json
  - Summary: Merged the origin/main seam scaffolding into the local workflow, added required file headers, and captured verify/test evidence; added the AI assistant guide.
  - Risks: Future provider changes or missing environment config could require re-probing and fixture refresh.

## 2025-01-22 - Stack choice
- Date: 2025-01-22
- Decision: Use SvelteKit + TypeScript, Vitest, and Playwright.
- Context: Establish a typed web stack with unit/contract tests and browser-level smoke coverage.
- Alternatives: Use a different frontend framework or skip end-to-end testing.
- Consequences: SvelteKit/Vitest/Playwright are baseline dependencies.
- Revisit criteria: If runtime/platform constraints force a framework shift.

## 2025-01-22 - Seam-Driven Development architecture
- Date: 2025-01-22
- Decision: Implement seams for AppConfigSeam, PromptCompilerSeam, SafetyPolicySeam, ImageGenerationSeam, GalleryStoreSeam, and TelemetrySeam with mocks, fixtures, and tests.
- Context: Seam-Driven Development isolates external dependencies and keeps core workflow deterministic.
- Alternatives: Direct integration without seam artifacts.
- Consequences: Every integration must ship contract + mock + test before adapters.
- Revisit criteria: If seam boundaries or ownership change.

## 2025-01-22 - Prompt enforcement strategy
- Date: 2025-01-22
- Decision: Prompt compiler always injects outline-only, no-color constraints plus glam style guidance.
- Context: Enforce coloring-book constraints deterministically even before image generation.
- Alternatives: Trust downstream models to interpret intent without explicit constraints.
- Consequences: Prompt compiler becomes the source of truth for style constraints.
- Revisit criteria: If the canonical prompt format changes.

## 2025-01-22 - Safety policy approach
- Date: 2025-01-22
- Decision: Use rules-based validation in the safety seam with explicit error codes.
- Context: Deterministic checks prevent disallowed content with user-friendly errors.
- Alternatives: Use model-based moderation or softer validation.
- Consequences: Safety policy must stay in sync with validation rules.
- Revisit criteria: If policy requirements or compliance rules change.

## 2025-01-22 - xAI image model configuration
- Date: 2025-01-22
- Decision: Default to `grok-2-image` with base URL `https://api.x.ai/v1` and endpoint path `/images/generations`; model is environment-configurable.
- Context: These values came from xAI image generation docs at the time.
- Alternatives: Hardcode values or use a different provider.
- Consequences: Environment variables control provider settings; defaults may need updates.
- Revisit criteria: If xAI model ids or endpoints change.

## 2025-01-22 - Integration test gating
- Date: 2025-01-22
- Decision: Integration tests run only when `FEATURE_INTEGRATION_TESTS=true` and `XAI_API_KEY` is present.
- Context: Prevent external API calls during default offline runs.
- Alternatives: Always run integration tests or remove gating entirely.
- Consequences: Integration coverage depends on explicit opt-in.
- Revisit criteria: If CI should always run integration coverage.

## 2026-02-05 - Browser seam probe with Playwright
- Date: 2026-02-05
- Decision: Add a Playwright-based browser probe to capture localStorage-backed seams (Session/AuthContext/CreationStore).
- Context: These seams depend on real browser storage APIs that are not available in Node-only probes.
- Alternatives: Use jsdom with a storage shim, or manually maintain fixtures without probing.
- Consequences: Adds a Playwright dev dependency and requires a local browser install for probe runs.
- Revisit criteria: If a lighter-weight browser runner provides the same localStorage fidelity.

- Cipher Gate:
  - Date: 2026-02-05
  - Seams: AuthContextSeam, CreationStoreSeam, SessionSeam
  - Evidence: docs/evidence/2026-02-05/probe-browser-seams.txt; docs/evidence/2026-02-05/rewind-auth-context-seam.txt; docs/evidence/2026-02-05/rewind-creation-store-seam.txt; docs/evidence/2026-02-05/rewind-session-seam.txt; docs/evidence/2026-02-05/npm-test.txt; docs/evidence/2026-02-05/npm-verify.txt
  - Summary: Ran browser seam probes, refreshed localStorage-backed fixtures, and verified contract/test coverage for Session/AuthContext/CreationStore.
  - Risks: Probe output depends on Playwright and localStorage keys; changes in browser storage behavior require probe updates.

## 2026-01-26 - Add AI agent reference notes to AGENTS.md
- Date: 2026-01-26
- Decision: Add a short AI agent reference notes section to `AGENTS.md` pointing to sources of truth, naming rules, and evidence locations.
- Context: The user requested concise notes an AI coding agent can rely on without hunting through multiple files.
- Alternatives: Keep guidance scattered across `AGENTS.md` and rely on the master guide.
- Consequences: `AGENTS.md` grows slightly; no behavioral change to workflows.
- Revisit criteria: If the reference notes become too long or duplicate the master guide.
- Plan:
  - Goal: Add an AI reference section that summarizes sources of truth and evidence locations.
  - Files: `AGENTS.md`, `DECISIONS.md`.
  - Rule change: Governance guidance now includes an AI agent reference section.
  - Confirm: Docs-only change with zero behavioral impact.
- Self-critique: The risk is duplicating guidance and letting it drift; evidence is the added section in `AGENTS.md`.

## 2026-01-26 - Align probe prompt + required-phrase checks with canonical template
- Date: 2026-01-26
- Decision: Replace the ImageGenerationSeam probe prompt with the compressed canonical prompt and align required-phrase checks to that casing.
- Context: The probe still used the older verbose prompt (triggering a 400 length error), and required-phrase checks expected a lowercase prefix that no longer matches the canonical prompt.
- Alternatives: Keep the verbose prompt and accept probe failure, or make required-phrase checks case-insensitive.
- Consequences: The probe prompt and required-phrase checks now mirror the canonical template; if the template changes, these checks must be updated in lockstep.
- Revisit criteria: If the provider limit changes or a separate compressed provider prompt is introduced.
- Plan:
  - Goal: Align the probe prompt and required-phrase checks with the current canonical template and stay under 1024 characters.
  - Seams: ImageGenerationSeam, DriftDetectionSeam.
  - Files:
    - `probes/image-generation.probe.mjs`
    - `src/lib/adapters/image-generation.adapter.ts`
    - `src/lib/adapters/drift-detection.adapter.ts`
    - `DECISIONS.md`
  - Commands:
    - `npm test`
    - `npm run verify`
- Self-critique: The riskiest assumption is that matching casing is sufficient and won’t miss other required phrase drift; evidence will be the updated fixtures and green contract tests.

- Cipher Gate:
  - Date: 2026-01-26
  - Seams: ImageGenerationSeam
  - Evidence: docs/evidence/2026-01-26/test.txt; docs/evidence/2026-01-26/verify.txt
  - Summary: Aligned the image-generation probe prompt and required-phrase checks to the compressed canonical template to satisfy the 1024 limit.
  - Risks: Phrase checks can drift if the template changes without updating these checks.

## 2026-01-26 - Shorten canonical prompt to fit xAI 1024 limit
- Date: 2026-01-26
- Decision: Rewrite the canonical prompt template to stay under 1024 characters for typical specs and add a prompt-length guard in PromptAssemblySeam.
- Context: xAI image generation rejects prompts longer than 1024 characters; the previous template measured 1523 characters for the sample fixture.
- Alternatives: Keep the full template and add a separate compressed provider prompt, or reduce spec limits (items/labels).
- Consequences: Prompt assembly, drift detection, and fixtures must be updated together; long lists may still exceed the provider limit and will be rejected with a clear error.
- Revisit criteria: If xAI increases the limit or if we add a compressed provider prompt seam output.
- Plan:
  - Goal: Shorten the canonical prompt and enforce a 1024-char limit at prompt assembly.
  - Seams: PromptAssemblySeam, DriftDetectionSeam, ImageGenerationSeam.
  - Files:
    - `src/lib/adapters/prompt-assembly.adapter.ts`
    - `src/lib/adapters/drift-detection.adapter.ts`
    - `fixtures/prompt-assembly/sample.json`
    - `fixtures/prompt-assembly/title-only.json`
    - `fixtures/prompt-assembly/fault.json`
    - `fixtures/drift-detection/sample.json`
    - `fixtures/drift-detection/title-only.json`
    - `fixtures/drift-detection/fault.json`
    - `fixtures/image-generation/sample.json`
    - `fixtures/image-generation/dense-scene.json`
    - `tests/contract/prompt-assembly.test.ts`
    - `CHANGELOG.md`
    - `LESSONS_LEARNED.md`
    - `DECISIONS.md`
  - Commands:
    - `npm test`
    - `npm run verify`
- Self-critique: The riskiest assumption is that the shortened template still enforces all required constraints; evidence is the updated fixtures, drift detection tests, and prompt length measurement (<= 1024).

- Cipher Gate:
  - Date: 2026-01-26
  - Seams: PromptAssemblySeam, DriftDetectionSeam, ImageGenerationSeam
  - Evidence: docs/evidence/2026-01-26/test.txt; docs/evidence/2026-01-26/verify.txt
  - Summary: Shortened the canonical prompt and added a prompt-length guard to stay within the xAI 1024 limit.
  - Risks: Long lists can still exceed 1024; generation will fail fast until inputs are reduced or a compressed provider prompt is added.

## 2026-01-26 - Update xAI image model id to grok-2-image-1212
- Date: 2026-01-26
- Decision: Replace `grok-2-image` with `grok-2-image-1212` as the default image model.
- Context: Model inventory for the account lists `grok-2-image-1212` rather than `grok-2-image`.
- Alternatives: Keep `grok-2-image` until xAI confirms a stable alias.
- Consequences: Probe inputs and fixtures change; image probe may still 404 until access is confirmed.
- Revisit criteria: If the image endpoint remains 404 with the updated model id or xAI deprecates the model.
- Plan:
  - Goal: Update the xAI image model id across adapter, probes, and fixtures.
  - Seams: ProviderAdapterSeam, ImageGenerationSeam.
  - Files:
    - `src/routes/api/image-generation/+server.ts`
    - `probes/provider-adapter.probe.mjs`
    - `probes/image-generation.probe.mjs`
    - `fixtures/provider-adapter/sample.json`
    - `fixtures/provider-adapter/fault.json`
    - `fixtures/image-generation/sample.json`
    - `fixtures/image-generation/dense-scene.json`
  - Commands:
    - `npm test`
    - `npm run verify`
- Self-critique: The riskiest assumption is that `grok-2-image-1212` is accepted by the image endpoint; evidence will be the updated probe outputs and refreshed fixtures once the probe succeeds.

- Cipher Gate:
  - Date: 2026-01-26
  - Seams: ProviderAdapterSeam, ImageGenerationSeam
  - Evidence: docs/evidence/2026-01-25/test.txt; docs/evidence/2026-01-25/verify.txt; docs/evidence/2026-01-25/probe-provider-adapter.txt; docs/evidence/2026-01-25/probe-image-generation.txt
  - Summary: Updated xAI image model id to grok-2-image-1212 in server route, probes, and fixtures.
  - Risks: Image probe remains 404 until xAI image access/endpoint is confirmed.

## 2026-01-26 - Surface image probe error body
- Date: 2026-01-26
- Decision: Log the raw error body from the xAI image endpoint during probes.
- Context: The image probe returns 400 Bad Request without exposing details needed to fix the request.
- Alternatives: Manually re-run curl with the full prompt to capture the body.
- Consequences: Probe output may include large error payloads; no production behavior changes.
- Revisit criteria: Remove extra logging if probes consistently succeed.
- Plan:
  - Goal: Include response body in ImageGenerationSeam probe errors.
  - Seams: ImageGenerationSeam.
  - Files:
    - `probes/image-generation.probe.mjs`
    - `DECISIONS.md`
  - Commands:
    - `npm test`
    - `npm run verify`
- Self-critique: The riskiest assumption is that the endpoint returns a helpful error body; evidence will be the probe output containing the response body.

- Cipher Gate:
  - Date: 2026-01-26
  - Seams: ImageGenerationSeam
  - Evidence: docs/evidence/2026-01-25/test.txt; docs/evidence/2026-01-25/verify.txt; docs/evidence/2026-01-25/probe-image-generation.txt
  - Summary: Updated ImageGenerationSeam probe to surface raw error bodies for 400 responses.
  - Risks: Probe output may be verbose; image generation remains blocked until a successful probe.

## 2026-01-26 - Require plain-language definitions for jargon and flags
- Date: 2026-01-26
- Decision: Add a governance line in `AGENTS.md` requiring brief plain-language definitions when introducing jargon or flags.
- Context: Users asked for jargon and flags to be explained directly in the workflow guidance.
- Alternatives: Maintain a separate glossary only.
- Consequences: Future instructions must include short definitions for terms like deterministic or compressed provider prompt.
- Revisit criteria: If the glossary becomes large and needs its own dedicated doc.
- Plan:
  - Goal: Make jargon/flag explanations explicit in governance guidance.
  - Files: `AGENTS.md`, `DECISIONS.md`.
  - Rule change: Governance now requires plain-language definitions when introducing jargon or flags.
  - Confirm: Docs-only change with zero behavioral impact.
- Self-critique: The only risk is forgetting to add definitions in future notes; evidence is the new governance line in `AGENTS.md`.

- Cipher Gate:
  - Date: 2026-01-26
  - Seams: Governance
  - Evidence: docs/evidence/2026-01-26/test.txt; docs/evidence/2026-01-26/verify.txt
  - Summary: Added a governance rule to define jargon/flags in plain language.
  - Risks: None beyond enforcement drift if definitions are skipped.

## 2026-01-25 - Seam-Driven Development plan (probe refresh + optional features) + self-critique
- Date: 2026-01-25
- Decision: Refresh xAI probe fixtures now that network access is available; add optional features (dedication line, share exports, sparkle preview overlay) via seam-safe updates.
- Context: User requested autonomous progress and as many optional features as possible without shortcuts.
- Alternatives: Defer probes and optional features to separate changes or keep the UI minimal.
- Consequences: Multiple seam fixtures, adapters, and tests must change in lockstep; evidence must be refreshed.
- Revisit criteria: If xAI probe outputs fail to parse into contracts or share exports compromise print fidelity.
- Plan:
  - Goal: Run probes to replace stubbed fixtures, add dedication line to specs/prompt/drift checks, and add square/chat export variants plus sparkle preview overlay.
  - Seams: ProviderAdapterSeam, ChatInterpretationSeam, ImageGenerationSeam, SpecValidationSeam, PromptAssemblySeam, DriftDetectionSeam, OutputPackagingSeam.
  - Files:
    - `probes/provider-adapter.probe.mjs`
    - `probes/chat-interpretation.probe.mjs`
    - `probes/image-generation.probe.mjs`
    - `fixtures/provider-adapter/sample.json`
    - `fixtures/provider-adapter/fault.json`
    - `fixtures/chat-interpretation/sample.json`
    - `fixtures/chat-interpretation/fault.json`
    - `fixtures/image-generation/sample.json`
    - `fixtures/image-generation/fault.json`
    - `contracts/spec-validation.contract.ts`
    - `fixtures/spec-validation/sample.json`
    - `fixtures/spec-validation/fault.json`
    - `src/lib/adapters/spec-validation.adapter.ts`
    - `contracts/prompt-assembly.contract.ts`
    - `fixtures/prompt-assembly/sample.json`
    - `fixtures/prompt-assembly/fault.json`
    - `src/lib/adapters/prompt-assembly.adapter.ts`
    - `contracts/drift-detection.contract.ts`
    - `fixtures/drift-detection/sample.json`
    - `fixtures/drift-detection/fault.json`
    - `src/lib/adapters/drift-detection.adapter.ts`
    - `tests/contract/prompt-assembly.test.ts`
    - `tests/contract/drift-detection.test.ts`
    - `contracts/output-packaging.contract.ts`
    - `fixtures/output-packaging/sample.json`
    - `fixtures/output-packaging/fault.json`
    - `src/lib/mocks/output-packaging.mock.ts`
    - `src/lib/adapters/output-packaging.adapter.ts`
    - `tests/contract/output-packaging.test.ts`
    - `src/routes/+page.svelte`
    - `docs/seams.md`
    - `DECISIONS.md`
    - `CHANGELOG.md`
    - `LESSONS_LEARNED.md`
  - Commands:
    - `node probes/provider-adapter.probe.mjs`
    - `node probes/chat-interpretation.probe.mjs`
    - `node probes/image-generation.probe.mjs`
    - `npm test`
    - `npm run verify`
- Self-critique: The riskiest assumption is that share-export resizing won’t distort print-ready assets; evidence will be updated output-packaging fixtures and contract tests. Another risk is that dedication text introduces heading drift or invalid characters; evidence will be updated prompt fixtures, drift checks, and validation errors.

## 2026-01-25 - Dedication line placement
- Date: 2026-01-25
- Decision: Add dedication text as an optional layout line (no new headings) using the exact phrase `Add a small script dedication at the bottom: "Dedicated to <name>".`.
- Context: Dedication must appear on generated pages without violating the locked heading list.
- Alternatives: Add a new DEDICATION heading or repurpose footer items.
- Consequences: Prompt assembly and drift detection must include the exact dedication line when provided.
- Revisit criteria: If future template changes permit new headings without breaking drift checks.

## 2026-01-25 - Share export variants
- Date: 2026-01-25
- Decision: Add OutputPackagingSeam variants for `square` (1080x1080) and `chat` (720x720) while keeping `print` outputs unchanged.
- Context: Users need share-ready outputs without compromising print fidelity.
- Alternatives: Add separate share-export seams or generate variants in the UI.
- Consequences: OutputPackagingSeam now handles resizing in the browser and emits multiple files.
- Revisit criteria: If resizing introduces quality issues or if print fidelity is affected.

- Cipher Gate:
  - Date: 2026-01-25
  - Seams: SpecValidationSeam, PromptAssemblySeam, DriftDetectionSeam, OutputPackagingSeam
  - Evidence: docs/evidence/2026-01-25/verify.txt; docs/evidence/2026-01-25/test.txt; docs/evidence/2026-01-25/probe-provider-adapter.txt; docs/evidence/2026-01-25/probe-chat-interpretation.txt; docs/evidence/2026-01-25/probe-image-generation.txt
  - Summary: Added dedication line support and share export variants; updated prompt/drift fixtures and output packaging behavior; chat/provider probes ran, image probe returned 404.
  - Risks: Share resizing quality and blocked image generation probe until xAI endpoint access is confirmed.

## 2026-01-25 - xAI probe status update (image endpoint)
- Date: 2026-01-25
- Decision: Record probe results: chat/provider probes completed; image generation probe returned 400 with a 1024-character prompt length limit.
- Context: DNS resolution was restored on the host and probes were run with a valid API key.
- Alternatives: Ignore the 400 and continue with stubbed image fixtures.
- Consequences: ImageGenerationSeam remains blocked; fixtures stay stubbed until the endpoint or access issue is resolved.
- Revisit criteria: Adjust prompt assembly to stay within 1024 characters or select a provider with a higher prompt limit, then rerun probes.

## 2026-01-24 - Seam-Driven Development plan (xAI integration + PWA) + self-critique
- Date: 2026-01-24
- Decision: Proceed with Seam-Driven Development updates for ProviderAdapterSeam, ChatInterpretationSeam, and ImageGenerationSeam to integrate xAI chat/image calls, add probes/fixtures, and add PWA install assets.
- Context: User requires xAI-backed image generation and chat, plus Android-installable PWA and removal of hidden Meechie-only route.
- Alternatives: Keep deterministic SVG and chat stubs; defer PWA work to a separate change.
- Consequences: Network I/O moves into ProviderAdapterSeam, fixtures change to real xAI outputs, contract tests and adapters must be updated, and new PWA files/registration are added.
- Revisit criteria: If xAI responses cannot be parsed into the required contracts or PWA assets cause build issues.
- Plan:
  - Goal: Integrate xAI chat/image behind ProviderAdapterSeam and expose chat/image via server endpoints; update seam fixtures/tests; add PWA manifest/service worker; merge Meechie tools into main UI.
  - Seams: ProviderAdapterSeam, ChatInterpretationSeam, ImageGenerationSeam.
  - Files:
    - `probes/provider-adapter.probe.mjs`
    - `probes/chat-interpretation.probe.mjs`
    - `probes/image-generation.probe.mjs`
    - `fixtures/provider-adapter/sample.json`
    - `fixtures/provider-adapter/fault.json`
    - `fixtures/chat-interpretation/sample.json`
    - `fixtures/chat-interpretation/fault.json`
    - `fixtures/image-generation/sample.json`
    - `fixtures/image-generation/fault.json`
    - `fixtures/image-generation/dense-scene.json`
    - `src/lib/mocks/provider-adapter.mock.ts`
    - `src/lib/mocks/chat-interpretation.mock.ts`
    - `src/lib/mocks/image-generation.mock.ts`
    - `src/lib/adapters/provider-adapter.adapter.ts`
    - `src/lib/adapters/chat-interpretation.adapter.ts`
    - `src/lib/adapters/image-generation.adapter.ts`
    - `tests/contract/provider-adapter.test.ts`
    - `tests/contract/chat-interpretation.test.ts`
    - `tests/contract/image-generation.test.ts`
    - `src/routes/api/chat-interpretation/+server.ts`
    - `src/routes/api/image-generation/+server.ts`
    - `src/routes/+page.svelte`
    - `src/routes/+layout.svelte`
    - `src/routes/meechie/+page.svelte`
    - `src/lib/components/MeechieTools.svelte`
    - `src/app.html`
    - `src/service-worker.ts`
    - `static/manifest.webmanifest`
    - `static/icon.svg`
    - `.env.example`
    - `docs/seams.md`
    - `DECISIONS.md`
    - `CHANGELOG.md`
    - `LESSONS_LEARNED.md`
  - Commands:
    - `node probes/provider-adapter.probe.mjs`
    - `node probes/chat-interpretation.probe.mjs`
    - `node probes/image-generation.probe.mjs`
    - `npm test`
    - `npm run verify`
- Self-critique: The riskiest assumption is that xAI responses will remain parseable into strict contracts; evidence will be probe outputs, updated fixtures, and contract test results. Another risk is accidentally leaking secrets to the client; evidence will be server-only API usage and absence of API keys in client bundles or config. PWA installability could be incomplete without a service worker; evidence will be the manifest, service worker registration, and build outputs.

- Assumption:
  - Date: 2026-01-24
  - Seams: ProviderAdapterSeam, ChatInterpretationSeam, ImageGenerationSeam
  - Statement: DNS resolution is unavailable in the current environment, so xAI probe calls cannot complete and fixtures remain stubbed.
  - Validation: Restore DNS/network access and rerun `node probes/provider-adapter.probe.mjs`, `node probes/chat-interpretation.probe.mjs`, and `node probes/image-generation.probe.mjs` to refresh fixtures and evidence.
  - Status: closed (probes ran 2026-02-01)

## 2026-01-24 - xAI provider integration (chat + image)
- Date: 2026-01-24
- Decision: Use xAI endpoints via ProviderAdapterSeam, with server-side API routes for chat interpretation and image generation and client adapters calling those routes.
- Context: The app must use xAI for chat and image generation while keeping API keys off the client.
- Alternatives: Keep deterministic SVG generation and chat stubs or push xAI calls to the client.
- Consequences: ProviderAdapterSeam now owns network I/O; ImageGenerationSeam and ChatInterpretationSeam become network-backed via server routes; probes are required once DNS is available.
- Revisit criteria: If xAI responses cannot be parsed reliably or if server routing adds unacceptable latency.

## 2026-01-24 - PWA installability + Meechie embedding
- Date: 2026-01-24
- Decision: Add a PWA manifest/icon/service worker and embed Meechie tools on the main page while keeping the `/meechie` route as a deep link.
- Context: The app must be installable on Android and Meechie tools must not be hidden behind a separate URL.
- Alternatives: Defer PWA work or keep Meechie tools on a standalone route only.
- Consequences: Additional static assets and service worker registration are required; main page layout now includes Meechie tools.
- Revisit criteria: If PWA caching causes stale asset issues or if Meechie tools need separate branding.

- Cipher Gate:
  - Date: 2026-01-25
  - Seams: ProviderAdapterSeam, ChatInterpretationSeam, ImageGenerationSeam
  - Evidence: docs/evidence/2026-01-25/verify.txt; docs/evidence/2026-01-25/test.txt; docs/evidence/2026-01-24/probe-provider-adapter.txt; docs/evidence/2026-01-24/probe-chat-interpretation.txt; docs/evidence/2026-01-24/probe-image-generation.txt
  - Summary: Implemented xAI-backed provider adapter and server routes, updated client adapters/tests/fixtures, added PWA assets, and embedded Meechie tools in the main UI; probes are blocked due to DNS.
  - Risks: xAI probes failed because DNS resolution is unavailable; fixtures remain stubbed until probes can run.

## 2026-01-22 - Seam-Driven Development plan (option expansion) + self-critique
- Date: 2026-01-22
- Decision: Expand user options across spec, prompt, drift detection, renderer, packaging, and UI with full Seam-Driven Development workflow and evidence.
- Context: User approved adding all option buckets (alignment, list gutter, footer toggle, title-only mode, decorations/illustrations/shading, color, A4 size, typography).
- Alternatives: Stage the options in smaller batches or keep high-impact options out of v1.
- Consequences: Multiple seams and fixtures will change; tests and evidence must be rerun.
- Revisit criteria: If any new option cannot be enforced deterministically without violating core constraints.
- Plan:
  - Goal: add all approved options with deterministic behavior and drift enforcement.
  - Seams: SpecValidationSeam, PromptAssemblySeam, DriftDetectionSeam, ImageGenerationSeam, OutputPackagingSeam, ChatInterpretationSeam, CreationStoreSeam.
  - Files:
    - `contracts/spec-validation.contract.ts`
    - `contracts/prompt-assembly.contract.ts`
    - `contracts/drift-detection.contract.ts`
    - `contracts/image-generation.contract.ts`
    - `contracts/output-packaging.contract.ts`
    - `contracts/creation-store.contract.ts`
    - `contracts/chat-interpretation.contract.ts`
    - `fixtures/spec-validation/sample.json`
    - `fixtures/spec-validation/fault.json`
    - `fixtures/prompt-assembly/sample.json`
    - `fixtures/prompt-assembly/fault.json`
    - `fixtures/drift-detection/sample.json`
    - `fixtures/drift-detection/fault.json`
    - `fixtures/image-generation/sample.json`
    - `fixtures/image-generation/fault.json`
    - `fixtures/output-packaging/sample.json`
    - `fixtures/output-packaging/fault.json`
    - `fixtures/chat-interpretation/sample.json`
    - `fixtures/chat-interpretation/fault.json`
    - `fixtures/creation-store/sample.json`
    - `fixtures/creation-store/fault.json`
    - `src/lib/mocks/spec-validation.mock.ts`
    - `src/lib/mocks/prompt-assembly.mock.ts`
    - `src/lib/mocks/drift-detection.mock.ts`
    - `src/lib/mocks/image-generation.mock.ts`
    - `src/lib/mocks/output-packaging.mock.ts`
    - `src/lib/mocks/chat-interpretation.mock.ts`
    - `src/lib/mocks/creation-store.mock.ts`
    - `src/lib/adapters/spec-validation.adapter.ts`
    - `src/lib/adapters/prompt-assembly.adapter.ts`
    - `src/lib/adapters/drift-detection.adapter.ts`
    - `src/lib/adapters/image-generation.adapter.ts`
    - `src/lib/adapters/output-packaging.adapter.ts`
    - `src/lib/adapters/chat-interpretation.adapter.ts`
    - `src/lib/adapters/creation-store.adapter.ts`
    - `tests/contract/spec-validation.test.ts`
    - `tests/contract/prompt-assembly.test.ts`
    - `tests/contract/drift-detection.test.ts`
    - `tests/contract/image-generation.test.ts`
    - `tests/contract/output-packaging.test.ts`
    - `tests/contract/chat-interpretation.test.ts`
    - `tests/contract/creation-store.test.ts`
    - `src/routes/+page.svelte`
    - `DECISIONS.md`
    - `CHANGELOG.md`
    - `LESSONS_LEARNED.md`
  - Commands: `npm run check`, `npm test`, `npm run verify`.
- Self-critique: The riskiest assumption is that all new options can be expressed deterministically in the prompt and SVG renderer without violating the “blank space is intentional” rule; evidence will be updated fixtures, drift checks, and renderer contract tests. Another risk is option explosion causing mismatched defaults across seams; evidence will be consistent default values in contracts, adapters, fixtures, and UI.

## 2026-01-22 - Option sets and defaults (v1 expansion)
- Date: 2026-01-22
- Decision: Add v1 option enums and defaults: listMode (`list`/`title_only`), listGutter (`tight`/`normal`/`loose`), fontStyle (`rounded`/`block`/`hand`), textStrokeWidth (4–12, default 6), colorMode (`black_and_white_only`/`grayscale`/`color`), decorations (`none`/`minimal`/`dense`), illustrations (`none`/`simple`/`scene`), shading (`none`/`hatch`/`stippling`), border (`none`/`plain`/`decorative`), borderThickness (2–16, default 8).
- Context: User requested all option buckets; we need explicit, testable values.
- Alternatives: Fewer options or unbounded user-defined values.
- Consequences: Contracts, fixtures, prompt assembly, drift detection, renderer, and UI must stay in lockstep.
- Revisit criteria: If option combinations produce unreadable layouts or prompt drift becomes hard to detect.

## 2026-01-22 - A4 dimension mapping (renderer + packaging)
- Date: 2026-01-22
- Decision: Use A4 size at 300 DPI as 2480×3508 px in SVG renderer; PDF packaging uses A4 at 595×842 pt.
- Context: Page size is now a user option and must be deterministic in output.
- Alternatives: Use 2481×3507 px or derive from inches at runtime.
- Consequences: Renderer and packaging align on a fixed mapping for tests and fixtures.
- Revisit criteria: If print output shows off-by-one scaling or PDF layout mismatch.

## 2026-01-22 - Deterministic decoration + shading rendering
- Date: 2026-01-22
- Decision: Decorations/illustrations render as fixed outline shapes; shading uses hatch or stippling patterns applied only to those shapes; stroke color is driven by colorMode.
- Context: New style options must remain deterministic and testable without external dependencies.
- Alternatives: Randomized placement or rasterized shading.
- Consequences: Output remains deterministic; drift detection can enforce prompt lines without ambiguity.
- Revisit criteria: If shapes interfere with text or require a more advanced layout engine.

## 2026-01-22 - Wu-Bob roster change (micro plan + self-critique)
- Date: 2026-01-22
- Decision: Change Wu-Bob roster to Uncle Bob + RZA + Inspectah Deck.
- Context: User requested a roster change to emphasize clean-code discipline (Uncle Bob), system vision (RZA), and architectural inspection rigor (Inspectah Deck) during upcoming option expansion.
- Alternatives: Keep GZA + Ghostface Killah or defer the roster change until after option planning.
- Consequences: Wu-Bob guidance shifts toward stronger contract enforcement, structured orchestration, and audit-style reviews.
- Revisit criteria: If the work shifts toward terse execution or needs a different balance of creativity vs discipline.
- Plan (micro): Update `DECISIONS.md` and `AGENTS.md` only. Commands: `rg -n "Wu-Bob roster" AGENTS.md`, `rg -n "Wu-Bob roster change" DECISIONS.md`.
- Self-critique (micro): Risk of overemphasizing structure at the expense of rapid iteration; evidence is the updated roster entries and referenced files.

## 2026-01-22 - Wu-Bob roster change (micro plan + self-critique)
- Date: 2026-01-22
- Decision: Change Wu-Bob roster to GZA + U-God + Method Man.
- Context: User requested a roster change to emphasize concise precision (GZA), steady grounding (U-God), and pragmatic execution energy (Method Man).
- Alternatives: Keep Uncle Bob + RZA + Inspectah Deck or defer the roster change until after the current review cycle.
- Consequences: Wu-Bob guidance shifts toward terser audits, grounded priorities, and pragmatic delivery.
- Revisit criteria: If deeper architectural inspection or orchestration becomes the dominant need.
- Plan (micro): Update `DECISIONS.md` and `AGENTS.md` only. Commands: `rg -n "Wu-Bob roster" AGENTS.md`, `rg -n "Wu-Bob roster change" DECISIONS.md`.
- Self-critique (micro): Risk of reducing architectural depth; evidence is the updated roster entries and referenced files.

## 2026-01-22 - Center alignment applies to all text columns
- Date: 2026-01-22
- Decision: `alignment: "center"` centers the title and list columns; number/label columns straddle the center line with fixed half-gutter spacing. Prompt alignment lines mirror this (centered vs left-aligned).
- Context: Users must be able to align content left or center; list items are part of the content and must follow the chosen alignment.
- Alternatives: Center only the title and keep list items left-aligned; or attempt text-width measurement to center entire blocks.
- Consequences: SVG renderer positions list columns symmetrically around the center; prompt text and drift checks enforce the correct alignment wording.
- Revisit criteria: If the centered list layout is visually unbalanced for long labels or if a future text-measurement capability is introduced.

## 2026-01-22 - Wu-Bob roster change (micro plan + self-critique)
- Date: 2026-01-22
- Decision: Change Wu-Bob roster from Raekwon + Masta Killa to GZA + Ghostface Killah.
- Context: User requested a roster change to emphasize precision and raw clarity during review.
- Alternatives: Keep current roster and add these members later if needed.
- Consequences: Wu-Bob guidance shifts toward terse precision (GZA) and visceral narrative clarity (Ghostface Killah).
- Revisit criteria: If the work scope shifts away from execution precision or needs higher system-level orchestration.
- Plan (micro): Update `DECISIONS.md` and `AGENTS.md` only. Commands: `rg -n "Wu-Bob" AGENTS.md`, `rg -n "Wu-Bob roster" DECISIONS.md`.
- Self-critique (micro): Risk of over-indexing on brevity at the expense of completeness; evidence is the updated roster entries in the two files.

## 2026-01-22 - Seam-Driven Development plan (alignment + decorations consistency) + self-critique
- Date: 2026-01-22
- Decision: Align prompt assembly text with alignment settings, remove non-seam network font loading, and resolve decoration contradictions by making the prompt explicitly forbid decorations while preserving the DECORATIONS heading.
- Context: Current prompt/template conflicts with spec constraints and introduces external network I/O in the UI.
- Alternatives: Allow decorative borders in the spec or keep external font loading.
- Consequences: Prompt text changes require fixture updates; drift detection checks will include alignment phrases; UI will rely on local fonts only.
- Revisit criteria: If future requirements explicitly reintroduce decorative border instructions or bundled font assets.
- Plan:
  - Goal: eliminate contradictions and keep all network I/O behind seams with minimal behavioral change.
  - Seams: PromptAssemblySeam, DriftDetectionSeam, OutputPackagingSeam, ImageGenerationSeam.
  - Files:
    - `DECISIONS.md`
    - `src/routes/+page.svelte`
    - `src/lib/adapters/prompt-assembly.adapter.ts`
    - `src/lib/adapters/drift-detection.adapter.ts`
    - `src/lib/adapters/output-packaging.adapter.ts`
    - `tests/contract/image-generation.test.ts`
    - `fixtures/prompt-assembly/sample.json`
    - `fixtures/prompt-assembly/fault.json`
    - `fixtures/drift-detection/sample.json`
    - `fixtures/drift-detection/fault.json`
    - `fixtures/image-generation/sample.json`
    - `fixtures/image-generation/fault.json`
  - Commands: `npm run check`, `npm test`, `npm run verify`.
- Self-critique: The riskiest assumption is that prompt text changes will not invalidate downstream drift checks; evidence will be updated fixtures and contract tests. Another risk is introducing regressions in the renderer tests while adding layout assertions; evidence will be the updated ImageGenerationSeam contract test expectations.

## 2026-01-22 - Seam-Driven Development plan (pure seams) + self-critique
- Date: 2026-01-22
- Decision: Proceed with full fixture -> mock -> contract test -> adapter workflow for SpecValidationSeam, PromptAssemblySeam, DriftDetectionSeam, ImageGenerationSeam, and OutputPackagingSeam, plus probe status corrections in `docs/seams.md`.
- Context: Contracts exist and partial fixtures started; the next safe step is to complete the pure seams end-to-end before touching I/O seams.
- Alternatives: Pause and re-scope to a single seam only.
- Consequences: Multiple seam artifacts will be created and must pass contract tests before adapter logic is accepted.
- Revisit criteria: If tests reveal missing contract details or the prompt/template decisions prove unworkable.
- Plan:
  - Goal: finish pure seam artifacts and implementations with red-proof before any I/O seam work.
  - Seams: SpecValidationSeam, PromptAssemblySeam, DriftDetectionSeam, ImageGenerationSeam, OutputPackagingSeam.
  - Files:
    - `DECISIONS.md`
    - `docs/seams.md`
    - `fixtures/spec-validation/sample.json`
    - `fixtures/spec-validation/fault.json`
    - `fixtures/prompt-assembly/sample.json`
    - `fixtures/prompt-assembly/fault.json`
    - `fixtures/drift-detection/sample.json`
    - `fixtures/drift-detection/fault.json`
    - `fixtures/image-generation/sample.json`
    - `fixtures/image-generation/fault.json`
    - `fixtures/output-packaging/sample.json`
    - `fixtures/output-packaging/fault.json`
    - `src/lib/mocks/spec-validation.mock.ts`
    - `src/lib/mocks/prompt-assembly.mock.ts`
    - `src/lib/mocks/drift-detection.mock.ts`
    - `src/lib/mocks/image-generation.mock.ts`
    - `src/lib/mocks/output-packaging.mock.ts`
    - `tests/contract/spec-validation.test.ts`
    - `tests/contract/prompt-assembly.test.ts`
    - `tests/contract/drift-detection.test.ts`
    - `tests/contract/image-generation.test.ts`
    - `tests/contract/output-packaging.test.ts`
    - `src/lib/adapters/spec-validation.adapter.ts`
    - `src/lib/adapters/prompt-assembly.adapter.ts`

## 2026-01-22 - Seam-Driven Development tooling automation (chamber lock, shaolin lint, rewind)
- Date: 2026-01-22
- Decision: Add deterministic automation scripts (chamber lock, shaolin lint, rewind, verify runner) and wire them into `npm run verify`.
- Context: User requested maximum automation with enforced evidence and seam artifact checks.
- Alternatives: Keep manual evidence capture and run checks ad hoc; add only git hooks without command integration.
- Consequences: `npm run verify` now generates evidence and enforces gate checks; failures block completion until evidence is fresh.
- Revisit criteria: If automation causes false negatives or blocks valid work due to missing metadata rules.
- Plan:
  - Goal: enforce seam artifact presence and evidence freshness with deterministic reports.
  - Seams: none (tooling only).
  - Files:
    - `scripts/chamber-lock.mjs`
    - `scripts/shaolin-lint.mjs`
    - `scripts/rewind.mjs`
    - `scripts/verify-runner.mjs`
    - `package.json`
    - `docs/evidence/README.md`
    - `DECISIONS.md`
  - Commands: `npm run verify`, `node scripts/rewind.mjs --seam AuthContextSeam` (spot check).
- Self-critique: The riskiest assumption is that evidence freshness based on mtimes is sufficient; if file timestamps drift, the lint could block incorrectly. Evidence is the generated JSON reports and successful `npm run verify` output captured under `docs/evidence/YYYY-MM-DD/`.

## 2026-01-23 - Seam ledger + proof tape automation (plan + self-critique)
- Date: 2026-01-23
- Decision: Add seam ledger and proof tape scripts for deterministic seam coverage reporting and non-coder evidence summaries.
- Context: User requested more automated, human-readable proof artifacts without weakening enforcement.
- Alternatives: Keep evidence files only; manually summarize status when needed.
- Consequences: New evidence files will be generated during `npm run verify`; documentation updated to include them.
- Revisit criteria: If summaries become misleading or require heuristics beyond deterministic metadata.
- Plan:
  - Goal: generate seam coverage and proof summaries automatically alongside verification.
  - Seams: none (tooling only).
  - Files:
    - `scripts/seam-ledger.mjs`
    - `scripts/proof-tape.mjs`
    - `package.json`
    - `docs/evidence/README.md`
    - `DECISIONS.md`
  - Commands: `npm run verify`, `npm run seam:ledger`, `npm run proof:tape`.
- Self-critique: The riskiest assumption is that evidence folder selection by date is sufficient for accurate summaries; evidence will be the generated ledger and proof tape reports in `docs/evidence/YYYY-MM-DD/`.

## 2026-01-23 - Clan chain report (plan + self-critique)
- Date: 2026-01-23
- Decision: Add a clan chain report that marks seams as clean or dirty using the seam ledger output.
- Context: User requested additional Wu-Tang-specific tooling to make seam readiness visible for non-coders.
- Alternatives: Rely on seam ledger only; manually interpret status.
- Consequences: New evidence files generated alongside seam ledger and proof tape.
- Revisit criteria: If chain reports cause redundant noise or mislead without added value.
- Plan:
  - Goal: generate a clean vs dirty seam list from seam ledger output.
  - Seams: none (tooling only).
  - Files:
    - `scripts/clan-chain.mjs`
    - `package.json`
    - `docs/evidence/README.md`
    - `DECISIONS.md`
  - Commands: `npm run verify`, `npm run clan:chain`.
- Self-critique: The riskiest assumption is that seam ledger status alone is sufficient to classify readiness; evidence will be the generated `clan-chain.json` and `clan-chain.md` reports.

## 2026-01-23 - AGENTS automation instructions (micro plan + self-critique)
- Date: 2026-01-23
- Decision: Document automated tool usage in `AGENTS.md` to prevent ambiguity about required gates.
- Context: New automation scripts are wired into `npm run verify` and need explicit governance guidance.
- Alternatives: Rely on package.json scripts only; explain in README instead.
- Consequences: AGENTS now explicitly describes the automation workflow and the seam-scoped rewind command.
- Revisit criteria: If tooling changes or the verify pipeline is split into separate phases.
- Plan (micro):
  - Goal: add concise instructions for using the automation tools.
  - Seams: none (docs-only).
  - Files:
    - `AGENTS.md`
    - `DECISIONS.md`
  - Commands: none.
- Self-critique (micro): Risk of over-prescription if tooling changes; evidence is the updated `AGENTS.md` section and this decision entry.

## 2026-01-23 - AGENTS automation tools section (micro plan + self-critique)
- Date: 2026-01-23
- Decision: Add a short Automation Tools section in `AGENTS.md` listing the new scripts and their purposes.
- Context: Users asked for clear instructions on how to use the automated gates.
- Alternatives: Leave instructions only in package.json scripts; document in README instead.
- Consequences: AGENTS becomes the single source of truth for tool usage expectations.
- Revisit criteria: If tooling names change or the verify pipeline is restructured.
- Plan (micro):
  - Goal: add an automation tools list without changing workflow rules.
  - Seams: none (docs-only).
  - Files:
    - `AGENTS.md`
    - `DECISIONS.md`
  - Commands: none.
- Self-critique (micro): Risk of duplication with `package.json`; evidence is the updated `AGENTS.md` section.
    - `src/lib/adapters/drift-detection.adapter.ts`
    - `src/lib/adapters/image-generation.adapter.ts`
    - `src/lib/adapters/output-packaging.adapter.ts`
  - Commands: `npm run check`, `npm test`, `npm run verify`.
- Self-critique: The riskiest assumption is that the locked prompt template can incorporate list-based content without breaking drift rules; evidence will be contract tests for PromptAssemblySeam and DriftDetectionSeam plus fixture comparisons. Another risk is PDF packaging correctness from SVG input; evidence will be OutputPackagingSeam tests that validate non-empty base64 output and expected file naming.

## 2026-01-22 - Seam-Driven Development plan (stateful seams) + self-critique
- Date: 2026-01-22
- Decision: Proceed with fixture -> mock -> contract test -> adapter workflow for SessionSeam, AuthContextSeam, CreationStoreSeam, ChatInterpretationSeam, and ProviderAdapterSeam, including contract extension for draft storage in CreationStoreSeam.
- Context: Pure seams are in place; stateful seams are required to support persistence and chat workflow without hidden I/O.
- Alternatives: Delay stateful seams and ship a read-only UI.
- Consequences: LocalStorage-backed adapters will be browser-gated and must return explicit errors when environment is missing.
- Revisit criteria: If contract tests reveal gaps in draft storage expectations.
- Plan:
  - Goal: finish stateful seam artifacts and adapters without introducing hidden I/O.
  - Seams: SessionSeam, AuthContextSeam, CreationStoreSeam, ChatInterpretationSeam, ProviderAdapterSeam.
  - Files:
    - `DECISIONS.md`
    - `contracts/creation-store.contract.ts`
    - `fixtures/session/sample.json`
    - `fixtures/session/fault.json`
    - `fixtures/auth-context/sample.json`
    - `fixtures/auth-context/fault.json`
    - `fixtures/creation-store/sample.json`
    - `fixtures/creation-store/fault.json`
    - `fixtures/chat-interpretation/sample.json`
    - `fixtures/chat-interpretation/fault.json`
    - `fixtures/provider-adapter/sample.json`
    - `fixtures/provider-adapter/fault.json`
    - `src/lib/mocks/session.mock.ts`
    - `src/lib/mocks/auth-context.mock.ts`
    - `src/lib/mocks/creation-store.mock.ts`
    - `src/lib/mocks/chat-interpretation.mock.ts`
    - `src/lib/mocks/provider-adapter.mock.ts`
    - `tests/contract/session.test.ts`
    - `tests/contract/auth-context.test.ts`
    - `tests/contract/creation-store.test.ts`
    - `tests/contract/chat-interpretation.test.ts`
    - `tests/contract/provider-adapter.test.ts`
    - `src/lib/adapters/session.adapter.ts`
    - `src/lib/adapters/auth-context.adapter.ts`
    - `src/lib/adapters/creation-store.adapter.ts`
    - `src/lib/adapters/chat-interpretation.adapter.ts`
    - `src/lib/adapters/provider-adapter.adapter.ts`
  - Commands: `npm run check`, `npm test`, `npm run verify`.
- Self-critique: The riskiest assumption is that browser-only storage behavior can be safely gated without violating flow expectations; evidence will be adapters returning explicit `BROWSER_REQUIRED` errors in Node tests. Another risk is expanding the CreationStoreSeam contract for drafts; evidence will be updated fixtures and contract tests for draft operations.

## 2026-01-21 - Initial app and seam decisions
- Date: 2026-01-21
- Decision: Build with SvelteKit (latest stable), Vite, Vitest, strict TypeScript, and svelte-check; no `any`.
- Context: Need fast iteration with strict correctness for Seam-Driven Development.
- Alternatives: Angular.
- Consequences: SvelteKit conventions drive project layout and testing.
- Revisit criteria: Reconsider only if SvelteKit blocks required seams or testing.

- Date: 2026-01-21
- Decision: Use `DECISIONS.md` at repo root as canonical; do not move or rename.
- Context: Avoid churn and broken links; minimal diffs.
- Alternatives: `docs/decisions.md`.
- Consequences: All decision references point to repo-root `DECISIONS.md`.
- Revisit criteria: If a docs reorg is explicitly approved.

- Date: 2026-01-21
- Decision: Allow new seams only when they meet seam definition, are added to `docs/seams.md`, and follow the full workflow; pre-approved: SessionSeam, SpecValidationSeam.
- Context: Prevent seam sprawl while allowing necessary trust/side-effect boundaries.
- Alternatives: Canonical seams only.
- Consequences: Any added seam must pay full SDD cost.
- Revisit criteria: If seam list proves insufficient for side-effect isolation.

- Date: 2026-01-21
- Decision: ImageGenerationSeam and ChatInterpretationSeam use stubbed adapters in v1; no real API integration.
- Context: Avoid credentials and nondeterminism in v1.
- Alternatives: Live provider integration.
- Consequences: Determinism relies on prompt locking + evidence, not provider seeding.
- Revisit criteria: When provider integration is explicitly requested.

- Date: 2026-01-21
- Decision: DriftDetectionSeam uses a simple heuristic in v1 (rules-based over spec + prompts).
- Context: Need detectable violations without vision models.
- Alternatives: Fully mocked drift detection.
- Consequences: Rules must be explicit and testable.
- Revisit criteria: When vision-based detection is in scope.

- Date: 2026-01-21
- Decision: OutputPackagingSeam generates one PDF per image in v1.
- Context: Simpler proofs and tests than multi-page packaging.
- Alternatives: Multi-page PDF.
- Consequences: Multiple files for multi-variation outputs.
- Revisit criteria: When UX requires multi-page packaging.

- Date: 2026-01-21
- Decision: CreationStoreSeam uses browser `localStorage` for anonymous users in v1.
- Context: No auth or server persistence required; session-scoped storage.
- Alternatives: File-backed or server DB.
- Consequences: Data is per-browser and per-device.
- Revisit criteria: When authenticated persistence is in scope.

- Date: 2026-01-21
- Decision: Enforce spec constraints: items 1–20, label length 1–40, allowed chars set, numbers 1–999, strict alignment language required in prompt.
- Context: Ensure deterministic, rule-bound outputs.
- Alternatives: Looser validation.
- Consequences: Invalid input blocks generation until corrected.
- Revisit criteria: If constraints block legitimate use cases.

- Date: 2026-01-21
- Decision: UI direction defaults to clean worksheet aesthetic with a debug panel (prompt, revised prompt, violations).
- Context: Prioritize clarity and constraint visibility.
- Alternatives: Branded or decorative UI.
- Consequences: Minimal visual styling in v1.
- Revisit criteria: When brand direction is defined.

- Date: 2026-01-21
- Decision: OutputPackagingSeam runs client-side in the browser; server-side PDF generation is out of scope for v1.
- Context: Avoid unnecessary I/O and scope creep; keep side effects in the client adapter.
- Alternatives: Server-side PDF generation.
- Consequences: Packaging depends on browser capabilities; server remains out of the seam.
- Revisit criteria: If client-side packaging cannot meet requirements.

- Date: 2026-01-21
- Decision: ImageGenerationSeam uses a deterministic SVG renderer in v1 that obeys layout constraints; no static placeholder images.
- Context: A placeholder would not prove layout rules or constraint enforcement.
- Alternatives: Static placeholder image; live provider integration.
- Consequences: Renderer must encode layout constraints explicitly.
- Revisit criteria: When a real model integration is required.

- Date: 2026-01-21
- Decision: Update `docs/seams.md` before the build plan to include canonical seams plus pre-approved SessionSeam and SpecValidationSeam.
- Context: Prevent code-first drift and keep seam inventory authoritative.
- Alternatives: Update later during implementation.
- Consequences: Seam names are locked for planning.
- Revisit criteria: If seam inventory format changes.

## 2026-01-21 - Governance-only docs update (micro plan + self-critique)
- Date: 2026-01-21
- Decision: Clarify governance rules for docs-only changes and seam inventory formatting without changing SDD philosophy.
- Context: Required fixes to prevent ambiguity around plans, probes, and naming.
- Alternatives: Leave as-is and rely on interpretation.
- Consequences: Docs changes now have explicit enforcement rules and probe status constraints.
- Revisit criteria: If these governance rules block legitimate doc-only edits.
- Plan (micro): Update `AGENTS.md` and `docs/seams.md` only. Commands: `diff -u /tmp/AGENTS.md.bak /Users/hbpheonix/coloringbook/AGENTS.md`, `diff -u /tmp/seams.md.bak /Users/hbpheonix/coloringbook/docs/seams.md`.
- Self-critique (micro): Risk of misclassifying a seam as pure or blocked; evidence is the explicit notes and probe status entries in `docs/seams.md`.

## 2026-01-22 - Wu-Bob roster change (micro plan + self-critique)
- Date: 2026-01-22
- Decision: Change Wu-Bob roster to RZA + Raekwon + Inspectah Deck for spec/communication guidance.
- Context: Need stronger narrative/translation of specs without losing architectural rigor or inspection.
- Alternatives: Keep RZA + Inspectah Deck.
- Consequences: Wu-Bob guidance emphasizes narrative clarity alongside structure and inspection.
- Revisit criteria: If narrative emphasis creates ambiguity or slows enforcement.
- Plan (micro): Update `AGENTS.md` only. Rule change: Wu-Bob roster. Zero behavioral impact beyond governance configuration.
- Self-critique (micro): Risk of over-weighting narrative; mitigation is to keep enforcement language explicit.

## 2026-01-22 - xAI provider boundary decisions
- Date: 2026-01-22
- Decision: External boundary is ProviderAdapterSeam (Option B).
- Context: Keep PromptAssemblySeam pure/deterministic while isolating network/auth/retries and enabling provider swaps.
- Alternatives: Keep provider behavior inside ImageGenerationSeam.
- Consequences: ProviderAdapterSeam will own all external API I/O and be fully mocked in v1.
- Revisit criteria: If ProviderAdapterSeam adds unnecessary complexity without improving isolation.

- Date: 2026-01-22
- Decision: Use xAI chat via POST `/v1/chat/completions`.
- Context: Simplest, widely supported request shape; easiest to stub.
- Alternatives: `/v1/responses`.
- Consequences: ProviderAdapterSeam contract must match chat/completions shape.
- Revisit criteria: If `/v1/responses` becomes required or provides needed features.

- Date: 2026-01-22
- Decision: Use xAI image generation via POST `/v1/images/generations` with default `response_format="b64_json"`.
- Context: Avoid URL expiration, CORS, and external fetch complexity for download/print.
- Alternatives: `response_format="url"`.
- Consequences: ImageGenerationSeam must accept base64 payloads by default.
- Revisit criteria: If a URL-based flow becomes required.

- Date: 2026-01-22
- Decision: Do not add `scripts/xai-image-smoke.ts` in this task (no-network); if added later, it belongs under ProviderAdapterSeam probes and is gated by `XAI_API_KEY`.
- Context: Keep v1 network-free and deterministic.
- Alternatives: Add a gated smoke probe now.
- Consequences: ProviderAdapterSeam remains stubbed until explicitly expanded.
- Revisit criteria: When real provider integration is requested.

## 2026-01-22 - Autonomy lock decisions
- Date: 2026-01-22
- Decision: SVG renderer targets US Letter at 300 DPI (2550x3300 px) with 0.5 in margins (150 px), content width 2250 px, border stroke 8 px inside margin, safe text box x=150 y=150 w=2250 h=3000.
- Context: Lock deterministic layout for v1 rendering.
- Alternatives: Use relative sizing without fixed DPI.
- Consequences: Renderer layout is deterministic and testable.
- Revisit criteria: If target print sizes or DPI change.

- Date: 2026-01-22
- Decision: Typography defaults for renderer: font stack "Baloo 2", "Fredoka", "Arial Rounded MT Bold", Arial, sans-serif; title 120 px lineHeight 1.05; body 72 px lineHeight 1.20; small label 60 px lineHeight 1.20; text stroke 6 px, fill none, stroke #000.
- Context: Enforce consistent line-art text rendering.
- Alternatives: Use system defaults or webfonts.
- Consequences: Text rendering must conform to these sizes/weights.
- Revisit criteria: If font availability or legibility requires change.

- Date: 2026-01-22
- Decision: WhitespaceScale mapping uses base = bodyFontPx * bodyLineHeight; whitespacePx = round(base * (1.0 + (whitespaceScale / 100) * 2.0)).
- Context: Deterministic spacing control.
- Alternatives: Linear mapping without base or non-linear scaling.
- Consequences: Spacing is directly testable.
- Revisit criteria: If spacing feels too tight or loose in practice.

- Date: 2026-01-22
- Decision: Prompt template is locked with exact headings and required phrases, including literal bracket notes for drift checks (STYLE, TEXT (exact), TYPOGRAPHY, LAYOUT, DECORATIONS, OUTPUT, NEGATIVE PROMPT).
- Context: Prevent prompt drift and ensure detection rules are viable.
- Alternatives: Freeform prompt assembly.
- Consequences: PromptAssemblySeam must output the canonical template.
- Revisit criteria: If canonical template fails to produce acceptable outputs.

- Date: 2026-01-22
- Decision: Drift detection rules are explicit: required phrase checks, required negative lines under NEGATIVE PROMPT, and forbidden tokens for size/quality/style and extra headings; if TEXT (exact) present but quoteText missing, assembly must block.
- Context: Detect missing constraints and unsupported parameters.
- Alternatives: Heuristic-only detection without strict phrases.
- Consequences: DriftDetectionSeam must validate prompt structure deterministically.
- Revisit criteria: If rules are too brittle for real prompts.

- Date: 2026-01-22
- Decision: Creation storage uses `localStorage` key `cb_creations_v1` with rolling retention of 50, schema `{ id, createdAtISO, intent, assembledPrompt, revisedPrompt?, images?: [{b64?, url?}], favorite?: boolean }`, plus `cb_drafts_v1` for in-progress intent.
- Context: Persist anonymous creations and drafts with minimal scope.
- Alternatives: Session-only storage or server persistence.
- Consequences: Storage adapter must enforce retention and schema.
- Revisit criteria: When authenticated persistence is in scope.

- Date: 2026-01-22
- Decision: CreationStoreSeam includes draft operations (`saveDraft`, `getDraft`, `clearDraft`) with `DraftRecord` shape `{ updatedAtISO, intent, chatMessage? }`.
- Context: Drafts must be stored without bypassing seam boundaries.
- Alternatives: Store drafts directly in UI localStorage (rejected due to hidden I/O).
- Consequences: CreationStoreSeam contract and fixtures include draft handling.
- Revisit criteria: If drafts move to a dedicated seam.

- Date: 2026-01-22
- Decision: SessionSeam stores anonymous session id in localStorage under `cb_session_id_v1`, generated via `crypto.randomUUID` with a timestamp fallback.
- Context: Session identity is needed for anonymous ownership without server auth.
- Alternatives: Use cookies or server-issued ids.
- Consequences: SessionSeam adapter is browser-gated and deterministic for tests.
- Revisit criteria: If sessions move server-side.

- Date: 2026-01-22
- Decision: AuthContextSeam v1 always returns anonymous context with capabilities `generate` and `store`, and rejects session ids containing non-alphanumeric/underscore/hyphen characters.
- Context: v1 has no authentication providers but requires explicit capabilities.
- Alternatives: Allow any session id or include more capability tiers.
- Consequences: AuthContextSeam behavior is deterministic and fixture-aligned.
- Revisit criteria: When authenticated users are introduced.

- Date: 2026-01-22
- Decision: Output naming uses `coloring-page-<id>.pdf` and `coloring-page-<id>-<index>.pdf` for batches.
- Context: Deterministic export naming.
- Alternatives: Random or user-defined filenames.
- Consequences: OutputPackagingSeam must follow naming convention.
- Revisit criteria: If user-defined naming becomes required.

- Date: 2026-01-22
- Decision: Allowed third-party dependencies are limited to Zod and pdf-lib (besides SvelteKit/Vitest defaults); no others without approval.
- Context: Minimize dependency risk and keep core logic clean.
- Alternatives: Add utility libraries as needed.
- Consequences: Implement SVG rendering internally.
- Revisit criteria: If required functionality cannot be implemented without new deps.

- Date: 2026-01-22
- Decision: Autonomy boundaries: may choose PDF generation via pdf-lib and internal SVG renderer; may adjust UI within worksheet aesthetic; may add non-network scripts. Must not change seam names/paths or add network probes without explicit request.
- Context: Enable autonomous progress with guardrails.
- Alternatives: Case-by-case approvals.
- Consequences: Autonomy is constrained to non-network, SDD-compliant changes.
- Revisit criteria: If autonomy boundaries need expansion.

- Date: 2026-01-22
- Decision: Seam owners set to `hbpheonix` for all seams in `docs/seams.md` until reassigned.
- Context: Owner required before implementation begins.
- Alternatives: Assign per-seam owners later.
- Consequences: Seam inventory is unblocked for planning.
- Revisit criteria: When responsibilities are split.

- Date: 2026-01-22
- Decision: Text size mapping for deterministic SVG renderer uses body font sizes small=72px, medium=90px, large=108px; small label size scales proportionally from 60px.
- Context: Spec defines textSize but only provides a default; mapping must be explicit for deterministic output.
- Alternatives: Keep body size fixed regardless of textSize.
- Consequences: Text sizing is deterministic and testable per spec.
- Revisit criteria: If layout density or readability requires different scaling.

- Date: 2026-01-22
- Decision: Numbered list gutter uses `bodyFontPx * 1.6` and left-aligned labels at `SAFE_X + gutter`; strict alignment keeps a fixed number column, loose alignment offsets numbers slightly by digit count.
- Context: Spec requires fixed number alignment with a gutter but does not define its size.
- Alternatives: Derive gutter from text width measurements or use a fixed pixel value.
- Consequences: List layout is deterministic and alignable for strict mode.
- Revisit criteria: If list alignment looks uneven in practice.

- Date: 2026-01-22
- Decision: PDF packaging uses US Letter dimensions (612x792 pt) and scales images to fit; SVGs are converted to PNG in-browser before embedding.
- Context: pdf-lib does not embed SVG directly; client-side packaging is required.
- Alternatives: Server-side PDF generation or SVG embedding via other libraries.
- Consequences: Output packaging adapter is browser-gated for SVG conversion.
- Revisit criteria: If an SVG embedding library is approved later.

## 2026-01-22 - Docs-only autonomy updates (micro plan + self-critique)
- Date: 2026-01-22
- Decision: Record autonomy-lock decisions and assign seam owners with docs-only changes.
- Context: Establish deterministic renderer, prompt rules, storage schema, and ownership before implementation.
- Alternatives: Defer to later planning.
- Consequences: Specs and inventory are locked for SDD planning.
- Revisit criteria: If any decision blocks required functionality.
- Plan (micro): Update `DECISIONS.md` and `docs/seams.md` only. Commands: `diff -u /tmp/DECISIONS.md.bak2 /Users/hbpheonix/coloringbook/DECISIONS.md`, `diff -u /tmp/seams.md.bak2 /Users/hbpheonix/coloringbook/docs/seams.md`.
- Self-critique (micro): Risk of over-constraining layout; evidence is the explicit size, spacing, and prompt rules recorded here.

## 2026-01-22 - Terminology enforcement (micro plan + self-critique)
- Date: 2026-01-22
- Decision: Use the full term "Seam-Driven Development" in prose and avoid the acronym.
- Context: Reduce ambiguity and enforce consistent language.
- Alternatives: Allow the acronym in prose.
- Consequences: Docs and responses must use the full term.
- Revisit criteria: If the restriction creates confusion with file naming.
- Plan (micro): Update `AGENTS.md` only. Commands: `diff -u /tmp/AGENTS.md.bak3 /Users/hbpheonix/coloringbook/AGENTS.md`.
- Self-critique (micro): Risk of inconsistency when referencing filenames; mitigate by keeping file paths literal.

## 2026-01-22 - Wu-Bob roster change (micro plan + self-critique)
- Date: 2026-01-22
- Decision: Change Wu-Bob roster to Raekwon + Masta Killa.
- Context: Shift emphasis to concrete spec translation (Raekwon) and disciplined execution pace (Masta Killa).
- Alternatives: Keep RZA + Raekwon + Inspectah Deck.
- Consequences: Guidance prioritizes clarity and steady process.
- Revisit criteria: If architectural structure or inspection rigor needs stronger emphasis.
- Plan (micro): Update `AGENTS.md` only. Commands: `diff -u /tmp/AGENTS.md.bak4 /Users/hbpheonix/coloringbook/AGENTS.md`.
- Self-critique (micro): Risk of under-weighting architecture/inspection; mitigate by keeping contract checks explicit.

## 2026-01-22 - File header exception for JSON (micro plan + self-critique)
- Date: 2026-01-22
- Decision: Files that do not support comments (e.g., `package.json`) are exempt from the top-level comment requirement; no nonstandard fields will be added.
- Context: Seam-Driven Development requires top-level comments, but JSON does not allow comments.
- Alternatives: Add nonstandard comment fields or convert to JSONC.
- Consequences: JSON files remain valid for tooling; documentation stays in surrounding files.
- Revisit criteria: If tooling adds native comment support without breaking behavior.
- Plan (micro): Update `DECISIONS.md` only. Commands: `diff -u /tmp/DECISIONS.md.bak2 /Users/hbpheonix/coloringbook/DECISIONS.md`.
- Self-critique (micro): Risk of inconsistent documentation; mitigate with clear comments in adjacent files and docs.

## 2026-01-22 - Seam-Driven Development implementation plan (contracts first)
- Date: 2026-01-22
- Decision: Execute a contract-first, linear Seam-Driven Development build with explicit seams, file paths, and commands.
- Context: Ensure deterministic, evidence-based implementation with no shortcuts.
- Alternatives: Implementation-first or incremental without contracts.
- Consequences: All seams and tests are built in order; adapters come last.
- Revisit criteria: Only if a required tool/command is unavailable.
- Plan: Seams (exact): AuthContextSeam, CreationStoreSeam, PromptAssemblySeam, ChatInterpretationSeam, ImageGenerationSeam, DriftDetectionSeam, OutputPackagingSeam, SessionSeam, SpecValidationSeam, ProviderAdapterSeam.
- Plan: Files to touch (exact, by phase):
  - contracts: `contracts/auth-context.contract.ts`, `contracts/creation-store.contract.ts`, `contracts/prompt-assembly.contract.ts`, `contracts/chat-interpretation.contract.ts`, `contracts/image-generation.contract.ts`, `contracts/drift-detection.contract.ts`, `contracts/output-packaging.contract.ts`, `contracts/session.contract.ts`, `contracts/spec-validation.contract.ts`, `contracts/provider-adapter.contract.ts`.
  - fixtures: `fixtures/<seam>/sample.json`, `fixtures/<seam>/fault.json` for each seam.
  - mocks: `src/lib/mocks/<seam>.mock.ts` for each seam.
  - tests: `tests/contract/<seam>.test.ts` for each seam.
  - adapters: `src/lib/adapters/<seam>.adapter.ts` for each seam.
  - app wiring: `src/routes/+page.svelte`, `src/routes/+layout.svelte`, `src/app.html`, `src/lib/index.ts`.
  - config: `package.json`, `vite.config.ts`, `svelte.config.js`, `tsconfig.json`.
- Plan: Commands to run (exact): `npm install`, `npm run check`, `npm test`, `npm run build`, `npm run verify` (to be added).
- Self-critique: Risk of under-specifying fixtures or skipping red-proof; mitigation is to write fault fixtures first and run contract tests before adapters.

## 2026-01-23 - Cipher Gate (required proof summary)
- Date: 2026-01-23
- Decision: Require a Cipher Gate entry that summarizes seams touched and links evidence for recent changes.
- Context: User requested a proof-summary gate to reduce AI shortcutting and improve non-coder visibility.
- Alternatives: Rely on evidence files only; add notes in CHANGELOG instead.
- Consequences: Seam changes must include a cipher entry with evidence links.
- Revisit criteria: If evidence cadence changes or cipher format needs expansion.
- Cipher Gate:
  - Date: 2026-01-23
  - Seams: Tooling (no seams)
  - Evidence: docs/evidence/2026-01-23/verify.txt; docs/evidence/2026-01-23/test.txt; docs/evidence/2026-01-23/seam-ledger.json; docs/evidence/2026-01-23/proof-tape.json; docs/evidence/2026-01-23/assumption-alarm.json; docs/evidence/2026-01-23/cipher-gate.json
  - Summary: Added MeechieToolSeam with deterministic Meechie tools UI and updated seam inventory, fixtures, mocks, adapters, and tests.
  - Risks: Evidence folder selection by date could misclassify the latest run; mitigate by rerunning verify if dates drift.

## 2026-01-23 - Cipher Gate automation (plan + self-critique)
- Date: 2026-01-23
- Decision: Add a cipher gate script that enforces a proof-summary entry in `DECISIONS.md`.
- Context: User requested a synthesis-driven gate to reduce shortcutting and highlight evidence links.
- Alternatives: Rely on evidence files only; require manual checklist sign-off.
- Consequences: `npm run verify` now enforces cipher presence and freshness.
- Revisit criteria: If cipher entries become burdensome or evidence paths change.
- Plan:
  - Goal: enforce cipher format and staleness checks deterministically.
  - Seams: none (tooling only).
  - Files:
    - `scripts/cipher-gate.mjs`
    - `package.json`
    - `AGENTS.md`
    - `docs/evidence/README.md`
    - `DECISIONS.md`
  - Commands: `npm run verify`.
- Self-critique: The riskiest assumption is that date-based staleness checks align with real changes; evidence is the `cipher-gate.json` output in `docs/evidence/YYYY-MM-DD/`.

## 2026-01-23 - Assumption alarm automation (plan + self-critique)
- Date: 2026-01-23
- Decision: Add an assumption alarm script that enforces logged assumptions for blocked probes.
- Context: User requested stronger visibility for unproven seams to reduce AI shortcutting.
- Alternatives: Rely on manual notes in `DECISIONS.md` or ignore blocked probes.
- Consequences: `npm run verify` now blocks if blocked probes lack assumptions or validation plans.
- Revisit criteria: If blocked probes are removed or assumption format changes.
- Plan:
  - Goal: enforce assumption format and seam coverage deterministically.
  - Seams: none (tooling only).
  - Files:
    - `scripts/assumption-alarm.mjs`
    - `package.json`
    - `AGENTS.md`
    - `docs/evidence/README.md`
    - `DECISIONS.md`
  - Commands: `npm run verify`.
- Self-critique: The riskiest assumption is that blocked probes always require a single umbrella assumption; evidence is the `assumption-alarm.json` report.

## 2026-01-23 - Assumption (blocked probes for v1)
- Assumption:
  - Date: 2026-01-23
  - Seams: AuthContextSeam, CreationStoreSeam, ChatInterpretationSeam, ProviderAdapterSeam, SessionSeam
  - Statement: Probes are blocked in v1 due to missing credentials or environment; adapters remain stubbed and deterministic for now.
  - Validation: Run probes when credentials/environment are available; update fixtures and evidence accordingly.
  - Status: closed (browser probes ran 2026-02-05; provider probes ran 2026-02-01)

## 2026-01-23 - Git hooks + CI enforcement (plan + self-critique)
- Date: 2026-01-23
- Decision: Add local git hooks and CI workflow to run `npm run verify`.
- Context: User requested automatic enforcement without relying on manual commands.
- Alternatives: Manual verify only; local hooks without CI.
- Consequences: Commits and pushes are gated locally; CI blocks unverified changes.
- Revisit criteria: If verify becomes too slow for local workflows or CI cost is prohibitive.
- Plan:
  - Goal: add local hooks and a CI workflow for verification.
  - Seams: none (tooling only).
  - Files:
    - `.githooks/pre-commit`
    - `.githooks/pre-push`
    - `scripts/install-githooks.mjs`
    - `.github/workflows/verify.yml`
    - `package.json`
    - `AGENTS.md`
    - `docs/evidence/README.md`
    - `DECISIONS.md`
  - Commands: `npm run hooks:install`, `npm run verify`.
- Self-critique: The riskiest assumption is that local hooks will be enabled consistently; evidence is the hooks install output and CI workflow definition.

## 2026-01-23 - Wu-Bob response format (micro plan + self-critique)
- Date: 2026-01-23
- Decision: Require Wu-Bob responses to include separate Wu-Tang and Uncle Bob lenses plus a synthesis.
- Context: User requested explicit Uncle Bob commentary alongside Wu-Tang perspectives.
- Alternatives: Keep mixed responses without explicit separation.
- Consequences: Wu-Bob responses will always show clean-code critique separately.
- Revisit criteria: If this format becomes too verbose for routine replies.
- Plan (micro):
  - Goal: add a response format rule in `AGENTS.md`.
  - Seams: none (docs-only).
  - Files:
    - `AGENTS.md`
    - `DECISIONS.md`
  - Commands: none.
- Self-critique (micro): Risk of verbosity; evidence is the updated rule in `AGENTS.md`.

## 2026-01-23 - Wu-Bob response format (combined voice) (micro plan + self-critique)
- Date: 2026-01-23
- Decision: Wu-Bob responses must be a single combined voice that blends Wu-Tang roster input with Uncle Bob’s clean-code lens.
- Context: User requested preserving synthesis and avoiding separated sections.
- Alternatives: Keep the three-section format or add a separate Uncle Bob appendix.
- Consequences: Wu-Bob feedback stays unified while still covering clean-code concerns.
- Revisit criteria: If combined responses hide clean-code accountability or become too vague.
- Plan (micro):
  - Goal: update Wu-Bob response guidance in `AGENTS.md`.
  - Seams: none (docs-only).
  - Files:
    - `AGENTS.md`
    - `DECISIONS.md`
  - Commands: none.
- Self-critique (micro): Risk of losing explicit separation; evidence is the updated rule in `AGENTS.md`.

## 2026-01-23 - README context update (micro plan + self-critique)
- Date: 2026-01-23
- Decision: Replace the default README with project-specific Seam-Driven Development and Wu-Tang coding context plus local commands.
- Context: User requested that the 70% problem explanation be captured for non-coders.
- Alternatives: Keep default Svelte README; store explanation only in docs.
- Consequences: README becomes the primary project overview and command reference.
- Revisit criteria: If onboarding needs a longer tutorial or separate docs structure.
- Plan (micro):
  - Goal: add a concise explanation and standard commands.
  - Seams: none (docs-only).
  - Files:
    - `README.md`
    - `DECISIONS.md`
  - Commands: none.
- Self-critique (micro): Risk of oversimplifying the workflow; evidence is the updated README content.

## 2026-01-23 - Meechie tools (plan + self-critique)
- Date: 2026-01-23
- Decision: Add a MeechieToolSeam with deterministic templates plus a UI page for the proposed humor tools.
- Context: User requested ranking and implementation of multiple Meechie feature ideas while away.
- Alternatives: Keep ideas as presets only or defer to a separate repo.
- Consequences: New seam artifacts, UI route, and documentation updates are required.
- Revisit criteria: If the tool set grows beyond deterministic templates or requires external APIs.
- Plan:
  - Goal: implement the nine Meechie features as deterministic tools behind a new seam and expose them in UI.
  - Seams: MeechieToolSeam.
  - Files:
    - `contracts/meechie-tool.contract.ts`
    - `fixtures/meechie-tool/sample.json`
    - `fixtures/meechie-tool/fault.json`
    - `src/lib/mocks/meechie-tool.mock.ts`
    - `src/lib/adapters/meechie-tool.adapter.ts`
    - `tests/contract/meechie-tool.test.ts`
    - `docs/seams.md`
    - `src/routes/meechie/+page.svelte`
    - `src/routes/+layout.svelte`
    - `CHANGELOG.md`
    - `LESSONS_LEARNED.md`
    - `DECISIONS.md`
  - Commands: `npm run verify`, `npm test`.
- Self-critique: The riskiest assumption is that deterministic templates are sufficient to represent the comedic tone without LLM help; evidence will be contract tests, fixtures, and UI wiring.
## 2026-01-27 - Alignment phrase consistency (plan + self-critique)
- Date: 2026-01-27
- Decision: Keep the alignment sentence identical across PromptAssemblySeam and DriftDetectionSeam by introducing a shared helper so prompt generation, validation, fixtures, and probes stay in sync.
- Context: The alignment language informs the prompt assembly template and the drift detection checks; duplication risked drift or new failure modes when the provider limit shifted or the spec changed.
- Alternatives: Maintain separate strings per seam or allow the sentence to evolve independently; both choices would require repeated fixture/probe audits and raise the likelihood of missing a violation.
- Consequences: Added `src/lib/utils/alignment-line.ts`, reused it in both adapters, and updated prompt/drift fixtures plus the image-generation probe so they all emit “all numbers vertically aligned; all text left-aligned; treat blank space as intentional; do not fill empty space.”
- Revisit criteria: Revisit if alignment rules need to diverge per list mode, page size, or localized languages so the helper can be extended responsibly.
- Plan:
  - Goal: Synchronize the deterministic alignment clause across prompt assembly, drift detection, fixtures, and probes so the same sentence is generated and verified.
  - Seams: PromptAssemblySeam, DriftDetectionSeam.
  - Files:
    - `src/lib/utils/alignment-line.ts`
    - `src/lib/adapters/prompt-assembly.adapter.ts`
    - `src/lib/adapters/drift-detection.adapter.ts`
    - `fixtures/prompt-assembly/sample.json`
    - `fixtures/prompt-assembly/title-only.json`
    - `fixtures/drift-detection/sample.json`
    - `fixtures/drift-detection/title-only.json`
    - `fixtures/drift-detection/fault.json`
    - `fixtures/image-generation/sample.json`
    - `fixtures/image-generation/dense-scene.json`
    - `probes/image-generation.probe.mjs`
  - Commands: `npm test`, `npm run verify`.
- Self-critique: The riskiest assumption was that every artifact would be updated; evidence is the uniform sentence in fixtures/probes and the passing verify outputs showing no drift between prompt assembly and the drift detection scan.

## 2026-01-27 - Plan checklist + evidence refresh
- Date: 2026-01-27
- Decision: Capture the detailed remaining-work checklist and tie it to the latest `docs/evidence/2026-01-27` proof so the governance plan stays auditable.
- Context: After editing prompt/governance docs, the checklist needed a granular rewrite that the Cipher Gate could track.
- Alternatives: Keep the checklist informal or rely on the previous cipher entry; both would leave the newest docs without a matching proof.
- Consequences: Future doc updates now require new cipher entries and linked evidence entries.
- Revisit criteria: Add a new entry whenever the checklist/plan or evidence path changes.
- Plan:
  - Goal: Log the checklist updates and point the cipher entry to the new evidence artifacts.
  - Seams: Governance.
  - Files: `DECISIONS.md`, `docs/CHECKLIST.md`, `CHANGELOG.md`, `LESSONS_LEARNED.md`, `AGENTS.md`.
  - Commands: `npm test`, `npm run verify`.
- Self-critique: The risk is forgetting to refresh this entry after future docs-only edits; evidence is this entry and the verify outputs under `docs/evidence/2026-01-27`.

- Cipher Gate:
  - Date: 2026-01-27
  - Seams: Governance
  - Evidence: docs/evidence/2026-01-27/test.txt; docs/evidence/2026-01-27/verify.txt; docs/evidence/2026-01-27/chamber-lock.json; docs/evidence/2026-01-27/seam-ledger.json
  - Summary: Documented the granular checklist update and tied the latest verify evidence to the gate.
  - Risks: Must update this cipher entry whenever governance docs change again.

## 2026-01-27 - Manual/chat builder + storage + PWA enforcement
- Date: 2026-01-27
- Decision: Gate the UI around the full seam loop, persist creations/drafts under the new storage keys, and polish the PWA manifest/icons so the Meechie coloring experience stays deterministic and installable.
- Context: To keep the product autonomous, we needed the manual + chat builders to trigger all seams without shortcuts, ensure creation storage/drafts remain deterministic, and deliver Android install metadata without introducing accidental I/O.
- Alternatives: Let the UI skip validation on Generate, store creations in uncontrolled storage, or defer the PWA polish until later; all would break Seam-Driven Development compliance.
- Consequences: `Generate` now waits for `SpecValidationSeam`, the UI surfaces prompts/violations, creation favorites/deletion operate through `CreationStoreSeam`, drafts persist via `cb_drafts_v1`, and the manifest now lists PNG/maskable icons for Android install.
- Revisit criteria: Only revisit if new storage requirements, creation features, or PWA expectations arise.
- Plan:
  - Goal: Enforce the entire seam loop in the main page, extend creation/draft persistence, and deliver Android-ready PWA metadata.
  - Seams: SpecValidationSeam, PromptAssemblySeam, DriftDetectionSeam, CreationStoreSeam, SessionSeam, OutputPackagingSeam.
  - Files:
    - `src/routes/+page.svelte`
    - `contracts/spec-validation.contract.ts`
    - `fixtures/spec-validation/*`
    - `tests/contract/spec-validation.test.ts`
    - `src/lib/adapters/spec-validation.adapter.ts`
    - `src/lib/adapters/creation-store.adapter.ts`
    - `static/manifest.webmanifest`
    - `static/icons/icon-192.png`
    - `static/icons/icon-512.png`
    - `static/icons/icon-maskable.png`
    - `docs/evidence/2026-01-27/npm-test-2026-01-27-0330.txt`
    - `docs/evidence/2026-01-27/npm-verify-2026-01-27-0340.txt`
    - `docs/evidence/2026-01-27/npm-build-2026-01-27-0350.txt`
  - Commands: `npm test`, `npm run verify`, `npm run build`.
- Self-critique: The risk was that Surface-bias in the UI might tempt us to skip validation or storage; we guard by gating the Generate button on validation results and persisting everything through the adapters plus evidence logs.
- Cipher Gate:
  - Date: 2026-01-27
  - Seams: SpecValidationSeam, PromptAssemblySeam, DriftDetectionSeam, CreationStoreSeam, SessionSeam, OutputPackagingSeam
  - Evidence: docs/evidence/2026-01-27/npm-test-2026-01-27-0330.txt; docs/evidence/2026-01-27/npm-verify-2026-01-27-0340.txt; docs/evidence/2026-01-27/npm-build-2026-01-27-0350.txt
  - Summary: Added validation gating, creation favorite/delete controls, indefinite draft persistence, and Android-ready manifest/icons while proving the flow with full `npm test`/`npm run verify`/`npm run build` evidence.
  - Risks: Need to rerun the gate if we alter any seam that touches validation, storage, or packaging again.

- Cipher Gate:
  - Date: 2026-02-01
  - Seams: ProviderAdapterSeam
  - Evidence: docs/evidence/2026-02-01/rewind-ProviderAdapterSeam.txt; docs/evidence/2026-02-01/npm-test.txt; docs/evidence/2026-02-01/npm-verify.txt; docs/evidence/2026-02-01/probe-provider-adapter.txt; docs/evidence/2026-02-01/probe-chat-interpretation.txt; docs/evidence/2026-02-01/probe-image-generation.txt
  - Summary: Refreshed provider/chat/image probes and aligned ProviderAdapterSeam fault status handling with probe-backed fixtures.
  - Risks: Provider error status codes can change; fixtures and test stubs must be refreshed when probes change.

- Cipher Gate:
  - Date: 2026-02-12
  - Seams: ImageGenerationSeam
  - Evidence: docs/evidence/2026-02-12/probe-image-generation.txt; docs/evidence/2026-02-12/npm-test.txt; docs/evidence/2026-02-12/npm-verify.txt; docs/evidence/2026-02-12/chamber-lock.json; docs/evidence/2026-02-12/shaolin-lint.json; docs/evidence/2026-02-12/assumption-alarm.json; docs/evidence/2026-02-12/seam-ledger.json; docs/evidence/2026-02-12/clan-chain.json; docs/evidence/2026-02-12/proof-tape.json
  - Summary: Made ImageGenerationSeam prompt phrase validation case-insensitive across server and adapter, then refreshed probe-backed fixtures.
  - Risks: If deterministic gating depends on exact casing, prompts that previously failed may now pass.

## 2026-04-15 - UI redesign follow-up: review feedback fixes
- Date: 2026-04-15
- Decision: Address review feedback from PR #8 (dark theme redesign): add `color-scheme: dark`, replace hardcoded colors in MeechieTools with CSS custom properties, auto-expand More controls when validation issues target advanced fields.
- Context: PR #8 introduced a full dark-theme redesign. Code review (Gemini + Sourcery) flagged missing `color-scheme: dark`, hardcoded color literals in MeechieTools, and UX gaps where collapsed `<details>` sections hid important information from users. Note: the API key UI section was removed in this same PR (see entry below), so API key discoverability changes do not apply here.
- Alternatives: Leave hardcoded colors as-is (would cause theme drift on future palette changes), leave advanced section always collapsed (risks users missing validation errors in hidden fields).
- Consequences: Native browser controls now render dark, MeechieTools theme is derived from shared CSS vars, and validation errors for advanced fields automatically expand that section. Palette CSS variables moved to `+layout.svelte` so all routes have them without relying on `+page.svelte` being mounted.
- Revisit criteria: Revisit if the color palette changes or if new advanced fields are added to the builder.
- Plan:
  - Goal: Apply review feedback from PR #8.
  - Seams: None (UI + tests change, no contract changes).
  - Files: `src/routes/+page.svelte`, `src/routes/+layout.svelte`, `src/lib/components/MeechieTools.svelte`, `contracts/spec-validation.contract.ts`, `DECISIONS.md`.
  - Commands: `npm test`, `npm run verify`.
- Self-critique: Moving `:global(body)` palette vars to layout means they are always loaded; any future page-level override must still use `:global()` to avoid specificity issues.

- Cipher Gate:
  - Date: 2026-04-15
  - Seams: None (UI only)
  - Evidence: docs/evidence/2026-04-15/test.txt; docs/evidence/2026-04-15/verify.txt
  - Summary: Applied PR #8 review feedback: color-scheme dark, CSS var consistency in MeechieTools (vars moved to layout), advanced-fields validation auto-expand with ADVANCED_SPEC_FIELDS exported from contract. 155 tests pass (1 skipped).
  - Risks: If palette variables are renamed in layout in future, MeechieTools will lose its colors silently.

## 2026-04-15 - Move API key to server env var; remove client-side key entry
- Date: 2026-04-15
- Decision: Remove the user-facing API Key Settings panel and all client-side API key management. The server reads `XAI_API_KEY` from the Vercel environment variable exclusively.
- Context: The API key was previously entered by users in the browser, stored in localStorage, and forwarded as an `x-api-key` header. This exposed the key in the browser and created unnecessary friction. Since `XAI_API_KEY` is already set as a Vercel environment variable, the server can use it directly.
- Alternatives: Keep user-supplied keys as an override path; rejected because it adds UI complexity and a potential security surface with no benefit when the server key is already configured.
- Consequences: `createProviderAdapter({})` is called with no config, falling back to `process.env.XAI_API_KEY`. The `x-api-key` header forwarding is removed from all pipelines. `buildJsonHeaders` and `postJson` in `http-client.ts` no longer accept or forward a key. `TEMP_API_KEY_STORAGE_KEY` and localStorage helpers are removed.
- Revisit criteria: Only revisit if the product needs per-user API keys in the future.
- Plan:
  - Goal: Stop accepting client-supplied API keys and use server env var only.
  - Seams: None (pipeline + UI change, no contract changes).
  - Files: `src/lib/core/image-generation-pipeline.ts`, `src/lib/core/generate-pipeline.ts`, `src/routes/api/generate/+server.ts`, `src/routes/api/image-generation/+server.ts`, `src/routes/+page.svelte`, `src/lib/core/http-client.ts`, `tests/unit/api-image-generation.test.ts`, `tests/unit/http-client.test.ts`.
  - Commands: `npm test`, `npm run verify`.
- Self-critique: Risk is that if `XAI_API_KEY` is not set on the server, all image generation will return 401. This is the correct behavior — misconfigured env is a server ops issue, not a user issue.

- Cipher Gate:
  - Date: 2026-04-15
  - Seams: None (pipeline + UI only)
  - Evidence: docs/evidence/2026-04-15/npm-test-2026-04-15.txt
  - Summary: Removed client-side API key entry; server now always uses XAI_API_KEY env var. All 155 tests pass.
  - Risks: If XAI_API_KEY is unset on Vercel, all generation requests will return 401 with a clear error message.

## 2026-04-24 - Demo storage test environment fix
- Date: 2026-04-24
- Decision: Use a deterministic Vitest localStorage shim, make verification command wrappers capture output correctly on Windows, and pin the Vercel serverless runtime to Node 22.
- Context: The local demo gate was blocked because Node exposed a partial localStorage global during tests, causing SessionSeam and CreationStoreSeam tests to fail even though the production browser adapters still target real localStorage. The seam-scoped rewind wrapper also produced blank evidence on Windows because it spawned `npx` in a non-portable way, and verify-runner could not reliably spawn `npm`. A production build under local Node v25 also required an explicit Vercel runtime.
- Alternatives: Change production adapters to inject storage; rejected for the demo blocker because it would widen behavior change beyond the failing test environment. Use shell-based `npx`; rejected after it worked but emitted a Node warning about shell argument handling. Switch local Node versions; deferred because pinning the Vercel runtime is explicit and matches supported deployment runtime.
- Consequences: Vitest now loads `tests/setup/local-storage.ts` before tests, giving adapter tests stable `getItem`, `setItem`, `removeItem`, and `clear` behavior. `scripts/rewind.mjs` runs the local Vitest CLI through Node, `scripts/verify-runner.mjs` captures fixed `npm run check` and `npm test` output, and `svelte.config.js` declares `nodejs22.x` for Vercel serverless output.
- Revisit criteria: Revisit when storage is moved behind a database-backed adapter or when Vitest/jsdom behavior changes enough that the shim is no longer needed.
- Plan:
  - Goal: Restore deterministic browser storage behavior in tests and reliable evidence capture on Windows.
  - Seams: SessionSeam, CreationStoreSeam.
  - Files: `plan.md`, `vite.config.ts`, `tests/setup/local-storage.ts`, `scripts/rewind.mjs`, `scripts/verify-runner.mjs`, `svelte.config.js`, `DECISIONS.md`.
  - Commands: `npm run check`, `npm test`, `npm run rewind -- --seam SessionSeam`, `npm run rewind -- --seam CreationStoreSeam`, `npm run verify`, `npm run build`.
- Self-critique: The risk is that a test shim could hide browser storage quirks; we contain that by only changing Vitest setup and leaving production adapters unchanged. Local `npm run build` still requires Windows symlink permission for adapter-vercel output.

- Cipher Gate:
  - Date: 2026-04-24
  - Seams: SessionSeam, CreationStoreSeam
  - Evidence: docs/evidence/2026-04-24/rewind-SessionSeam.txt; docs/evidence/2026-04-24/rewind-CreationStoreSeam.txt; docs/evidence/2026-04-24/test.txt; docs/evidence/2026-04-24/verify.txt; docs/evidence/2026-04-24/chamber-lock.json; docs/evidence/2026-04-24/shaolin-lint.json; docs/evidence/2026-04-24/assumption-alarm.json; docs/evidence/2026-04-24/seam-ledger.json; docs/evidence/2026-04-24/clan-chain.json; docs/evidence/2026-04-24/proof-tape.json
  - Summary: Fixed demo-blocking localStorage failures in test setup, repaired Windows evidence capture for seam rewind and full verification, and pinned the Vercel runtime to Node 22.
  - Risks: Future database/auth work should replace this with contract-backed database fixtures instead of expanding browser storage behavior. Local production build output still depends on Windows symlink support for adapter-vercel.

## 2026-05-03 - Preserve Meechie studio text across drafts and vault reload
- Date: 2026-05-03
- Decision: Store an optional Meechie studio text snapshot on CreationStoreSeam draft and creation records, and normalize AI-generated page labels before building ColoringPageSpec values.
- Context: Review found that refreshes dropped generated Meechie words, vault reloads could display the image-generation prompt as the quote, and valid MeechieStudioTextSeam output could still violate SpecValidationSeam label limits.
- Alternatives: Add only page-level fallbacks without changing CreationStoreSeam; rejected because new vault/draft records need a durable quote/title/items snapshot. Make `studioText` required; rejected because existing localStorage records would fail schema parsing.
- Consequences: New records keep `assembledPrompt` for image diagnostics and `studioText` for user-facing Meechie copy. Existing draft/creation records still parse, with best-effort text rebuilt from the saved coloring-page spec.
- Revisit criteria: Revisit when durable server storage replaces browser storage, or when CreationStoreSeam gains a separate evidence field.
- Plan:
  - Goal: Fix review regressions for draft rehydration, vault quote preservation, and invalid AI labels.
  - Seams: CreationStoreSeam, MeechieStudioTextSeam, SpecValidationSeam.
  - Files: `contracts/creation-store.contract.ts`, `fixtures/creation-store/sample.json`, `tests/contract/creation-store.test.ts`, `src/lib/core/meechie-studio.ts`, `tests/unit/meechie-studio.test.ts`, `src/routes/+page.svelte`, `scripts/verify-runner.mjs`, `docs/seams.md`, `DECISIONS.md`.
  - Commands: `$env:NODE_OPTIONS="--max-old-space-size=8192"; npm.cmd test -- tests/unit/meechie-studio.test.ts tests/contract/creation-store.test.ts --pool=forks --maxWorkers=1`, `$env:NODE_OPTIONS="--max-old-space-size=8192"; npm.cmd run check`, `$env:NODE_OPTIONS="--max-old-space-size=8192"; npm.cmd test`, `$env:NODE_OPTIONS="--max-old-space-size=8192"; npm.cmd run verify`, `npm.cmd run cipher:gate`.
- Self-critique: Optional `studioText` keeps old records readable but cannot recover the exact quote from old vault entries that only stored a long image prompt. The durable fix starts with new saves; old records use the coloring-page title/items as fallback.

- Cipher Gate:
  - Date: 2026-05-03
  - Seams: CreationStoreSeam, MeechieStudioTextSeam, SpecValidationSeam
  - Evidence: docs/evidence/2026-05-03/targeted-review-regressions.txt; docs/evidence/2026-05-03/check.txt; docs/evidence/2026-05-03/test.txt; docs/evidence/2026-05-03/verify.txt
  - Summary: Added optional `studioText` snapshots for draft/vault reloads, kept image prompts separate from Meechie quotes, normalized generated labels before spec validation, and constrained verify-runner's Vitest worker count to avoid Windows native worker OOM during evidence capture.
  - Risks: Legacy vault entries that already stored only image prompts cannot recover the original quote; they remain readable with best-effort fallback.

- Cipher Gate:
  - Date: 2026-05-06
  - Seams: AppConfigSeam, ProviderAdapterSeam
  - Evidence: docs/evidence/2026-05-06/proof-tape.json
  - Summary: Removed raw `process.env` access from `app-config-seam` and `provider-adapter` to securely manage API keys and configs. Exclusively injects configurations via `$env/dynamic/private`.
  - Risks: Test environments relying on implicit `process.env` loading may need explicit configurations passed in during instantiation.

- Cipher Gate:
    Date: 2026-05-10
    Seams: ProviderAdapterSeam
    Evidence: pending — verify pipeline requires XAI_API_KEY not available in this environment
    Summary: Added Zod validation (XAIChatResponseSchema, XAIImageResponseSchema) at xAI provider boundary. Returns PROVIDER_INVALID_RESPONSE for structurally invalid payloads. Applied .nullish() to optional fields to handle null returns from API.
    Risks: Cannot produce live probe evidence without XAI_API_KEY.

- Cipher Gate:
  - Date: 2026-05-14
  - Seams: ImageGenerationSeam
  - Evidence: docs/evidence/2026-05-14/rewind-ImageGenerationSeam.txt; docs/evidence/2026-05-14/test.txt; docs/evidence/2026-05-14/verify.txt; docs/evidence/2026-05-14/proof-tape.md
  - Summary: Added an adapter-level HTTP failure assertion for ImageGenerationSeam while preserving mock-first contract coverage, repaired shared result-schema typing so parsed failures keep required error objects, and addressed open PR review feedback for studio draft/spec synchronization, try-on portrait packaging, locale-aware USD formatting, empty revised-prompt fallback preservation, and shared text-model fallback selection.
  - Risks: ImageGenerationSeam fixtures are older than seven days; this pass does not refresh live xAI fixtures because no live provider credentials were supplied, so the waiver below preserves deterministic fixture use until a credentialed probe can refresh them.

- Assumption:
  - Date: 2026-05-14
  - Seams: ImageGenerationSeam
  - Statement: Existing ImageGenerationSeam sample/fault fixtures remain representative for review-comment repairs even though they are older than seven days.
  - Validation: Run `npm run rewind -- --seam ImageGenerationSeam`, `npm run verify`, and schedule a credentialed `probes/image-generation.probe.mjs` refresh when XAI_API_KEY is available.
  - Status: Waived for this review-comment repair because live xAI credentials are not present in the non-interactive environment.

- Cipher Gate:
  - Date: 2026-05-16
  - Seams: MeechieStudioTextSeam, MeechieToolSeam, ChatInterpretationSeam, ImageGenerationSeam, OutputPackagingSeam, CreationStoreSeam, SpecValidationSeam
  - Evidence: docs/evidence/2026-05-16/test.txt; docs/evidence/2026-05-16/verify.txt; docs/evidence/2026-05-16/proof-tape.md
  - Summary: Addressed PR #65 review blockers by trimming configured text-model IDs, restoring evidence autosave, persisting dedication changes into draft specs, aborting try-on export after spec-sync failures, clearing stale try-on export artifacts, and removing the Svelte `HTMLSelectElement` lint issue.
  - Risks: UI handler behavior is validated by Svelte compile checks and full test gates, but no browser click-through was run in this pass.

- Cipher Gate:
  - Date: 2026-05-16
  - Seams: MeechieStudioTextSeam, ProviderAdapterSeam
  - Evidence: docs/evidence/2026-05-16/test.txt; docs/evidence/2026-05-16/verify.txt; docs/evidence/2026-05-16/proof-tape.md
  - Summary: Changed the missing `XAI_API_KEY` studio-text path to return a structured `ok: false` response with HTTP 200 so local demos keep the visible error message without browser console resource errors.
  - Risks: Consumers that depended on HTTP 401 for absent local configuration now need to read the structured error body; real non-configuration provider failures still return error status codes.

- Cipher Gate:
  - Date: 2026-05-16
  - Seams: ChatInterpretationSeam, ProviderAdapterSeam
  - Evidence: docs/evidence/2026-05-16/test.txt; docs/evidence/2026-05-16/verify.txt; docs/evidence/2026-05-16/proof-tape.md
  - Summary: Addressed PR #69 review blockers by preserving provider error details in chat interpretation failures and removing direct `console.warn` process logging from the shared JSON request helper.
  - Risks: Client callers now receive a thrown parse error for unreadable JSON responses instead of a null payload, relying on their existing request error handlers.

- Cipher Gate:
  - Date: 2026-05-16
  - Seams: DriftDetectionSeam
  - Evidence: docs/evidence/2026-05-16/rewind-DriftDetectionSeam.txt; docs/evidence/2026-05-16/test.txt; docs/evidence/2026-05-16/verify.txt; docs/evidence/2026-05-16/proof-tape.md
  - Summary: Restored drift detection fallback so an empty or whitespace-only revised prompt uses the original prompt sent for validation.
  - Risks: If a future provider needs empty revised prompts to be treated as authoritative output, it should add an explicit contract field instead of overloading an empty string.

- Cipher Gate:
  - Date: 2026-05-16
  - Seams: ImageProviderConfigSeam, ImageGenerationSeam, AppConfigSeam
  - Evidence: docs/evidence/2026-05-16/rewind-ImageGenerationSeam.txt; docs/evidence/2026-05-16/test.txt; docs/evidence/2026-05-16/verify.txt; docs/evidence/2026-05-16/proof-tape.md
  - Summary: Addressed PR #70 review blockers by keeping image generation on the new narrow image-provider config seam, applying README-documented defaults for optional image env values, rejecting malformed base URLs at the config boundary, and deriving the config type from the validation schema.
  - Risks: Blank optional image env values remain invalid rather than defaulted, so deployments should unset optional keys when they want documented defaults.

- Assumption:
  - Date: 2026-05-16
  - Seams: ImageProviderConfigSeam
  - Statement: ImageProviderConfigSeam is a config-only seam, so its probe is represented by deterministic adapter tests rather than live network I/O.
  - Validation: Run `npm.cmd test -- src/lib/seams/image-provider-config-seam/test.ts --pool=forks --maxWorkers=1`, `npm.cmd run verify`, and refresh this assumption if the seam starts reading live provider state.
  - Status: Active for PR #70 because the seam reads environment values only and has no live provider call to probe.

- Cipher Gate:
  - Date: 2026-05-16
  - Seams: MeechieStudioTextSeam, ProviderAdapterSeam, ImageGenerationSeam, SpecValidationSeam, MeechieToolSeam
  - Evidence: docs/evidence/2026-05-16/rewind-ImageGenerationSeam.txt; docs/evidence/2026-05-16/test.txt; docs/evidence/2026-05-16/verify.txt; docs/evidence/2026-05-16/proof-tape.md
  - Summary: Addressed PR #67 review blockers by keeping studio-text parse diagnostics inside the structured seam error instead of direct logging, aligning the image-generation fault fixture prompt with required prompt phrases, exporting the shared PageSize type, deduplicating the page-size prompt check, and keeping MeechieToolSeam exhaustiveness explicit.
  - Risks: Studio text failures now expose a short provider-content preview to callers for debugging; callers should treat it as diagnostic text, not user-facing copy.

- Cipher Gate:
  - Date: 2026-05-16
  - Seams: CacheSeam
  - Evidence: docs/evidence/2026-05-16/rewind-CacheSeam.txt; docs/evidence/2026-05-16/test.txt; docs/evidence/2026-05-16/verify.txt; docs/evidence/2026-05-16/proof-tape.md
  - Summary: Addressed PR #66 review blockers by making service-worker install and activation reject when CacheSeam returns an error, validating cache names and URL lists before Web Cache API calls without bundling Zod into the service worker, preserving distinct open/addAll error codes, surfacing failed stale-cache deletion keys, logging cache-match fallback warnings, and marking CacheSeam's browser probe as a manual 2026-05-15 check.
  - Risks: CacheSeam still relies on manual browser probing for real Cache Storage behavior; Node tests use stubbed Cache Storage to prove adapter control flow.

## 2026-06-05 - Route generate orchestration through ImageGenerationSeam
- Date: 2026-06-05
- Decision: `/api/generate` composes `runImageGenerationPipeline` through an injected `ImageGenerationSeam` dependency instead of calling the sibling `/api/image-generation` route through raw internal HTTP.
- Context: The Handoff PR Resolution drain identified PR #112 as the high-value branch for removing the brittle sibling-route fetch, but that idea needed a guard so thrown image adapter exceptions still return contract-shaped errors instead of generic SvelteKit failures.
- Alternatives: Keep the sibling HTTP fetch and add broader `postJson` handling; rejected because it preserves unnecessary internal network I/O. Merge PR #112 directly; rejected because the replacement branch can implement the behavior on current stacked code with explicit thrown-error tests and ledger evidence.
- Consequences: Core generate orchestration receives a typed image pipeline dependency, preserves typed image failures, rejects invalid image pipeline bodies, and maps unexpected thrown image errors to structured 502/504 responses. The route layer owns adapter construction, keeping Seam-Driven Development boundaries explicit.
- Revisit criteria: Revisit if `ImageGenerationSeam` gains a separate idempotent queue, streaming output, or another transport boundary that should be orchestrated outside the SvelteKit route.
- Plan:
  - Goal: Route `/api/generate` through `runImageGenerationPipeline`/`ImageGenerationSeam` while preserving structured image-generation failures and guarding thrown image exceptions.
  - Seams: ImageGenerationSeam, SpecValidationSeam, OutputPackagingSeam, ProviderAdapterSeam.
  - Files: `plan.md`, `src/lib/core/generate-pipeline.ts`, `src/routes/api/generate/+server.ts`, `tests/unit/api-generate.test.ts`, `tests/unit/pipeline-edge-cases.test.ts`, `docs/hpr-pr-resolution-ledger-2026-06-05.md`, `DECISIONS.md`.
  - Commands: `npm.cmd test -- tests/unit/api-generate.test.ts --pool=forks --maxWorkers=1`, `npm.cmd test -- tests/unit/api-generate.test.ts tests/unit/image-generation-pipeline.test.ts tests/contract/image-generation.test.ts --pool=forks --maxWorkers=1`, `npm.cmd run rewind -- --seam ImageGenerationSeam`, `npm.cmd run check`, `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build`, `npm.cmd run verify`, `npm.cmd run cipher:gate`, `git diff --check`.
- Self-critique: A direct function call could have hidden status mapping changes or widened core I/O, so tests prove success, typed failure, invalid returned bodies, generic thrown errors, timeout thrown errors, and route parse guards. The remaining risks are baseline lint debt and Windows Vercel adapter symlink failure, both tracked separately.

- Cipher Gate:
  - Date: 2026-06-05
  - Seams: ImageGenerationSeam, SpecValidationSeam, OutputPackagingSeam, ProviderAdapterSeam
  - Evidence: docs/evidence/2026-06-05/hpr-generate-image-seam-red-api-generate.txt; docs/evidence/2026-06-05/hpr-generate-image-seam-green-api-generate.txt; docs/evidence/2026-06-05/hpr-generate-image-seam-targeted-forks.txt; docs/evidence/2026-06-05/hpr-generate-image-seam-pipeline-edge-cases.txt; docs/evidence/2026-06-05/hpr-generate-image-seam-rewind.txt; docs/evidence/2026-06-05/hpr-generate-image-seam-check.txt; docs/evidence/2026-06-05/hpr-generate-image-seam-lint.txt; docs/evidence/2026-06-05/hpr-generate-image-seam-test.txt; docs/evidence/2026-06-05/hpr-generate-image-seam-build.txt; docs/evidence/2026-06-05/hpr-generate-image-seam-verify.txt; docs/evidence/2026-06-05/hpr-generate-image-seam-cipher-gate.txt; docs/evidence/2026-06-05/hpr-generate-image-seam-exit-codes.txt
  - Summary: Removed the raw internal `/api/image-generation` fetch from generate orchestration, injected the typed image pipeline dependency, preserved structured image-generation failures, and mapped unexpected thrown image errors to contract-shaped generate responses.
  - Risks: This does not yet address timeout signal propagation or provider retry policy; those remain in the later timeout/resilience workpack.

## 2026-06-05 - Gate generate requests with SafetyPolicySeam
- Date: 2026-06-05
- Decision: `/api/generate` now runs a `SafetyPolicySeam` generate-request check before spec validation, prompt assembly, image generation, or drift detection.
- Context: PR #115 correctly identified that the existing safety seam was not wired into the generate path, but its branch left valid review concerns around `styleHint`, optional-field safety, mock reset behavior, and core importing mock implementations.
- Alternatives: Merge PR #115 directly; rejected because unresolved review comments were still valid. Put keyword checks directly in `generate-pipeline.ts`; rejected because policy belongs behind the seam. Build a network-backed moderation adapter now; rejected as broader than this Handoff PR Resolution slice.
- Consequences: Unsafe title, item, footer, dedication, or `styleHint` text returns a structured `CONTENT_POLICY_VIOLATION` with the underlying `DISALLOWED_CONTENT` policy code and actionable field details. Core generation stays dependency-injected; the route composes the pure deterministic safety policy factory.
- Revisit criteria: Revisit when safety policy rules move to a live moderation provider, when fixture-scenario mock cleanup reaches `SafetyPolicySeam`, or when product policy needs more granular error codes.
- Plan:
  - Goal: Wire `SafetyPolicySeam` into `/api/generate` as the first generate-path gate while preserving structured errors and avoiding direct I/O in core.
  - Seams: SafetyPolicySeam, ImageGenerationSeam, SpecValidationSeam, PromptAssemblySeam, DriftDetectionSeam, ProviderAdapterSeam.
  - Files: `plan.md`, `src/lib/core/generate-pipeline.ts`, `src/routes/api/generate/+server.ts`, `src/lib/seams/safety-policy-seam/contract.ts`, `src/lib/seams/safety-policy-seam/fixtures.ts`, `src/lib/seams/safety-policy-seam/mock.ts`, `src/lib/seams/safety-policy-seam/policy.ts`, `src/lib/seams/safety-policy-seam/probe.ts`, `src/lib/seams/safety-policy-seam/test.ts`, `tests/unit/api-generate.test.ts`, `tests/unit/pipeline-edge-cases.test.ts`, `docs/hpr-pr-resolution-ledger-2026-06-05.md`, `DECISIONS.md`.
  - Commands: `npm.cmd test -- src/lib/seams/safety-policy-seam/test.ts tests/unit/api-generate.test.ts tests/unit/pipeline-edge-cases.test.ts --pool=forks --maxWorkers=1`, `npm.cmd run rewind -- --seam SafetyPolicySeam`, `npm.cmd run check`, `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build`, `npm.cmd run verify`, `npm.cmd run cipher:gate`, `git diff --check`.
- Self-critique: The main risk is that this deterministic policy remains implemented locally rather than by a live moderation provider; this work keeps that explicit by using a pure policy factory and recording future provider-backed safety as a revisit path. Baseline lint and Windows Vercel symlink build failures remain separate drain items.

- Cipher Gate:
  - Date: 2026-06-05
  - Seams: SafetyPolicySeam, ImageGenerationSeam, SpecValidationSeam, PromptAssemblySeam, DriftDetectionSeam, ProviderAdapterSeam
  - Evidence: docs/evidence/2026-06-05/hpr-safety-policy-generate-gate-red-targeted.txt; docs/evidence/2026-06-05/hpr-safety-policy-generate-gate-green-targeted.txt; docs/evidence/2026-06-05/hpr-safety-policy-generate-gate-rewind.txt; docs/evidence/2026-06-05/hpr-safety-policy-generate-gate-check.txt; docs/evidence/2026-06-05/hpr-safety-policy-generate-gate-lint.txt; docs/evidence/2026-06-05/hpr-safety-policy-generate-gate-test.txt; docs/evidence/2026-06-05/hpr-safety-policy-generate-gate-build.txt; docs/evidence/2026-06-05/hpr-safety-policy-generate-gate-verify.txt; docs/evidence/2026-06-05/hpr-safety-policy-generate-gate-cipher-gate.txt; docs/evidence/2026-06-05/hpr-safety-policy-generate-gate-exit-codes.txt
  - Summary: Added a first-step `SafetyPolicySeam` gate to generate orchestration, included `styleHint` in policy checks, surfaced actionable offending-field details, and kept core generation free of direct mock imports.
  - Risks: The policy is still a deterministic local keyword guardrail rather than a live moderation provider; future policy expansion should decide whether this remains sufficient.

## 2026-06-05 - Harden timeout, abort, and retry policy across image paths
- Date: 2026-06-05
- Decision: Shared HTTP resilience now distinguishes caller abort from provider timeout, caps retry delays, validates retry options with finite checks, and prevents automatic retries for billable provider image-generation POSTs without idempotency.
- Context: PRs #108/#85/#107/#100/#95 overlapped on timeout, abort, and retry behavior. Their useful ideas were valuable, but review comments identified timeout swallowing during body parsing, caller aborts being retried, uncapped delay growth, partial finite validation, and duplicate-billing risk for non-idempotent image POSTs.
- Alternatives: Merge PR #108/#85 directly; rejected because their review comments were still valid and the current stack already routes `/api/generate` through `ImageGenerationSeam`. Retry image POSTs by default; rejected because there is no idempotency key contract. Leave `fetchWithTimeout` as headers-only; rejected because body-read aborts could still be misclassified as invalid JSON.
- Consequences: `/api/generate`, `/api/image-generation`, and `/api/wig-try-on` thread `request.signal` through the relevant pipelines. `ImageGenerationSeam` returns `IMAGE_ABORTED` for caller cancellation and `IMAGE_TIMEOUT_ERROR` for true provider timeout, with pipeline status mapping to 499 and 504 respectively. `WigTryOnSeam` keeps existing public error codes while reporting body-read timeout as a network timeout. `ProviderAdapterSeam.createImageGeneration` no longer retries provider image POSTs automatically; chat retry behavior remains unchanged pending a separate product/idempotency decision.
- Revisit criteria: Revisit when provider image generation supports idempotency keys, when chat retry policy receives product approval for duplicate-call risk, or when route cancellation should propagate into prompt/spec/drift seams that currently perform local deterministic work.
- Plan:
  - Goal: Harden timeout, abort, and retry behavior so caller cancellation is not retried, true provider timeouts are contract-shaped responses, body-read aborts are not misreported as invalid JSON, retry inputs reject non-finite values, exponential backoff is capped, and billable provider image POSTs are not retried automatically.
  - Seams: ImageGenerationSeam, WigTryOnSeam, ProviderAdapterSeam, SpecValidationSeam, PromptAssemblySeam, DriftDetectionSeam.
  - Files: `plan.md`, `src/lib/core/http-resilience.ts`, `src/lib/adapters/provider-adapter.adapter.ts`, `src/lib/seams/image-generation-seam/contract.ts`, `src/lib/adapters/image-generation-seam/index.ts`, `src/lib/core/image-generation-pipeline.ts`, `src/lib/core/generate-pipeline.ts`, `src/routes/api/generate/+server.ts`, `src/routes/api/image-generation/+server.ts`, `src/lib/seams/wig-try-on-seam/contract.ts`, `src/lib/adapters/wig-try-on-seam/index.ts`, `src/lib/core/wig-try-on-pipeline.ts`, `src/routes/api/wig-try-on/+server.ts`, targeted tests, `docs/hpr-pr-resolution-ledger-2026-06-05.md`, `DECISIONS.md`.
  - Commands: focused red/green tests, `npm.cmd run check`, `npm.cmd run rewind -- --seam ImageGenerationSeam`, `npm.cmd run rewind -- --seam WigTryOnSeam`, `npm.cmd run rewind -- --seam ProviderAdapterSeam`, `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run verify`, `npm.cmd run cipher:gate`, `git diff --check`.
- Self-critique: The riskiest tradeoff is adding optional `AbortSignal` fields to in-process seam request types while validators intentionally strip them from JSON-like fixture validation. Tests prove route/pipeline signal threading and mock fixture paths remain deterministic. Local `npm run verify` timed out on the serial `verify:runner` test leg, so this entry cites the green check, focused tests, seam rewinds, full parallel test summary, and separately passing non-test governance scripts instead of claiming a complete local verify pass.

- Cipher Gate:
  - Date: 2026-06-05
  - Seams: ImageGenerationSeam, WigTryOnSeam, ProviderAdapterSeam, SpecValidationSeam, PromptAssemblySeam, DriftDetectionSeam
  - Evidence: docs/evidence/2026-06-05/hpr-timeout-abort-red-tests-clean.txt; docs/evidence/2026-06-05/hpr-timeout-abort-focused-tests-2.txt; docs/evidence/2026-06-05/hpr-timeout-abort-check-2.txt; docs/evidence/2026-06-05/hpr-timeout-abort-rewind-ImageGenerationSeam.txt; docs/evidence/2026-06-05/hpr-timeout-abort-rewind-WigTryOnSeam.txt; docs/evidence/2026-06-05/hpr-timeout-abort-rewind-ProviderAdapterSeam.txt; docs/evidence/2026-06-05/hpr-timeout-abort-full-test.txt; docs/evidence/2026-06-05/hpr-timeout-abort-lint.txt; docs/evidence/2026-06-05/hpr-timeout-abort-build.txt; docs/evidence/2026-06-05/hpr-timeout-abort-validation-summary.md
  - Summary: Added caller-signal threading through generate, image-generation, and wig try-on paths; distinguished caller abort from provider timeout; prevented body-read timeouts from becoming parse errors; capped retry delays; rejected non-finite retry options; and stopped automatic retries for billable provider image POSTs.
  - Risks: Local `npm run verify`/`verify:runner` timed out on the serial test leg; `npm run lint` and `npm run build` still fail for baseline generated-output lint debt and Windows Vercel symlink `EPERM`, respectively.

## 2026-06-05 - Deepen MeechieStudioTextPipeline error recovery
- Date: 2026-06-05
- Decision: `MeechieStudioTextPipeline` now distinguishes JSON syntax failures from schema-validation failures, retries each with a specific prompt, treats valid JSON primitives as schema failures, and receives text-model/runtime mode through injected deps instead of reading runtime env in core.
- Context: PR #98 contained valuable studio-text recovery work, but valid review comments identified retry prompt/schema drift, primitive JSON misclassification, redundant result validation, direct runtime env access in `src/lib/core`, and incorrect 504 mapping for generic provider network failures.
- Alternatives: Merge PR #98 directly; rejected because its review comments were still valid. Change `ProviderAdapterSeam` error codes now; deferred because this slice can classify existing provider errors by code plus timeout wording without widening the provider contract. Keep env reads in core; rejected because route/adapter composition can supply runtime values cleanly.
- Consequences: The first provider response is parsed into an explicit syntax-vs-schema outcome; schema retry prompts derive required-field guidance from the same list used by `STUDIO_TEXT_RESPONSE_FORMAT.required`; missing API key status uses injected runtime mode; timeout-like provider network failures map to 504 while generic network failures remain 502; and the redundant final `MeechieStudioTextResultSchema.safeParse(result)` check is removed.
- Revisit criteria: Revisit if `ProviderAdapterSeam` gains distinct timeout/network error codes, if the response-format required fields need to diverge from contract optionality, or if model/runtime config moves behind a dedicated config seam.
- Plan:
  - Goal: Port #98's useful error-recovery behavior while fixing review comments around parse classification, retry prompt consistency, runtime injection, provider status mapping, and redundant validation.
  - Seams: MeechieStudioTextSeam, ProviderAdapterSeam.
  - Files: `plan.md`, `src/lib/core/meechie-studio-text-pipeline.ts`, `src/routes/api/meechie-studio-text/+server.ts`, `src/lib/adapters/meechie-studio-text.adapter.ts`, `tests/unit/meechie-studio-text-pipeline.test.ts`, `docs/hpr-pr-resolution-ledger-2026-06-05.md`, `DECISIONS.md`.
  - Commands: `npm.cmd test -- tests/unit/meechie-studio-text-pipeline.test.ts --pool=forks --maxWorkers=1`, `npm.cmd test -- tests/unit/meechie-studio-text-pipeline.test.ts tests/contract/meechie-studio-text.test.ts --pool=forks --maxWorkers=1`, `npm.cmd run rewind -- --seam MeechieStudioTextSeam`, `npm.cmd run rewind -- --seam ProviderAdapterSeam`, `npm.cmd run check`, `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build`, `npm.cmd run verify`, `npm.cmd run cipher:gate`, `git diff --check`.
- Self-critique: The riskiest assumption is classifying timeout from the existing `PROVIDER_NETWORK_ERROR` message because `ProviderAdapterSeam` does not yet emit a distinct timeout code. This keeps the contract stable for the HPR slice, but a future provider-contract pass should add explicit timeout/network codes if callers need stronger semantics.

- Cipher Gate:
  - Date: 2026-06-05
  - Seams: MeechieStudioTextSeam, ProviderAdapterSeam
  - Evidence: docs/evidence/2026-06-05/hpr-studio-text-red-tests.txt; docs/evidence/2026-06-05/hpr-studio-text-green-tests-1.txt; docs/evidence/2026-06-05/hpr-studio-text-focused-tests-1.txt; docs/evidence/2026-06-05/hpr-studio-text-rewind-MeechieStudioTextSeam.txt; docs/evidence/2026-06-05/hpr-studio-text-rewind-ProviderAdapterSeam.txt; docs/evidence/2026-06-05/hpr-studio-text-check-1.txt; docs/evidence/2026-06-05/hpr-studio-text-full-test-2.txt; docs/evidence/2026-06-05/hpr-studio-text-lint.txt; docs/evidence/2026-06-05/hpr-studio-text-build.txt; docs/evidence/2026-06-05/hpr-studio-text-verify.txt; docs/evidence/2026-06-05/hpr-studio-text-validation-summary.md
  - Summary: Added explicit provider-text parse outcomes, syntax-specific and schema-specific retry prompts, required-field retry guidance tied to the response-format required list, injected runtime/model deps, and provider error status classification that maps timeout-like network errors to 504 while preserving generic network failures as 502.
  - Risks: Timeout classification still relies on the current provider error message because `ProviderAdapterSeam` has not yet split timeout and generic network errors into separate contract codes; `npm run lint` and `npm run build` retain known baseline/generated-output and Windows Vercel symlink failures.

## 2026-06-05 - Fix dedication draft-save stale input
- Date: 2026-06-05
- Decision: The home studio dedication input now reads the DOM value inside `StudioInputPanel`, passes a plain string to the parent, updates local state before validation, and saves `spec.dedication` as the trimmed value or `undefined` through the existing debounced draft-save path.
- Context: PR #92 identified that the parent handler could save a stale dedication value and write drafts immediately. During validation, forwarding DOM events across the component boundary proved unreliable, so the replacement uses a value callback instead.
- Alternatives: Merge PR #92 directly; rejected because its base branch is not `main` and this replacement slice can port the behavior onto the current stacked branch with focused evidence. Save drafts immediately on every keystroke; rejected because the existing debounce path already exists and avoids unnecessary storage churn.
- Consequences: Clearing the shoutout field removes `intent.dedication` from the saved draft instead of persisting `""`, and typing a new shoutout saves the latest character after debounce. The E2E smoke test waits for the session marker before typing and derives the initial rotating mode from `getWeeklyModes()` instead of hardcoding a date-sensitive heading.
- Revisit criteria: Revisit if the studio state extraction PR changes ownership of draft scheduling, or if the E2E stabilization workpack replaces the current hydration helper and rotating-mode assertions.
- Plan:
  - Goal: Port PR #92's dedication stale-input fix from current main while preserving validation and debounced draft persistence.
  - Seams: CreationStoreSeam, SpecValidationSeam.
  - Files: `plan.md`, `src/routes/+page.svelte`, `src/lib/components/studio/StudioInputPanel.svelte`, `tests/e2e/smoke.spec.ts`, `docs/hpr-pr-resolution-ledger-2026-06-05.md`, `DECISIONS.md`, `LESSONS_LEARNED.md`.
  - Commands: `npx.cmd playwright test tests/e2e/smoke.spec.ts --project=chromium --grep shoutout`, `npm.cmd run check`, `npm.cmd test -- tests/unit/meechie-studio.test.ts tests/contract/creation-store.test.ts --pool=forks --maxWorkers=1`, `npm.cmd run rewind -- --seam CreationStoreSeam`, `npm.cmd run rewind -- --seam SpecValidationSeam`, `npx.cmd playwright test tests/e2e/smoke.spec.ts --project=chromium`, `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build`, `npm.cmd run verify`, `npm.cmd run cipher:gate`, `git diff --check`.
- Self-critique: The riskiest assumption is using browser `localStorage` draft contents as the observable proxy for `CreationStoreSeam`; focused contract tests and full browser smoke coverage prove both the seam and the UI path. The first Playwright red attempt only proved missing local browser setup, so the ledger cites the clean post-install failure and green evidence separately.

- Cipher Gate:
  - Date: 2026-06-05
  - Seams: CreationStoreSeam, SpecValidationSeam
  - Evidence: docs/evidence/2026-06-05/hpr-dedication-red-e2e-event-forwarding.txt; docs/evidence/2026-06-05/hpr-dedication-green-e2e-globalthis-handler.txt; docs/evidence/2026-06-05/hpr-dedication-check-7.txt; docs/evidence/2026-06-05/hpr-dedication-focused-tests-3.txt; docs/evidence/2026-06-05/hpr-dedication-rewind-CreationStoreSeam-2.txt; docs/evidence/2026-06-05/hpr-dedication-rewind-SpecValidationSeam-2.txt; docs/evidence/2026-06-05/hpr-dedication-smoke-e2e-5.txt; docs/evidence/2026-06-05/hpr-dedication-full-test-3.txt; docs/evidence/2026-06-05/hpr-dedication-lint-3.txt; docs/evidence/2026-06-05/hpr-dedication-build-2.txt; docs/evidence/2026-06-05/hpr-dedication-verify-3.txt; docs/evidence/2026-06-05/hpr-dedication-cipher-gate-2.txt
  - Summary: Dedication input now passes a plain string from the child to the parent, updates local state before validation, normalizes blank input to `undefined`, and saves through the existing debounced draft path; smoke coverage proves save and clear behavior.
  - Risks: `npm run lint` still fails on known baseline no-undef/unused-variable debt, and `npm run build` still fails after Vite output on the Windows Vercel symlink `EPERM`; the browser smoke spec still contains older `waitForTimeout` hydration settling that should be addressed in the later E2E stabilization workpack.

## 2026-06-07 - Repair lint debt, dedication callback, and WebP try-on packaging
- Date: 2026-06-07
- Decision: Clear the local lint/whitespace blockers, restore the extracted studio-state dedication callback to consume the current input value through the debounced draft-save path, and make WebP try-on portraits contract-valid generated images that route through OutputPackagingSeam's browser image conversion instead of being mislabeled as JPEG.
- Context: The PR-drain stack was locally ahead of `origin/main` with green check/test/build but failing lint and diff hygiene, review-audit findings showed `StudioState.handleDedicationInput` ignored the value passed by `StudioInputPanel` while WebP try-on portraits were accepted in the data URL regex but emitted as `format: 'jpg'`, and the verify generators repeatedly produced Markdown files with blank EOF lines.
- Alternatives: Only ignore `.vercel` and leave source lint errors; rejected because TypeScript parsing and unused-source issues still needed real cleanup. Reject WebP portraits; rejected because the app already accepts WebP in the try-on path and the lower-debt behavior is consistent contract support. Keep immediate draft saves for dedication; rejected because the existing debounced path avoids unnecessary storage churn and matches the component contract.
- Consequences: ESLint ignores generated deployment output and parses TypeScript with the TypeScript parser; TypeScript `no-undef` false positives are delegated to `svelte-check`; dedication changes update local state before validation and save scheduling; generated images may now use `format: 'webp'`; OutputPackagingSeam converts WebP to PNG/PDF outputs through the browser canvas path; verify-generated Markdown reports no longer create blank EOF line debt.
- Revisit criteria: Revisit if product needs server-side WebP conversion without browser canvas, if `GeneratedImageSchema` is consolidated with the self-contained image-generation seam contract, or if Windows line-ending warnings are addressed through a repository `.gitattributes` policy.
- Plan:
  - Goal: Continue PR drain by clearing lint/whitespace blockers and repairing dedication/WebP behavior in the extracted studio state.
  - Seams: ImageGenerationSeam, OutputPackagingSeam, CreationStoreSeam, SpecValidationSeam.
  - Files: `plan.md`, `DECISIONS.md`, `eslint.config.js`, `contracts/image-generation.contract.ts`, `src/routes/studio-state.svelte.ts`, `src/lib/adapters/output-packaging.adapter.ts`, `src/lib/adapters/creation-store.adapter.ts`, `src/lib/core/coloring-page-title.ts`, `src/lib/core/meechie-studio-text-pipeline.ts`, `src/lib/core/tools-pipeline.ts`, `scripts/analyze-merge-conflicts.js`, `scripts/get-pr-todos.js`, `scripts/validate-pr-backlog.js`, `scripts/proof-tape.mjs`, `scripts/clan-chain.mjs`, `scripts/seam-ledger.mjs`, `tests/unit/studio-state.test.ts`, `tests/unit/output-packaging-helpers.test.ts`, `tests/unit/api-meechie-studio-text-endpoint.test.ts`, `tests/unit/coloring-page-title.test.ts`, `tests/unit/creation-store-helpers.test.ts`, `docs/evidence/2026-06-07/whitespace-normalized-files.txt`, `docs/evidence/2026-06-07/*`.
  - Commands: focused red/green tests, `npm.cmd run check`, `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build`, `npm.cmd run verify`, `npm.cmd run cipher:gate`, `git diff --check origin/main`.
- Self-critique: The main risk is that jsdom cannot complete real canvas WebP conversion, so local tests prove contract acceptance and routing to the browser conversion branch while full browser rendering remains a future E2E/manual validation target. A second risk is broad evidence whitespace churn; the exact normalized file list is captured in evidence so the change is auditable. A third risk is bypassing the symptom by trimming generated files manually, so the generator scripts are fixed at the source and verified through a fresh `npm run verify` plus diff-check.

- Cipher Gate:
  - Date: 2026-06-07
  - Seams: ImageGenerationSeam, OutputPackagingSeam, CreationStoreSeam, SpecValidationSeam
  - Evidence: docs/evidence/2026-06-07/webp-dedication-focused-tests.txt; docs/evidence/2026-06-07/studio-state-mode-select.txt; docs/evidence/2026-06-07/check.txt; docs/evidence/2026-06-07/lint.txt; docs/evidence/2026-06-07/test.txt; docs/evidence/2026-06-07/build.txt; docs/evidence/2026-06-07/e2e-smoke.txt; docs/evidence/2026-06-07/verify.txt; docs/evidence/2026-06-07/verify-wrapper.txt; docs/evidence/2026-06-07/whitespace-normalized-files.txt; docs/evidence/2026-06-07/proof-tape.md; docs/evidence/2026-06-07/proof-tape-wrapper.txt; docs/evidence/2026-06-07/cipher-gate.json; docs/evidence/2026-06-07/cipher-gate-wrapper.txt
  - Summary: Fixed ESLint flat config and source lint residue, added regression coverage for dedication, mode-card selection, and WebP try-on packaging, updated GeneratedImageSchema/OutputPackagingSeam/StudioState to preserve WebP, normalized trailing-whitespace debt in the PR-drain evidence stack, fixed verify Markdown generators to stop emitting blank EOF lines, removed temporary diagnostics from the proof tape, and verified check/lint/test/build/e2e/verify plus `git diff --check origin/main` locally.
  - Risks: Real browser WebP canvas conversion is not proven by jsdom or the current smoke E2E; PR remote state still needs inspection before claiming the drain is complete.

## 2026-06-07 - Manually integrate PR #139 quick refactors
- Date: 2026-06-07
- Decision: Port PR #139's readability-only refactors onto current `main` by naming the title word-break threshold and studio-text content preview length, using the exponentiation operator in retry backoff, and simplifying text-model fallback.
- Context: PR #139 was open but became dirty after the verified main push and later PR #111/#120 merges. Directly merging its branch would regress newer abort-signal handling in `http-resilience.ts` and newer studio-text parsing behavior, so only the behavior-preserving pieces were applied.
- Alternatives: Merge PR #139 as-is; rejected because `git merge-tree` showed conflicts that would overwrite newer retry and JSON parsing behavior. Close PR #139 without replacement; rejected because the small readability improvements still reduce maintenance debt. Defer the refactor; rejected because it is low-risk once applied manually to current code.
- Consequences: Constants document the `40` word-break threshold and `500` provider content preview length, retry backoff uses `2 ** (...)` while still capping delays and honoring caller aborts, and text-model fallback behavior remains unchanged for empty or whitespace-only config.
- Revisit criteria: Revisit if retry policy moves behind a dedicated resilience seam or if studio-text provider error details need configurable preview length.
- Plan:
  - Goal: Manually integrate PR #139's behavior-preserving quick refactors after the verified main push made the PR dirty.
  - Seams: ProviderAdapterSeam, MeechieStudioTextSeam.
  - Files: `plan.md`, `DECISIONS.md`, `src/lib/core/coloring-page-title.ts`, `src/lib/core/http-resilience.ts`, `src/lib/core/meechie-studio-text-pipeline.ts`, `src/lib/core/text-model.ts`, `docs/evidence/2026-06-07/*`.
  - Commands: `npm.cmd test -- tests/unit/coloring-page-title.test.ts tests/unit/http-resilience.test.ts tests/unit/text-model.test.ts tests/unit/meechie-studio-text-pipeline.test.ts --pool=forks --maxWorkers=1`, `npm.cmd run check`, `npm.cmd run lint`, `npm.cmd run verify`, `npm.cmd run cipher:gate`, `git diff --check`.
- Self-critique: The main risk is accidentally accepting stale PR #139 hunks that remove current abort-signal retry behavior or studio-text JSON recovery. The focused diff keeps those current branches intact, and the evidence proves behavior through targeted tests plus full verification.

- Cipher Gate:
  - Date: 2026-06-07
  - Seams: ProviderAdapterSeam, MeechieStudioTextSeam
  - Evidence: docs/evidence/2026-06-07/pr-139-focused-tests.txt; docs/evidence/2026-06-07/pr-139-check.txt; docs/evidence/2026-06-07/pr-139-lint.txt; docs/evidence/2026-06-07/pr-139-verify-wrapper.txt; docs/evidence/2026-06-07/pr-139-cipher-gate-wrapper.txt; docs/evidence/2026-06-07/cipher-gate.json; docs/evidence/2026-06-07/pr-139-diff-check.txt
  - Summary: Manually integrated PR #139's quick refactors while preserving current retry abort/cap behavior and studio-text JSON recovery.
  - Risks: This is readability-only and does not add new contract fixtures; if future behavior changes reuse these constants, that later work should add dedicated contract coverage.

## 2026-06-07 - Manually integrate PR #133 print-dimension cleanup
- Date: 2026-06-07
- Decision: Port only PR #133's current-safe OutputPackagingSeam cleanup by centralizing the print raster dimensions as `PRINT_WIDTH` and `PRINT_HEIGHT`, including the newer WebP path that did not exist in the stale PR diff.
- Context: PR #133 was dirty against current `main`. Its HTTP client hunk used a double cast that reviewers rejected and current `main` already has a stronger `204`/`205`/empty-body/non-2xx JSON policy. Its MeechieStudioTextPipeline hunk would also weaken the newer schema-error retry path that intentionally treats JSON primitives and arrays as schema failures with hints. The remaining low-debt value was removing duplicated `2550` and `3300` literals from print packaging.
- Alternatives: Merge PR #133 as-is; rejected because it would reintroduce stale HTTP and studio-text behavior. Close PR #133 without replacement; rejected because OutputPackagingSeam still had duplicated print dimensions. Add source-scanning tests for literal counts; rejected because that would overfit tests to implementation text instead of behavior.
- Consequences: SVG fallback sizing, JPEG print conversion, and WebP print conversion now share the same named dimensions. Existing OutputPackagingSeam behavior is unchanged and the current HTTP/studio-text policies remain intact.
- Revisit criteria: Revisit if print dimensions become user-configurable or if OutputPackagingSeam needs server-side image conversion that cannot use browser canvas.
- Plan:
  - Goal: Manually integrate the safe subset of PR #133 after current `main` made the PR stale.
  - Seams: OutputPackagingSeam.
  - Files: `plan.md`, `DECISIONS.md`, `src/lib/adapters/output-packaging.adapter.ts`, `docs/evidence/2026-06-07/*`.
  - Commands: `rg -n "2550|3300" src/lib/adapters/output-packaging.adapter.ts`, focused output-packaging/wig/http/studio tests, `npm.cmd run check`, `npm.cmd run lint`, `npm.cmd run verify`, `npm.cmd run cipher:gate`, `git diff --check`.
- Self-critique: The main risk is accepting a cosmetic refactor without proving that current WebP print handling still follows the same browser conversion path. Focused OutputPackagingSeam tests, current API wig tests, HTTP client tests, studio-text tests, and full verify cover the behavior while the source scans prove the duplicated literal debt was removed.

- Cipher Gate:
  - Date: 2026-06-07
  - Seams: OutputPackagingSeam
  - Evidence: docs/evidence/2026-06-07/pr-133-print-dimension-debt-before.txt; docs/evidence/2026-06-07/pr-133-print-dimension-debt-after.txt; docs/evidence/2026-06-07/pr-133-focused-tests.txt; docs/evidence/2026-06-07/pr-133-check.txt; docs/evidence/2026-06-07/pr-133-lint.txt; docs/evidence/2026-06-07/pr-133-verify-wrapper.txt; docs/evidence/2026-06-07/cipher-gate.json; docs/evidence/2026-06-07/pr-133-diff-check.txt
  - Summary: Centralized OutputPackagingSeam print dimensions for SVG fallback plus JPEG/WebP browser conversion and skipped stale PR #133 hunks that would regress current HTTP/studio-text policies.
  - Risks: This is behavior-preserving cleanup, so no new contract fixtures were added; future configurable print dimensions would need contract-level tests.

## 2026-06-17 - Add RateLimitSeam and guard AI-provider routes against unbounded abuse

- Date: 2026-06-17
- Decision: Add a new self-contained `RateLimitSeam` (pure, dependency-injected sliding-window limiter) and wire it into `/api/generate`, `/api/image-generation`, `/api/chat-interpretation`, `/api/meechie-studio-text`, and `/api/wig-try-on` via `src/lib/server/rate-limit-guard.ts`, which returns a 429 with `Retry-After` once a per-route, per-client budget is exceeded.
- Context: A repo-wide difficulty survey found that none of the five routes that proxy metered external AI provider calls (xAI for chat/generate/image/studio-text, Gemini for wig try-on) had any request throttling, leaving paid provider spend exposed to unbounded client abuse. This was confirmed net-new by cross-checking the five most recent open PRs from prior runs of this same "hardest fix" routine (#151, #156, #159, #161, #164), none of which touch rate limiting.
- Alternatives: Add a distributed rate limiter backed by Redis/Upstash; rejected because it requires a new paid external dependency and credentials not available in this environment. Rely on Vercel's platform-level rate limiting; rejected because it is not configured in this repo and isn't visible/testable from the codebase. Add a single shared limiter instance instead of per-route policies; rejected because image-generating routes are materially more expensive per call than text-only routes and deserve a tighter budget.
- Consequences: Each guarded route now consumes one budget slot per request before any provider call, deterministic in tests via injected `nowMs`. The limiter is in-memory per Node process; on Vercel's serverless platform this means budgets are enforced per warm function instance, not globally across every instance that could serve a given client — documented below as a deliberate, accepted tradeoff rather than a silent gap.
- Revisit criteria: Revisit if Vercel KV/Upstash (or another shared store) becomes available, or if abuse patterns show the per-instance budget is being trivially bypassed via cold-start churn.
- Plan:
  - Goal: Close the "no rate limiting on metered AI routes" gap with a seam that follows Seam-Driven Development and does not regress any existing route test.
  - Seams: RateLimitSeam (new).
  - Files: `src/lib/seams/rate-limit-seam/{contract,validators,limiter,mock,fixtures,probe,test}.ts`, `src/lib/server/rate-limit-guard.ts`, `tests/unit/rate-limit-guard.test.ts`, `src/routes/api/{generate,image-generation,chat-interpretation,meechie-studio-text,wig-try-on}/+server.ts`, `docs/seams.md`, `src/lib/seams/CLAUDE.md`, `DECISIONS.md`, `LESSONS_LEARNED.md`, `plan.md`.
  - Commands: `npx vitest run src/lib/seams/rate-limit-seam/test.ts`, `npx vitest run tests/unit/rate-limit-guard.test.ts`, `npm run rewind -- --seam RateLimitSeam`, `npm run check`, `npm run lint`, `npm test`, `npm run build`, `npm run verify`.
- Self-critique: An earlier draft of the seam's own "fully expired" boundary test used a clock offset that only expired one of three closely-spaced hits, which would have shipped a false-positive green test; caught by actually running the new test before wiring anything into routes, then fixed by re-deriving the offset relative to the last hit instead of the first. The remaining known risk is the per-instance (not global) budget on serverless, which is recorded explicitly as an Assumption entry below instead of left implicit.

- Cipher Gate:
  - Date: 2026-06-17
  - Seams: RateLimitSeam
  - Evidence: docs/evidence/2026-06-17/rewind-RateLimitSeam.txt; docs/evidence/2026-06-17/rate-limit-guard-targeted-test.txt; docs/evidence/2026-06-17/check.txt; docs/evidence/2026-06-17/lint.txt; docs/evidence/2026-06-17/build.txt; docs/evidence/2026-06-17/test.txt; docs/evidence/2026-06-17/verify.txt; docs/evidence/2026-06-17/seam-ledger.md; docs/evidence/2026-06-17/proof-tape.md
  - Summary: Added a pure sliding-window RateLimitSeam and an `enforceRateLimit` guard, wired into the five AI-provider-backed routes ahead of any provider call, with full contract/unit test coverage and a green `npm run verify`.
  - Risks: The limiter is per-process/per-serverless-instance, not a globally consistent budget; see the Assumption entry below for the accepted scope of this mitigation.

- Assumption:
  - Date: 2026-06-17
  - Seams: RateLimitSeam
  - Statement: An in-memory, per-process sliding-window limiter is an acceptable mitigation for AI-provider route abuse even though Vercel serverless functions do not share memory across instances, so the effective budget is per-instance rather than globally enforced per client.
  - Validation: Manual verification steps are documented in `src/lib/seams/rate-limit-seam/probe.ts`; revisit if abuse telemetry shows clients bypassing the budget via concurrent cold starts, at which point migrate to a shared store (e.g. Vercel KV/Upstash).
  - Status: Accepted as a documented best-effort mitigation; not waived because no live credentials are required to reach this state, it is an inherent property of the chosen architecture (in-process Map, no external store).

## 2026-06-18 - Consolidate the highest-review-debt PRs and close RateLimitSeam's idle-key eviction gap

- Date: 2026-06-18
- Decision: Surveyed every PR opened in the last 5 days for unresolved review threads, found PR #160 and PR #166 tied at 9 each, then addressed both in this single PR rather than re-deriving fixes from scratch: merged PR #163's already-tested branch (which independently fixes all 9 of PR #160's threads) and added the one remaining genuine gap in PR #166's `RateLimitSeam` — `checkAndConsume` only pruned the key being checked, so the other 499+ idle keys in `hitsByKey` kept their now-fully-expired hit arrays forever.
- Context: Re-reading both PRs' GitHub threads showed most "unresolved" comments were stale, not unaddressed: PR #166's own tip commit (`d15f287`, pushed before this review) had already fixed 7 of its 9 flagged comments without anyone marking the threads resolved, and PR #160's 9 threads were already fully fixed on a separate, unmerged branch (PR #163) that nobody had merged. Re-fixing either from scratch would have been pure duplicate work and added a third near-identical "fix review comments" PR to an already large backlog of unmerged "fix" PRs (`claude/keen-hypatia-*`, `claude/sweet-mendel-*`, `claude/trusting-volta-*` branch families) that both PR #163 and PR #166 had already self-flagged as a top repo problem.
- Alternatives: Re-implement PR #160's 9 fixes independently; rejected because PR #163 already has tested, working code for the exact same fixes and duplicating it would waste review cycles on two near-identical diffs. Apply sourcery-ai's suggestion to move `RateLimitCheckInput` validation to the route boundary instead of inside `checkAndConsume`; declined because it is a subjective API-contract change (the seam's documented contract is to validate its own input) rather than a bug, and is out of scope for a backlog-consolidation fix.
- Consequences: This PR's diff is the union of PR #163's already-reviewed fix set plus the new `evictExpiredKeys` sweep in `limiter.ts`/`mock.ts`'s shared limiter; once merged, PR #160 and PR #163 (superseded) and the now-fully-addressed PR #166 should be closed by the maintainer to shrink the open-PR backlog. `RateLimitSeam.checkAndConsume` now does one full `Map` sweep per call to evict idle keys, which is O(total active keys) instead of O(1); acceptable because the same call already does an O(window size) prune of the matched key, and per-instance key counts are bounded by recent unique clients, not unbounded history.
- Revisit criteria: Revisit if profiling ever shows the per-call full-map sweep is measurably hot under real traffic (at which point a time-based or count-based eviction interval, not every call, would be the next step); revisit the broader backlog problem if PRs #160/#163/#166 are still open after this PR merges.
- Plan:
  - Goal: Address the two PRs (by thread count) with the most unaddressed review comments from the last 5 days, in one consolidated PR, without duplicating already-fixed work.
  - Seams: RateLimitSeam.
  - Files: `src/lib/seams/rate-limit-seam/limiter.ts`, `src/lib/seams/rate-limit-seam/test.ts`, plus PR #163's merged file set (`studio-state.svelte.ts`, `image-generation-pipeline.ts`, `http-resilience.ts`, `generate-pipeline.ts`, related tests), `plan.md`, `DECISIONS.md`, `CHANGELOG.md`, `LESSONS_LEARNED.md`, `docs/evidence/2026-06-18/*`.
  - Commands: `npx vitest run src/lib/seams/rate-limit-seam/test.ts`, `npm run rewind -- --seam RateLimitSeam`, `npm run check`, `npm run lint`, `npm test`, `npm run build`, `npm run verify`.
- Self-critique: The main risk is that "most unresolved threads" is a noisy proxy for "most unaddressed" since GitHub doesn't auto-resolve threads when the underlying line changes; this was caught by actually reading each flagged thread's diff context against the current branch tip rather than trusting the raw resolved/unresolved count, which is what surfaced that most of the apparent debt was already paid down elsewhere. The remaining real risk is the full-map sweep added to a hot path (every rate-limit check); mitigated by keeping it O(active keys) with early-exit on unchanged arrays, and called out above as a revisit trigger rather than silently shipped.

- Cipher Gate:
  - Date: 2026-06-18
  - Seams: RateLimitSeam
  - Evidence: docs/evidence/2026-06-18/rewind-RateLimitSeam.txt; docs/evidence/2026-06-18/check.txt; docs/evidence/2026-06-18/lint.txt; docs/evidence/2026-06-18/test.txt; docs/evidence/2026-06-18/build.txt; docs/evidence/2026-06-18/verify.txt
  - Summary: Closed RateLimitSeam's idle-key memory-growth gap with a full-map eviction sweep on every `checkAndConsume` call, backed by a contract test (500 idle keys don't poison a later reused key) and a direct unit test on the new `evictExpiredKeys` helper; consolidated with PR #163's already-fixed PR #160 review comments instead of duplicating them.
  - Risks: The added per-call full-map sweep trades O(1) for O(active keys) per request; acceptable at expected traffic levels per the Consequences note above, revisit if profiling says otherwise.
