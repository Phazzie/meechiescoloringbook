<!--
Purpose: Capture pitfalls, surprises, and fixes in short dated entries.
Why: Prevent repeat mistakes and preserve working knowledge.
Info flow: Experience -> lesson -> action applied to future changes.
-->
# Lessons Learned

Short, dated entries capturing pitfalls, surprises, and fixes.

## 2026-01-22
- Date: 2026-01-22
- Context: Secret management for local development.
- Lesson: Do not store or echo secrets; use a local `.env` that is ignored by git.
- Action: Add `.env.example`, add `.env` to `.gitignore`, and verify presence without printing values.

## 2026-01-22
- Date: 2026-01-22
- Context: Docs-only governance changes.
- Lesson: Governance updates still need a micro plan and evidence even without code changes.
- Action: Record micro plan/self-critique entries in `DECISIONS.md` with diff commands.

## 2026-01-22
- Date: 2026-01-22
- Context: Contract validation for SpecValidationSeam.
- Lesson: Validation seams must accept raw/invalid inputs; strict schemas block fault fixtures.
- Action: Add a raw spec schema for input and validate against the strict schema inside the adapter.

## 2026-01-22
- Date: 2026-01-22
- Context: TypeScript with verbatim module syntax.
- Lesson: Type-only imports are required for types used only in annotations.
- Action: Split value and type imports using `import type` to keep svelte-check green.

## 2026-01-22
- Date: 2026-01-22
- Context: Prompt template alignment and decoration rules.
- Lesson: Prompt template changes must be reflected in fixtures and drift checks immediately or contract tests will fail silently later.
- Action: Update prompt fixtures and add alignment phrase checks alongside template edits.

## 2026-01-22
- Date: 2026-01-22
- Context: Forbidden token detection in drift checks.
- Lesson: Internal prompt lines (e.g., “Font style: …”) can trip forbidden token scans if not explicitly excluded.
- Action: Sanitize drift detection token scans to ignore allowed lines while keeping provider-parameter checks intact.

## 2026-01-22
- Date: 2026-01-22
- Context: Renderer feature expansion (decorations/illustrations/shading).
- Lesson: Each new visual mode needs a deterministic fixture + adapter assertion so layout changes are provable, not assumed.
- Action: Add dense/scene fixtures and contract tests alongside renderer updates.

## 2026-01-23
- Date: 2026-01-23
- Context: Evidence reporting for non-coders.
- Lesson: Keep enforcement deterministic and let summaries be interpretive; never let summaries decide pass/fail.
- Action: Generate ledger and proof tape reports as supplemental evidence artifacts.

## 2026-01-23
- Date: 2026-01-23
- Context: Seam readiness communication.
- Lesson: A clean/dirty view helps non-coders track readiness, but it must stay derived from deterministic ledger data.
- Action: Add a clan chain report that reads seam ledger output only.

## 2026-01-23
- Date: 2026-01-23
- Context: Proof-summary enforcement.
- Lesson: A short cipher summary tied to evidence helps prevent silent drift without weakening enforcement.
- Action: Add cipher gate tooling and document the required cipher fields in `DECISIONS.md`.

## 2026-01-23
- Date: 2026-01-23
- Context: Blocked-probe visibility.
- Lesson: A deterministic assumption gate prevents hidden uncertainty from leaking into production decisions.
- Action: Add assumption alarm tooling and standard assumption fields in `DECISIONS.md`.

## 2026-01-23
- Date: 2026-01-23
- Context: Automated enforcement.
- Lesson: Local hooks + CI keep verification consistent without relying on memory.
- Action: Add `hooks:install` and a CI workflow that runs `npm run verify`.

## 2026-01-23
- Date: 2026-01-23
- Context: Deterministic Meechie tools.
- Lesson: Template-driven responses need explicit failure conditions for fault fixtures to stay meaningful.
- Action: Enforce lineup minimums in the adapter and reflect them in fixtures/tests.

## 2026-01-24
- Date: 2026-01-24
- Context: External probes with network restrictions.
- Lesson: DNS or network failures are indistinguishable from missing credentials unless explicitly captured.
- Action: Record blocked probes in `DECISIONS.md` and capture failing probe output under `docs/evidence/` to keep the block explicit.

## 2026-01-25
- Date: 2026-01-25
- Context: Optional share exports vs print output.
- Lesson: Share variants must be generated without changing print fidelity; keep share resizing isolated inside OutputPackagingSeam.
- Action: Add explicit export variants and keep print outputs unchanged.

## 2026-01-26
- Date: 2026-01-26
- Context: xAI image prompt constraints and governance clarity.
- Lesson: Canonical prompts must stay within provider limits or nothing works; governance docs need explicit AI guidance/checklists to keep autonomous agents honest.
- Action: Shorten the prompt template to under 1024 characters, update drift + fixture + probe text accordingly, and add AI-agent reference notes plus a detailed checklist for every future plan.

