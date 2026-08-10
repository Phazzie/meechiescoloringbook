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

## 2026-08-05

- Date: 2026-08-05
- Context: Brand persona alignment and quote pool governance.
- Lesson: AI agents must avoid lazy defaults (e.g. flattening an adult cultural verdict app into a "kids app"); voice quotes across adapters and fixtures must be locked strictly to the user-approved canonical set.
- Action: Purged generic copy from reports/docs, updated `voice-pack.ts` and `sample.json` to feature exclusively the 5 canonical quotes, and established a 5-phase operational release roadmap.

## 2026-08-05

- Date: 2026-08-05
- Context: /learn command session - Subagent Ticket Scoping Skill & Workspace Rules.
- Lesson: Complex feature work must be scoped into atomic 1–3 file sub-tickets designed for 5–15 minute subagent execution; workspace rules must be persisted in `.agents/AGENTS.md`.
- Action: Created `.agents/skills/meechie-ticket-scoping/SKILL.md`, created workspace rule file `.agents/AGENTS.md`, and updated operational roadmap with atomic sub-tickets `[TICK-001a]`, `[TICK-001b]`, `[TICK-001c]`.

## 2026-08-06

- Date: 2026-08-06
- Context: Execution of [TICK-001b] & [TICK-001d] - Global Layout Metadata & Header Nav Audit.
- Lesson: Centralizing default SEO/Social meta tags (OG, Twitter cards) in root `+layout.svelte` establishes consistent branding and title hierarchy across all child routes.
- Action: Updated `src/routes/+layout.svelte` and `src/routes/+page.svelte` title/meta tags and confirmed zero errors via `npm run check`.

- Date: 2026-08-06
- Context: Execution of [TICK-001i0], [TICK-001i1], [TICK-001i2], [TICK-001e], [TICK-001f], [TICK-001h], [TICK-002c] - Low/Medium Release Workpack.
- Lesson: In Svelte 5 server rendering, `<meta>` tags in `<svelte:head>` accumulate across layout and page boundaries, whereas `<title>` tags replace each other. Making layout `<meta name="description">` fallbacks route-aware prevents duplicate description tags on sub-pages with custom descriptions.
- Action: Updated `+layout.svelte` fallback description logic, added custom descriptions to sub-page routes (`/who-fucked-up`, `/rate-his-excuse`, `/random`, `/meechie`), reoriented hero section copy, aligned design/readme docs, and verified offline mock behavior.

- Date: 2026-08-06
- Context: Beginning key-specific xAI model discovery after a credential was believed to have been copied from another project.
- Lesson: A non-empty environment variable is not evidence of a usable credential; placeholders can satisfy naive presence checks and make every authenticated endpoint fail with an unhelpful HTTP status.
- Action: Before external probes, verify credential structure without printing the value, distinguish placeholders from plausible keys, and require an authenticated model inventory before changing current provider defaults.

- Date: 2026-08-06
- Context: Auditing Gemini's low/medium workpack before hard integration.
- Lesson: Green type checks and unit tests do not prove documentation structure, exact interaction copy, or browser head behavior; the design token hierarchy was flattened and Random Meechie said “draw” despite all automated tests passing.
- Action: Review diffs semantically, scan for persona drift, inspect structured documentation, and test both server-rendered and client-navigation metadata before accepting an agent handoff.

- Date: 2026-08-06
- Context: Key-specific xAI migration and bounded live provider verification.
- Lesson: A structurally plausible key still needs authenticated inventory, while a paid request without durable status/body capture can consume the one-call budget without proving the application contract.
- Action: Select only key-exposed exact model IDs, persist sanitized inventory before migration, and make live-proof clients capture raw status and response text before parsing so client diagnostics cannot erase the provider result.

- Date: 2026-08-06
- Context: Running the full suite with a real provider credential installed.
- Lesson: A route-level unit test that constructs production dependencies can silently become an integration test when `.env` changes; two timed-out test attempts initiated provider requests before this isolation defect was found.
- Action: Mock every external adapter and provider-config seam before importing server routes in unit tests, and reserve real credentials for explicitly named, bounded integration probes.

## 2026-08-10

- Date: 2026-08-10
- Context: Porting E2E tests to Seam-Driven Development.
- Lesson: When replacing inline Playwright `page.route` intercepts with deterministic fixture data, the mock must replicate the exact JSON structure emitted by the `+server.ts` layer (e.g. `{ ok: true, value: ... }`) because the client adapter uses Zod `safeParse` on the network boundary. Additionally, Svelte component testing requires explicit hydration checks (`data-hydrated` or `networkidle`) before dispatching DOM clicks to prevent race conditions.
- Action: Updated `smoke.spec.ts` and `error-states.spec.ts` to use real SDD contract fixtures for network intercepts and integrated a `waitForLoadState` hydration check before user interactions.

## 2026-08-10

- Date: 2026-08-10
- Context: Zero-Trust Adversarial Audit of the main studio generation flow.
- Lesson: Canceling network requests with `AbortController` throws an error that is caught locally, meaning `finally` blocks will execute. If multiple async functions overwrite the same loading state concurrently, an aborted request can prematurely clear the loading spinner of a still-active parallel request, causing catastrophic UI state corruption.
- Action: Extracted all `AbortController` assignments to block-scoped `currentAbort` variables and explicitly checked `!currentAbort.signal.aborted` before mutating error or loading state.
