<!--
Purpose: Track the hardest technical-debt items and their resolution status.
Why: Prevent duplicate work, maintain visibility of long-running fixes, and record why each item is difficult.
Info flow: audit findings -> list -> strike-through on main merge -> archive in DECISIONS.md.
-->

# Top 10 Hardest Upgrades / Fixes

This list originated in PR #121 / PR #195 and now has a permanent home here. Per
standing instructions, items are never deleted from this list — only struck
through once actually fixed on `main` (not merely fixed in an unmerged PR).

Status notes added 2026-06-27 reflect the actual state of `main` as of this
session, which differs from PR #195's body in two places: PR #195 struck
through items #1 and #2, but that PR is still unmerged and neither fix exists
on `main` yet. Those two items are left **not** struck through here, with an
annotation pointing at the existing unmerged candidate so nobody re-does the
same work from scratch. Item #3 below was completed in this session's PR and
is struck through accordingly.

| # | Issue | Severity | What makes it hard |
|---|-------|----------|--------------------|
| 1 | **Dual Seam Layout Fragmentation (ImageGenerationSeam)** — legacy flat adapter/mock/fixtures existed alongside the self-contained seam as dead code; test used wrong config type; seam registry had two conflicting rows | CRITICAL | Requires verifying all callers before deletion, reconciling two seam layers, fixing test type mismatches, updating the registry without breaking the API-contract layer that still lives in `contracts/image-generation.contract.ts` |
| 2 | **No Startup Validation for Required Env Vars** — `hooks.server.ts` does not exist; app boots silently without `XAI_API_KEY` etc. and fails only on the first live request; `meechie-studio-text-pipeline.ts` reads `env.XAI_TEXT_MODEL` at module load time, completely bypassing AppConfigSeam | CRITICAL | Must understand SvelteKit server lifecycle, decide required vs optional per-feature, handle graceful degradation for optional features (wig try-on), not break tests |
| ~~3~~ | ~~**Retry Logic: No Circuit Breaker + Incorrect `Retry-After` Cap** — `fetchWithRetry` caps `Retry-After` at 30 s regardless of what the server sends; no circuit breaker means a prolonged xAI outage causes 10–30 s hangs instead of fast-fail 503s~~ | ~~HIGH~~ | ~~Circuit breaker requires new stateful resilience abstraction; changing the cap risks compliance issues if xAI changes defaults; adding metrics requires a new seam or DI~~ |
| 4 | **Type Safety: Lossy Error Truncation** — `meechie-studio-text-pipeline.ts` truncates provider error responses to 500 chars (`CONTENT_PREVIEW_LENGTH`) before logging | HIGH | The previously-listed "silent JSON parse failures in `generate-pipeline.ts`" half of this item is resolved — `image-generation-pipeline.ts` now routes entirely through `ImageGenerationSeam`, whose adapter maps JSON parse failures to a typed `IMAGE_NETWORK_ERROR` Result instead of swallowing them. The truncation half is still open |
| 5 | **`XAI_TEXT_MODEL` Direct `env` Read Bypasses Seam + Startup** — only **1 of 4** call sites is fixed. `meechie-studio-text-pipeline.ts` now calls `selectTextModel(deps.textModel)` lazily with an injected dependency. `chat-interpretation-pipeline.ts:19`, `meechie-tool.adapter.ts:17`, and `meechie-tool-seam/index.ts:17` still do `const ... = selectTextModel(env.XAI_TEXT_MODEL)` at module load time | HIGH | Fixing the remaining 3 requires routing the text-model key through AppConfigSeam (or a new `TextProviderConfigSeam`) and converting each module-level side effect into a lazy, dependency-injected call without breaking legacy vs. self-contained MeechieToolSeam call sites or their tests |
| 6 | **`localStorage` Quota / Private-Mode Errors Uncaught** — `session.adapter.ts` and `creation-store.adapter.ts` call `localStorage.setItem/getItem/removeItem` without try/catch | MEDIUM | Requires a graceful fallback (in-memory cache); seam contracts need a new error code path; tests currently mock localStorage so quota errors are never exercised |
| 7 | **Service Worker Bundle: No Automated Zod Exclusion Check** — no CI enforcement that Zod stays out of the service worker bundle | MEDIUM | Bundling depends on Vite/SvelteKit internals; adding a build-time bundle-size assertion requires a custom rollup plugin |
| 8 | **Dependency-Injected Seams Have No Adapter — Registry Misleads** — `PromptCompilerSeam`, `SafetyPolicySeam`, `GalleryStoreSeam`, `TelemetrySeam` show `Adapter: N/A` with no vocabulary distinguishing "design-only" from "ready to wire" | MEDIUM | Requires deciding SDD intent per seam and introducing new registry vocabulary |
| 9 | **Blocked Probes — No Live Evidence for `ImageGenerationSeam` + `WigTryOnSeam`** | MEDIUM | Requires xAI + Gemini API keys; fixtures must stay ≤7 days fresh per AGENTS.md |
| 10 | **Svelte 5 Migration Incomplete** — 20+ components never audited for stray `$:`/`on:` patterns | MEDIUM | No automated fixer exists; `svelte-check` passes so the inconsistency is silent |
| 11 | **Runaway PR Backlog — 48 Open PRs, 0 Merges in 19+ Days, Recurring Duplicate Work** — issue #175 already documents this; as of this session there are 6+ independent competing implementations of `RateLimitSeam` alone sitting in separate open PRs, and PR #195/#121 (this very list's source) is itself one of those unmerged PRs | CRITICAL | Not a code fix — it is a process failure. Resolving it requires a human decision about which competing PRs to keep vs. close, since an agent merging/closing other agents' unreviewed work autonomously is a judgment call outside this session's scope. Left as a flag, not attempted, in this session |

## Item #3 completion notes (this session, 2026-06-27)

- Confirmed via the GitHub MCP tools (re-checked open PRs through #197) that no
  other open PR touched `src/lib/core/http-resilience.ts` or added circuit
  breaker logic, so this was not duplicate work.
- Added a shared, simplified two-state (closed/open) `CircuitBreaker` to
  `src/lib/core/http-resilience.ts`, wired into both
  `createChatCompletion` (via `fetchWithRetry`) and `createImageGeneration`
  (manual gate + bookkeeping, since that call has no retry loop) in
  `src/lib/adapters/provider-adapter.adapter.ts`.
- Fixed `Retry-After` being incorrectly clamped to the same 30s cap used for
  self-generated backoff. It is now honored up to a 10-minute ceiling
  (`MAX_RETRY_AFTER_MS`), while self-backoff stays capped at 30s
  (`MAX_SELF_BACKOFF_MS`, unchanged).
- New `PROVIDER_CIRCUIT_OPEN` `SeamError` code added; no contract/schema
  change required since `SeamError.code` is a free-form string.
- Full details, alternatives considered, and risks are recorded in
  `DECISIONS.md` under "2026-06-27 - Add circuit breaker and fix Retry-After
  cap in ProviderAdapterSeam's HTTP resilience layer", with evidence captured
  under `docs/evidence/2026-06-27/`.