## 2026-01-27
- Date: 2026-01-27
- Context: UI+storage interactions and PWA install readiness.
- Lesson: Enforcing the entire seam flow in the browser (validation → prompt → render → drift → packaging → storage) keeps the output deterministic, but the UI must surface validation status and creation controls so users understand why Generate is gated.
- Action: Gate Generate on `SpecValidationSeam`, persist drafts/storage under `cb_creations_v1`/`cb_drafts_v1`, add creation favorites/deletions, and document the evidence+manifest updates for traceable proof.

## 2026-01-27
- Date: 2026-01-27
- Context: Prompt alignment phrasing consistency.
- Lesson: Sharing the exact alignment sentence between PromptAssemblySeam, DriftDetectionSeam, fixtures, and probes prevents semantic drift and keeps the negative prompt checks predictable.
- Action: Added `src/lib/utils/alignment-line.ts`, reused it in the adapters, and updated fixtures/probes to use the same sentence instead of duplicated strings.

## 2026-02-05
- Date: 2026-02-05
- Context: Browser seam probes using Playwright in a sandboxed environment.
- Lesson: Local loopback servers can be blocked by the sandbox even without external network access.
- Action: Run `node probes/browser-seams.probe.mjs` with escalated permissions when needed and capture the probe output as evidence.

## 2026-06-23 — rate-limit ordering, eviction, and config parsing
- Date: 2026-06-23
- Context: Automated review findings (Gemini Code Assist, Sourcery, Codex) on PR #187's new RateLimitSeam/rate-limiter code.
- Lesson: A rate-limit check placed before request-body parsing lets a stream of malformed JSON consume the same shared per-IP quota as real requests, which can starve legitimate users on shared IPs (schools, offices, NAT/carrier-grade IPs); an unbounded in-memory Map keyed by client IP needs an eviction sweep or it grows without bound under high IP churn; and a throwing `.parse()`/unguarded `getClientAddress()` call turns a bad env var or a host-specific edge case into a 500 for every client instead of a graceful fallback.
- Action: Reordered all six paid-AI routes to parse/validate the body before calling `enforceAiRateLimit`; added a size-triggered eviction sweep to `RateLimitSeam`'s `windows` Map; switched `rate-limiter.ts`'s config read to `safeParse` with a default fallback; tightened the `optionalInteger` regex to reject negative values instead of passing them to Zod's `.min()` checks; and wrapped `getClientAddress()` in try/catch with a fixed fallback key.

## 2026-06-23 — client-key fallback and per-field config schemas
- Date: 2026-06-23
- Context: Third round of Codex findings on PR #187's `RateLimitSeam`/rate-limiter code, after the schema-validation-before-quota fix.
- Lesson: A fixed fallback key for "I couldn't identify this client" cases (e.g. `getClientAddress()` throwing) recreates the exact bug it was meant to avoid: it collapses every unidentifiable client into one shared bucket, turning per-client limiting into an accidental site-wide cap if the failure isn't actually rare. Likewise, parsing several independent config fields through one combined Zod object means a single invalid field reverts every sibling field to its default too, even ones that were valid. And "validate before charging quota" must be applied to every preflight check in a pipeline, not just schema validation — a content-safety/disallowed-keyword check that runs after the rate limiter has the identical quota-theft problem as a schema check that does.
- Action: Replaced the fixed `'127.0.0.1'` fallback key with a freshly generated unique key per failed lookup so failures can't limit each other; split the rate-limit config Zod schema into independent per-field schemas with independent fallbacks; and extracted each pipeline's safety/disallowed-content check into an exported pure function (mirroring the existing `checkXInputShape` pattern) so routes can run it before `enforceAiRateLimit`, applied to `tools`, `meechie-studio-text`, and `generate` (the only three pipelines with a safety preflight at all).

## 2026-06-30 — fixed vs unique fallback key for unidentifiable rate-limit clients
- Date: 2026-06-30
- Context: Gemini Code Assist flagged a contradiction between the 2026-06-23 LESSONS_LEARNED entry (which recorded "use a unique key per failed getClientAddress() lookup") and the current `rate-limiter.ts` implementation (which uses a fixed `'unknown-client'` key). Both were merged into the same branch.
- Lesson: The 2026-06-23 lesson and action were themselves corrected: a unique key per failed lookup reintroduces a bypass attack. Any client that can deliberately cause `getClientAddress()` to throw (e.g. by omitting or malforming forwarded-for headers) would receive a fresh, empty rate-limit bucket on every request and escape the cap entirely. A shared bucket for all unidentifiable clients is worse for accidental misconfigurations (every unknown client competes for one quota slot) but better against deliberate bypass, and the billing-cost risk of bypass outweighs the accidental-cap risk. The 2026-06-23 action was therefore reverted back to a fixed key — but with a descriptive string (`'unknown-client'`) rather than the original `'127.0.0.1'` (which was a valid IP and could have collided with real localhost traffic).
- Action: No code change — `rate-limiter.ts` already has the correct fixed-key implementation with an inline comment explaining the bypass-attack rationale. Added this entry so the lesson history is self-consistent and future readers understand why the 2026-06-23 action was reversed.

