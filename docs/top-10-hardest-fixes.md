<!--
Purpose: Persistent home for the running "Top 10 Hardest Upgrades / Fixes" audit.
Why: The list previously only lived inside PR bodies (originated in PR #121), which made it
     hard to rediscover across sessions. Keeping it in docs/ lets every future session find
     and continue it without re-deriving the audit from scratch.
Info flow: Audit -> this table -> strikethrough when verifiably fixed (never delete a row).
-->
# Top 10 Hardest Upgrades / Fixes

Full audit of the hardest outstanding work in this repo. **Do not remove items — only
strikethrough a row once it is verifiably fixed**, and append a short note on what was done
and what (if anything) is still open underneath it. If new hard problems are found, add rows
beyond #10 rather than replacing anything.

Originated in PR #121. Continued in the PR that introduces this file (startup env-var
diagnostics, item #2).

| # | Issue | Severity | What makes it hard |
|---|-------|----------|--------------------|
| ~~1~~ | ~~**Dual Seam Layout Fragmentation (ImageGenerationSeam)** — legacy flat adapter/mock/fixtures existed alongside the self-contained seam as dead code; test used wrong config type; seam registry had two conflicting rows~~ | ~~CRITICAL~~ | ~~Requires verifying all callers before deletion, reconciling two seam layers, fixing test type mismatches, updating the registry without breaking the API-contract layer that still lives in `contracts/image-generation.contract.ts`~~ |
| ~~2~~ | ~~**No Startup Validation for Required Env Vars** — `hooks.server.ts` does not exist; app boots silently without `XAI_API_KEY` etc. and fails only on the first live request; `meechie-studio-text-pipeline.ts` reads `env.XAI_TEXT_MODEL` at module load time, completely bypassing AppConfigSeam~~ | ~~CRITICAL~~ | ~~Must understand SvelteKit server lifecycle, decide required vs optional per-feature, handle graceful degradation for optional features (wig try-on), not break tests~~ |
| 3 | **Retry Logic: No Circuit Breaker + Incorrect `Retry-After` Cap** — `fetchWithRetry` caps `Retry-After` at 30 s regardless of what the server sends; no circuit breaker means a prolonged xAI outage causes 10–30 s hangs instead of fast-fail 503s | HIGH | Circuit breaker requires new stateful resilience abstraction; changing the cap risks compliance issues if xAI changes defaults; adding metrics requires a new seam or DI |
| 4 | **Type Safety: Lossy Error Truncation** — `meechie-studio-text-pipeline.ts` truncates provider error responses to 500 chars (`CONTENT_PREVIEW_LENGTH`) before logging | HIGH | The previously-listed "silent JSON parse failures in `generate-pipeline.ts`" half of this item is resolved — `image-generation-pipeline.ts` now routes entirely through `ImageGenerationSeam`, whose adapter (`src/lib/adapters/image-generation-seam/index.ts`) maps JSON parse failures to a typed `IMAGE_NETWORK_ERROR` Result instead of swallowing them. The truncation half is still open; removing it requires confirming no provider response is large enough to cause log-volume problems |
| 5 | **`XAI_TEXT_MODEL` Direct `env` Read Bypasses Seam + Startup** — only **1 of 4** call sites is fixed. `src/lib/core/meechie-studio-text-pipeline.ts` now calls `selectTextModel(deps.textModel)` lazily inside a function with an injected dependency. `src/lib/core/chat-interpretation-pipeline.ts:19`, `src/lib/adapters/meechie-tool.adapter.ts:17`, and `src/lib/adapters/meechie-tool-seam/index.ts:17` still do `const ... = selectTextModel(env.XAI_TEXT_MODEL)` at module load time, bypassing AppConfigSeam exactly like the original fixed call site did | HIGH | Fixing the remaining 3 requires routing the text-model key through AppConfigSeam (or a new `TextProviderConfigSeam`) and converting each module-level side effect into a lazy, dependency-injected call without breaking the legacy vs. self-contained MeechieToolSeam call sites or their tests |
| 6 | **`localStorage` Quota / Private-Mode Errors Uncaught** — `session.adapter.ts` and `creation-store.adapter.ts` call `localStorage.setItem/getItem/removeItem` without try/catch; quota errors in private-mode Safari or full-storage contexts bubble as unhandled errors | MEDIUM | Requires a graceful fallback (in-memory cache); seam contracts need a new error code path; tests currently mock localStorage so quota errors are never exercised |
| 7 | **Service Worker Bundle: No Automated Zod Exclusion Check** — `src/service-worker.ts` relative-imports the cache adapter; `plan.md` notes a manual Vite bundle check to confirm Zod is absent, but there is no CI enforcement | MEDIUM | Service worker bundling depends on Vite/SvelteKit internals; adding a build-time bundle-size assertion requires modifying `vite.config.ts` or a custom rollup plugin |
| 8 | **Dependency-Injected Seams Have No Adapter — Registry Misleads** — `PromptCompilerSeam`, `SafetyPolicySeam`, `GalleryStoreSeam`, `TelemetrySeam` are listed in `docs/seams.md` with `Adapter: N/A (dependency-injected seam)`, making it impossible for a new developer to tell whether a seam is "ready to wire" or "design-only" | MEDIUM | Deciding whether to add real adapters (over-engineering for pure functions) vs. marking them explicitly as "pure / no adapter by design" requires understanding SDD intent for each seam; registry and CLAUDE.md need a new vocabulary |
| 9 | **Blocked Probes — No Live Evidence for `ImageGenerationSeam` + `WigTryOnSeam`** — Both seams are wired to production routes but have `TBD (blocked)` probe status in `docs/seams.md`; fixtures are code-only (never validated against real xAI/Gemini responses); if either API changed its response shape the adapters would fail at runtime undetected | MEDIUM | Requires xAI + Gemini API keys; fixtures must be ≤7 days fresh per AGENTS.md; if probes fail, contracts and adapters must be rewritten |
| 10 | **Svelte 5 Migration Incomplete** — `+page.svelte` was migrated to runes (`$state`, `$derived`); 20+ components in `src/lib/components/` were not audited; legacy `$:` reactive statements and `on:` event directives may coexist with runes, creating inconsistent patterns | MEDIUM | No automated fixer exists; some components have complex reactivity that is non-trivial to convert; `svelte-check` currently passes so the inconsistency is silent |

## Notes on closed items

- **#1** — PR #121 deleted the legacy `image-generation` adapter/mock and collapsed the
  `docs/seams.md` registry to one row, but left two orphans behind:
  `fixtures/image-generation/{sample,fault,dense-scene}.json` and
  `probes/image-generation.probe.mjs`, both unreferenced by any source file. Deleted in the PR
  that adds this file, alongside the two stale `docs/CHECKLIST.md` lines pointing at them.
- **#2** — Added `src/hooks.server.ts` + `src/lib/core/startup-env-check.ts`. See
  `DECISIONS.md` (2026-06-26 entry) for the required-vs-optional rationale and
  `docs/evidence/2026-06-26/` for test/lint/check/manual-boot evidence.
