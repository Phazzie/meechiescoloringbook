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

## 2026-06-28
- Date: 2026-06-28
- Context: Audit found none of the 6 public API routes had rate limiting, despite most calling billed third-party AI providers (xAI, Gemini).
- Lesson: A shared module-level rate-limit singleton used across unit tests in the same file will leak hit-counts between unrelated test cases unless each test gets its own isolation key; a fixed default client address in test builders silently couples otherwise-independent tests to call order and count.
- Action: Give test event builders a per-call-unique default key (e.g., an incrementing fake client address) and only reuse a fixed key in the one test deliberately exercising the 429 path.

## 2026-06-28
- Date: 2026-06-28
- Context: Automated review (gemini-code-assist, sourcery-ai, codex) on PR #201 flagged that the new RateLimitSeam's `hits` map never evicted expired keys (unbounded memory growth) and that `getClientAddress()` can throw in some deployment environments, which would crash the guard before any route logic ran.
- Lesson: A sliding-window limiter keyed by client address needs its own bounded-memory story (periodic full-map pruning, not just per-key filtering on the hot path) from day one; any call into a runtime-provided accessor like `getClientAddress()` must be treated as a boundary call that can throw, even though its type signature says it returns a plain string.
- Action: Add interval-gated pruning over the whole map (deleting keys with zero remaining active timestamps) using the already-injected `now`, and wrap `getClientAddress()` in try/catch with a stable fallback bucket key so a single unresolvable-IP request can't take down the route.

## 2026-06-28
- Date: 2026-06-28
- Context: A second round of codex review on PR #201 (after the interval-gated pruning fix landed) found that pruning gated on a 60s interval still allows unbounded peak memory growth from a single burst of unique keys arriving inside one interval, and that two rate-limit 429 tests could issue live, billable provider calls: `api-generate.test.ts` injected a `fetchMock` via the event's `fetch` property, but the route never reads `fetch` off the event at all — the real image-generation adapter calls the bare global `fetch` directly — and `api-chat-interpretation.test.ts`'s 429 test had no provider mock of its own, unlike its sibling tests, so `afterEach(() => vi.restoreAllMocks())` left it exposed.
- Lesson: An interval/time-gated mitigation bounds steady-state, not worst-case-within-one-interval; a hot-path map needs a hard insertion-time cap, not just periodic cleanup, to bound peak memory. Separately, injecting a mock fetch/value into a test event only protects a test if the code under test actually reads that mock off the event — always trace the real call path (route → pipeline → adapter) before trusting an injected mock, and never assume a sibling test's mock setup carries over once `vi.restoreAllMocks()` runs between tests.
- Action: Add a `MAX_KEYS` cap to `policy.ts` that evicts the oldest-inserted key (via `Map` insertion order) when a new key would exceed it; mock `$lib/adapters/image-generation-seam` directly in `api-generate.test.ts` (matching the established `api-image-generation.test.ts` precedent) instead of relying on an unread `fetch` mock; add an explicit `vi.spyOn(providerAdapter, 'createChatCompletion')` to the chat-interpretation 429 test instead of relying on no mock at all.