## Template
- Date:
- Context:
- Lesson:
- Action:


## 2026-05-14
- Date: 2026-05-14
- Context: Repairing review feedback across multiple open PRs.
- Lesson: Review comments that span UI state, seam tests, and provider configuration need a PR-by-PR ledger so already-fixed branch feedback is not confused with still-actionable defects.
- Action: Keep follow-up PR bodies sorted both by source PR and by related problem, with explicit fixed/not-fixed status and paste-ready prompts for remaining work.

## 2026-05-16
- Date: 2026-05-16
- Context: Finishing PR #65 review blockers after bot checks failed on the prior head.
- Lesson: Bound UI values still need explicit persistence when the saved draft reads from `spec`, and shared provider configuration should normalize whitespace before request construction.
- Action: Keep small pure helpers covered with focused unit tests and run `npm run verify` before pushing review-followup commits.

## 2026-06-05
- Date: 2026-06-05
- Context: Porting PR #92 dedication draft-save behavior during the Handoff PR Resolution drain.
- Lesson: Browser tests should observe durable user-visible state, not monkey-patched `Storage.prototype` counters; component callbacks should pass stable values rather than forwarded DOM events when the parent does not need the event object.
- Action: Assert the saved draft payload with `expect.poll`, let child components translate DOM events into plain values, and use focused seam tests plus browser smoke coverage for UI-to-storage flows.

## 2026-06-05
- Date: 2026-06-05
- Context: Stabilizing the dedication E2E smoke test.
- Lesson: Hydration waits based only on a fixed timeout can race client-side setup; the input can show typed text before the page's mounted draft/session path is ready.
- Action: Wait for an observable readiness marker such as `cb_session_id_v1` before clearing storage and asserting debounced draft persistence.

## 2026-06-05
- Date: 2026-06-05
- Context: Full smoke validation after the dedication fix.
- Lesson: Date-rotated UI modes make hardcoded E2E headings stale; on 2026-06-05 the monthly mode is `Caption Drop`, not the older `Who Fucked Up?` expectation.
- Action: Derive rotating-mode expectations from `getWeeklyModes()` or freeze the browser clock when a test needs a fixed calendar state.

## 2026-06-05
- Date: 2026-06-05
- Context: Creating stacked replacement PRs during the Handoff PR Resolution drain.
- Lesson: Branch boundaries are easy to blur when several stacked PRs are active; catching the wrong base before commit avoids mixing unrelated workpacks.
- Action: Check `git status --short --branch` and recent `git log --decorate` before committing each workpack, then push stacked PRs against the intended parent branch.

## 2026-06-23 — independent config seam over a shared one
- Date: 2026-06-23
- Context: Wiring a new RateLimitSeam config read into the request path.
- Lesson: Before reusing an existing config seam (e.g. `AppConfigSeam`) for a new cross-cutting concern, check whether existing tests mock that seam incompletely for unrelated reasons — coupling a new feature to it can silently break those tests or force unrelated mock changes.
- Action: Give the new concern its own narrow, independent config read (mirroring the existing `ImageProviderConfigSeam` precedent) instead of extending a shared config seam that other tests already stub loosely.

## 2026-06-23 — .env.example raw-byte verification
- Date: 2026-06-23
- Context: Discovered while adding new env vars to `.env.example` for rate-limit configuration.
- Lesson: `.env.example`'s committed `HEAD` content was a single base64-encoded line rather than plaintext env declarations — likely introduced by a prior agent session that misread the file's true on-disk bytes. The Read tool's display for this file cannot be trusted to confirm true content either way; raw byte-level inspection (`python3 -c "open(path,'rb').read()"` or `od -c`) is required to verify `.env*` files.
- Action: Always verify `.env*` file contents with a raw, non-tool-masked byte read before and after editing; restored `.env.example` to correct plaintext in this session.

## 2026-06-23 — validate the full schema chain, not just JSON parsing
- Date: 2026-06-23
- Context: Hardening `enforceAiRateLimit` call ordering after the first PR #187 review round, then receiving a follow-up Codex finding on the same vulnerability class.
- Lesson: Moving the rate limiter after `parseRequestBody` only stops JSON-syntax-invalid bodies from consuming quota; it does nothing for schema-valid-but-business-invalid bodies (e.g. `{"spec": {}}`), since each pipeline's own `Schema.safeParse` ran *after* the route-level rate-limit check. "Validate before charging quota" must mean the full validation chain (JSON parse + schema shape), not just the cheapest first step.
- Action: Extract each pipeline's first-step `Schema.safeParse` into an exported `checkXInputShape(body)` function reused by both the pipeline and its route, so the route can reject schema-invalid bodies before calling `enforceAiRateLimit` without duplicating the error code/message. Applied to all six paid-AI routes/pipelines, with a 25-request-loop regression test per route proving none of them return 429 for schema-invalid input.
