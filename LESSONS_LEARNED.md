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

## 2026-06-20
- Date: 2026-06-20
- Context: Scheduled autonomous session asked to find the hardest fix needed and open a PR, on a designated branch (`claude/sweet-mendel-p5s5bt`) that turned out to already hold 42 unmerged commits of completed PR-drain integration work from prior sessions.
- Lesson: Several prior sessions did the hard work of manually integrating dozens of stale PRs onto one branch but none of them ever reached the final "open a PR" step, so the work sat invisible and unreviewed for 12+ days while other automated sessions kept opening new, duplicate PRs (Issue #175) instead of noticing the finished branch.
- Action: Before writing any new code on an assigned branch, diff it against `main` (`git rev-list --left-right --count main...HEAD`) and check for an existing PR. If the branch is already ahead with verified-green, unshipped work, ship that first instead of adding another isolated fix on top of it.

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

## 2026-06-20
- Date: 2026-06-20
- Context: Reviewer bot (Codex) flagged that PR #176's `plan.md` self-critique cited "fresh `npm run build` success, clean `npm run lint`" without a committed evidence file backing either claim, while `verify.txt`/`test.txt` were properly cited.
- Lesson: Every gate named in a plan's self-critique or a PR description must point at a committed evidence file, not just an inline assertion; partial citation (some gates with files, some without) reads as proof when it is actually a mix of proof and assertion.
- Action: Capture `npm run build` and `npm run lint` output to `docs/evidence/<date>/build.txt` and `lint.txt`, regenerate `proof-tape` so it picks them up automatically, and update the citing prose to name the exact files.

## 2026-06-20
- Date: 2026-06-20
- Context: This session computed "`claude/sweet-mendel-p5s5bt` is 42 commits / 467 files ahead of `main`, 0 behind, no existing PR" and shipped that as PR #176's headline claim. A Codex review comment caught that `git diff --shortstat` on the actual head commit showed only 17 files changed. Direct verification (`git fetch origin main` followed by `git diff --shortstat origin/main..HEAD`) showed the real diff was 17 files / +2698 lines — the "42 commits" figure had been computed against a stale local `main` ref that was never fetched from `origin/main`, inherited across a context-window compaction earlier in the session.
- Lesson: "Ahead/behind main" claims used to justify shipping decisions (or PR descriptions) must be computed against `origin/main` directly, immediately before stating the claim — never against a possibly-stale local `main` ref, and never carried forward unverified across a conversation summary/compaction boundary.
- Action: Before citing any ahead/behind/diff-size figure in a PR body, decision log, or plan, run `git fetch origin main` then `git diff --shortstat origin/main..HEAD` (or `git rev-list --left-right --count origin/main...HEAD`) in the same turn and quote that output directly, rather than reusing a previously-computed number.

## 2026-06-20
- Date: 2026-06-20
- Context: A second Codex comment on PR #176 caught that `docs/evidence/2026-06-20/assumption-alarm.json` reported `"blockedSeams": []` even though `docs/seams.md` shows `TBD (blocked)` for `ImageGenerationSeam` and `WigTryOnSeam`. `scripts/assumption-alarm.mjs` destructured `const [seam, , probe] = cells`, which reads the table's "Probe" column (a file path, index 2) instead of the "Last probe" column (the status text, index 8) — so the `.startsWith('TBD')` filter was checking file paths and could never match, silently producing an always-empty `blockedSeams` list.
- Lesson: A markdown-table parser that destructures columns positionally with blank placeholders (`[a, , b]`) is fragile and silently wrong if the table gains or reorders columns; it gives no error, just a wrong, always-passing-looking result.
- Action: Index table columns by name-documented position explicitly (`cells[8]` with a comment naming the column) rather than skip-destructuring, and re-run the script immediately after any `docs/seams.md` column change to confirm the filter still matches real rows.
