// Purpose: Document RateLimitSeam probe strategy.
// Why: The limiter is a pure, dependency-injected algorithm (caller supplies the clock) with
//      no external I/O, so there is no live system to probe — the same property that lets
//      SafetyPolicySeam and PromptCompilerSeam skip a network/filesystem probe.
// Info flow: N/A — no automated probe; contract tests in test.ts exercise real behavior directly.
//
// Manual verification steps (only needed if the algorithm changes):
//   1. Run `npm test -- src/lib/seams/rate-limit-seam/test.ts` and confirm boundary cases pass:
//      under-limit allow, at-limit block, post-window reset, and independent per-key budgets.
//   2. For end-to-end confidence, send > limit POSTs to a guarded route (e.g. /api/generate)
//      from the same client within the configured window and confirm the (limit + 1)th
//      response is HTTP 429 with a Retry-After header.
