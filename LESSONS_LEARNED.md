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

## 2026-08-24
- Date: 2026-08-24
- Context: Every AI text call in production returned HTTP 400 and no test or CI run caught it.
- Lesson: Two failures compounded. First, a provider model id was configurable through a deployment environment variable, so a stale dashboard value silently overrode the code and outlived the model itself — a model id is not a secret and does not vary per environment, so it belongs in code where a diff shows the change. Second, the provider adapter only read the OpenAI-style nested `error.message`, so xAI's string-shaped `error` was discarded and callers saw a bare "Bad Request"; the provider had been naming the exact cause the whole time. Green unit tests proved nothing here because every one of them mocked the provider.
- Action: Pin model ids in the plain-Node-compatible src/lib/core/models.js, delete the env reads, and read every known provider error shape in buildHttpError. When a seam's health depends on a third party, prove it with a probe against a real deployment — not with mocked tests.

## 2026-08-25
- Date: 2026-08-25
- Context: Every generated coloring page rendered the template's own section label "TYPOGRAPHY:" as page text.
- Lesson: The failure was positional, not lexical. A placeholder line was emitted unconditionally while the value beneath it was conditional, so an absent optional field left an empty slot that the next physical line fell into. Negative instructions did not save it: "no extra words" was already in the prompt and lost to the positive instruction "Secondary line EXACT". Anything addressed to a human author — bracketed notes, section labels — is drawable content as far as an image model is concerned.
- Action: Emit drawable text as explicitly quoted, self-terminating lines, and never emit a placeholder whose value is conditional. Keep the terminator narrow enough that it does not contradict later list-item or dedication instructions. When changing the canonical prompt, remember it is duplicated across seven fixtures and a probe, and regenerate them from the adapter rather than by hand — with fault fixtures regenerated so their intentional defect survives.

## 2026-08-25
- Date: 2026-08-25
- Context: A route unit test passed an event-scoped fetch mock, but the route discarded it and the provider adapter used global fetch.
- Lesson: A mock proves isolation only when it replaces the boundary production actually calls; an unused dependency-shaped mock can leave a unit test making live provider requests and retrying until timeout.
- Action: Stub global fetch for the generate-route test with guaranteed cleanup, keep the event fetch assertion, and test the core pipeline through explicit injected dependencies where possible.

## 2026-09-04
- Date: 2026-09-04
- Context: Rebuilding the three standalone mode routes onto a shared Svelte 5 runes state class. `svelte-check` reported "Cannot use 'state' as a store" on every `$state('')` in files that had a local `const state = new VerdictPageState(...)`.
- Lesson: In runes mode, `$name` still means "subscribe to the store `name`". A local binding called `state` therefore turns every `$state(...)` in that file into a store subscription against it, and the file stops compiling — the error names the store, not the rune, so it reads as a type problem rather than a naming collision. Any local whose name collides with a rune (`state`, `derived`, `props`, `effect`) does this.
- Action: Never name a local binding after a rune. The state instance is `studio`, not `state`. `npm run check` catches it; nothing else in the chain does, because the tests import the class directly and never hit the component.

## 2026-09-04
- Date: 2026-09-04
- Context: A new core module imported `GeneratedImage` from `src/lib/seams/image-generation-seam/contract` and every property access failed to typecheck.
- Lesson: This repo exports **two different types called `GeneratedImage`**. The seam's is `{ id, url?, b64? }` — what a provider hands back. The flat contract's (`contracts/image-generation.contract.ts`) is `{ id, format, mimeType, data, encoding }` — the decoded image `/api/generate` returns. Only the second carries `format` and `encoding`. Importing by name from the "newer-looking" layout is the wrong instinct; the two layouts are not two spellings of one type.
- Action: When a type name resolves in both layouts, check which shape the value at hand actually has before picking the import, and say in a comment which one was chosen and why.

## 2026-09-04
- Date: 2026-09-04
- Context: A test asserting that an abandoned generation is discarded passed even after the guard it existed to protect was deleted.
- Lesson: The race had two windows — before `/api/generate` answered, and during the two packaging calls after it — and the test only ever opened the first. An earlier guard absorbed the mutation, so the suite stayed green with the later one gone. A staleness test proves only the specific await it suspends on.
- Action: Suspend the test at each await in turn, not just the obvious one, and confirm by deleting the guard that the test is supposed to be protecting and watching it fail.

## 2026-09-04
- Date: 2026-09-04
- Context: SonarCloud flagged `void this.loadOwner()` in a constructor. The Quality Gate had already passed, so nothing forced the fix.
- Lesson: The finding was a style rule; obeying it properly exposed a real bug. Eagerly resolving the session in the constructor meant a browser with site data blocked resolved to null once and stayed that way for the life of the page, so every later save said "Session is still connecting. Try again in a moment." — inviting a retry against a condition that could never change. Moving the resolve to the point of use, memoised but **cleared on failure**, made the retry real and let the message tell the truth. A passing gate is not the same as nothing to fix.
- Action: Never start async work in a constructor — it cannot report failure to its caller, and it usually is not needed that early. Resolve on demand, share the in-flight promise, and never cache a failed resolve as the permanent answer.

## 2026-09-04
- Date: 2026-09-04
- Context: Mutation-testing a new guard — deleting it to confirm the test that covers it fails — reported a pass, which would have meant the test proved nothing.
- Lesson: The guard was fine; the mutation had not applied. Prettier had wrapped the guarded line across two lines after it was written, so the scripted patch string no longer matched and the file was never changed. The tempting reading of a surviving mutation ("the guard is unnecessary, or the test is worthless") is the wrong one to reach for first.
- Action: When a mutation survives, confirm it actually landed — diff the file, or make the patch script assert its target was found — before drawing any conclusion about the guard or the test.

## 2026-09-04
- Date: 2026-09-04
- Context: A memoised async resolve was documented, in a merged log entry, as "cleared on failure so a failed resolve is never cached". A reviewer found it cleared the memo when the call *returned* an error but not when it *threw*.
- Lesson: A promise memo has two failure shapes, and `if (result) ... else ...` after an `await` only sees one of them — a rejection skips the branch entirely and leaves the rejected promise cached forever, so every later caller re-awaits and re-throws it. Writing the invariant down in prose did not make it true for the case that had not been enumerated.
- Action: Put the `try/catch` *inside* the memoised function so every outcome becomes one value, and reach the clearing branch through it. When claiming an invariant, enumerate the failure shapes it has to cover rather than describing the branch that happens to exist.

## 2026-09-04
- Date: 2026-09-04
- Context: A route decided whether to relabel its UI by comparing shared state before and after an awaited call: `const previous = x.verdict; await x.request(); if (x.verdict !== previous) relabel()`.
- Lesson: That comparison proves something changed, not that this call changed it. A request abandoned mid-flight, whose replacement has already landed, observes exactly the same before !== after as a successful one — and relabels the new result with the abandoned input. Callers cannot distinguish abandonment from success by observing shared state; only the operation itself knows.
- Action: Have the async operation return what it actually did (the value it installed, or null), and branch on the return value. Never infer causation from a before/after diff of state other callers can also write.

## 2026-09-04
- Date: 2026-09-04
- Context: Two packaging calls were split apart specifically so a square-image failure could not take the printable PDF with it. A reviewer pointed out that a *rejection* from the square call still escaped to the outer catch and discarded the whole page, print PDF included.
- Lesson: The adapter returns a `Result`, so the code checked `.ok` on both calls — and `package()` turns out to have no try/catch anywhere in its body, with pdf-lib's embedPng/embedJpg/save and the canvas in imageToPngBase64 all able to throw. A Result-returning function is a promise about the return *value*, not about the absence of a throw. The split bought nothing against the failure shape most likely to occur, and the tests passed only because they returned `{ ok: false }` — the shape the code already handled. This was the third instance of the same miss in one change.
- Action: Before relying on a `Result` boundary for isolation, read the callee for throw paths; if it wraps nothing, wrap the call. Install the expensive, already-succeeded work (the paid generation) before the cheap local work that can fail (packaging), so a local failure costs the download and never the page. And test the throw path explicitly — returning `{ ok: false }` does not exercise it.

## 2026-09-04
- Date: 2026-09-04
- Context: Ported one fix out of a three-part pattern from a sibling implementation (install the page before packaging), leaving the other two behind. The next review round found two defects, both created by that half-port, and writing the test for one uncovered a third.
- Lesson: The three parts were load-bearing together. Installing earlier is only safe once the bytes have been validated, and "install before packaging so a failure cannot cost the page" means nothing if entering the function already destroyed the page. Taking the middle step alone moved the failure rather than removing it.
- Action: When porting a fix from a sibling implementation, read the whole block it lives in and port the invariant, not the line. If two implementations of the same flow exist, treat that as the defect: the one that went through review first will keep learning things the other has to be told.

## 2026-09-04
- Date: 2026-09-04
- Context: A fix needed a user-facing error string. The honest string was "The page on screen was kept" — and the code could not honour it, because the function destroyed that page on entry.
- Lesson: Writing the message the user should see, and then checking the code can actually make it true, found a defect that no reviewer had reported and no test covered. A message is a claim about behaviour; an untrue one is a bug report you wrote yourself.
- Action: When adding user-facing text that asserts what the system did, verify the assertion against the code path before shipping the string. Prefer writing the message first.

## 2026-09-04
- Date: 2026-09-04
- Context: A reviewer raised the same concern twice — first as a category argument ("this crosses seam boundaries, run the workflow"), then as a named line with a named consequence (an id fallback that collides and silently drops a saved record).
- Lesson: The first was refused with measurements and the second accepted, and that is not inconsistency. A finding that argues from categories is answered with categories; a finding that names a line is answered by reading that line. The concrete version also broke the defence used against the general one: "the two older call sites do the same thing" was true of the clock, and false of the id, because `session.adapter.ts` already mixed randomness into its fallback and this code had left it out.
- Action: When refusing a finding, refuse the argument that was actually made, and record what would change the answer. When it comes back with evidence, re-check from scratch instead of reusing the earlier refusal — and check whether the defence still holds rather than assuming it does.

## 2026-09-04
- Date: 2026-09-04
- Context: A test asserting that two saves get distinct ids passed against the broken clock-only fallback, because the awaits between the two saves advanced the real clock past the collision window.
- Lesson: The test exercised a code path but not the *condition* the defect needs. Anything that depends on two events sharing a timestamp cannot be tested with a running clock; the collision window is smaller than the test's own overhead.
- Action: Freeze the clock when testing a defect whose precondition is "in the same millisecond", and confirm by restoring the defect and watching the test fail. Third instance in one change of a mutation exposing a test that proved less than it claimed.

## 2026-09-04
- Date: 2026-09-04
- Context: Fixed an id collision by appending `Math.random()`. The next SonarCloud run failed the Quality Gate on a required security condition: PRNG used in a security context.
- Lesson: The rule's framing did not fit — a vault record id is not a secret — and arguing that would have defended the habit rather than the code. The real problem was that `crypto.getRandomValues` sat two lines above and the fallback reached past it. The better replacement was not a different random source but a monotonic counter, which cannot repeat within a document and therefore answers the original collision more directly than randomness did. The randomness was never the point; uniqueness was.
- Action: When a security rule fires on code that is not security-sensitive, check what the rule is really pointing at before disputing its framing. And when reaching for randomness to get uniqueness, ask whether a counter would do — it is deterministic, testable, and cannot trip a PRNG rule.

## 2026-09-04
- Date: 2026-09-04
- Context: `CLAUDE.md` described `/m/[mode]` as "linked from nowhere ... delete candidate". A reviewer pointed out that `StudioHero.svelte` renders a `/m/<id>` link for every weekly mode and the home page mounts it.
- Lesson: The claim came from the previous run's log, was repeated in this run's log, and was then promoted into the navigation document — where an unverified sentence becomes an instruction. A future run following it would have 404'd live links on the most-visited page in the app. Every code claim in this run was measured before it was written; this one was inherited and never checked, and copying a claim forward launders it into fact.
- Action: Verify an inherited claim before repeating it, and especially before promoting it from a log into a file that tells the next session what to do. A one-line grep would have caught this. Treat "the last run said so" as a hypothesis with a citation, not as evidence.

## 2026-09-04
- Date: 2026-09-04
- Context: `makePage` was changed to stop destroying the page on entry — a good fix. The next review round found two defects, both in guards that were correct for the old shape and silent about the window the new one opened.
- Lesson: A fix that changes *when* state is valid invalidates every guard whose condition was written against the old timing. Here the page now outlives the start of its own replacement, so "can save" and "can ask for a new verdict" both had to learn about `isGenerating`, and neither did. Two of the existing tests also became unreachable — which was the clearest signal the new guard was real, not a reason to delete them.
- Action: When changing the lifetime of a piece of state, enumerate every guard that reads it and re-derive each one against the new timing. And when an existing test goes red because a new guard made its scenario impossible, re-route it to a path that still reaches the guard rather than deleting it.

## 2026-09-04
- Date: 2026-09-04
- Context: Rebuilt `/m/[mode]` and keyed the component on the slug so switching modes cannot carry the previous mode's verdict across. Wrote an end-to-end test for it, ran the test with the key deleted, and it passed.
- Lesson: The test navigated with `page.goto`, which builds a fresh document — and component reuse across parameter changes only happens on *client-side* navigation. So the test exercised the defect's subject without ever reaching its precondition, and would have certified the key as load-bearing while proving nothing. Worse, the honest version of the test had nowhere to click: no link in the app went from one `/m/` page to another, so the failing input was not reachable through the interface at all. The fix was to make it reachable — a row of links to the other modes, which the page needed anyway — and then to mark the document and assert the mark survived the click, so the test fails if the navigation ever stops being client-side.
- Action: When a guard depends on *how* a transition happens rather than that it happened, assert the mechanism in the test, not just the outcome. And when the failing input cannot be reached through the app, that is a finding about the app, not a reason to write a test that simulates it — the fourth instance in this repo of a mutation exposing a test that proved less than it claimed.

## 2026-09-05
- Date: 2026-09-05
- Context: Run 5 of the worst-feature routine. Three prior runs passed over the wig try-on, each
  citing the previous one's judgement that it "works".
- Lesson: A deferral is not a finding. Re-measuring the feature against its files turned up six
  defects, including a catalog that bypassed its own seam and a portrait that could be labelled with
  the wrong wig. An inherited "this one is fine" compounds exactly like an inherited "this one is
  broken" — run 4's log warned about the second and this is the first.
- Action: Re-derive a runner-up's status from the code each run. Cite the prior reasoning only after
  confirming it still holds.

## 2026-09-05
- Date: 2026-09-05
- Context: Facet counts on the rebuilt wig catalog.
- Lesson: A number rendered next to a control is a promise about what that control does. Counting
  each facet value against the whole catalog is simpler and produces "Black 4" on a filter that
  returns nothing — the same class of defect as a decorative favourite pin, but harder to spot
  because a number looks like evidence.
- Action: Count a facet against the other active facets, disable a value that would return nothing,
  and pin it with a property test asserting count equals actual result size for every value, not
  with one example.

## 2026-09-05
- Date: 2026-09-05
- Context: A staleness bug in the wig try-on that four runs of review had not found.
- Lesson: Changing a data shape can expose a defect that reading the old shape never would. One
  shared `tryOnPortraitUrl` string made "which wig is this portrait of?" an unaskable question;
  keying portraits by wig forced the question, and the answer showed a late response could label a
  portrait with the wrong wig.
- Action: When a rebuild replaces a single shared value with a keyed one, treat every write to the
  old value as a staleness candidate and capture the key before the await, not after it.

## 2026-09-05
- Date: 2026-09-05
- Context: The Codex round on Run 5. Two of its three real findings were invariants this run had
  written into a comment and then failed to enforce on a second code path — a portrait of a
  replaced selfie, and a selected facet chip that could not be unselected.
- Lesson: A guard that has been reasoned about is not thereby applied everywhere it is needed, and
  the comment asserting it makes the gap harder to see rather than easier, because the file reads as
  though the question is settled. Both defects sat exactly where the stated invariant met a path
  that was written later than the sentence describing it.
- Action: When a comment states an invariant, enumerate the paths it has to hold on and check each
  one, rather than trusting the comment at the site where it was first satisfied. In particular, an
  async handler with two inputs needs a staleness token per input, not per handler.

## 2026-09-05
- Date: 2026-09-05
- Context: Run 5's second review round. Moving the wig catalog from a module-scope `import
  wigs.json` onto `WigCatalogSeam` inside a component `$effect` removed the cards and their
  affiliate links from the server-rendered HTML.
- Lesson: A seam contract is asynchronous by construction, so replacing a synchronous module import
  with a seam call inside a component silently converts server-rendered markup into client-only
  markup. Nothing in a hydrated browser shows it, which is why every check passed.
- Action: A seam read that feeds initial markup belongs in a `load` function, not a component
  `$effect`. When a change moves a read behind a seam, assert the response body rather than the
  rendered page.

## 2026-09-05
- Date: 2026-09-05
- Context: The duplication gate flagged a fourth pair of near-identical test openings in this
  repository, again between a test and the second test written by copying it.
- Lesson: Every instance has been a second test copying the first, never the same logic written
  twice by accident. In a staleness or provenance test the setup *is* the subject, so the second
  case differs from the first in exactly one step.
- Action: When writing the second test of a pair that differs in one step, write both through one
  helper parameterised by that step, rather than extracting after a scan flags it.

## 2026-09-05
- Date: 2026-09-05
- Context: Run 5. A `restoredSeedPageItems` flag marked text as invented so it would not be saved as
  the reader's own. It failed twice: once because "is this true?" is a different question from "is
  this about this page?", and once because a draft save serialised the text while the flag stayed in
  memory, so a refresh restored the text as genuine.
- Lesson: Provenance that governs what gets persisted must itself be derivable from what was
  persisted. A boolean held beside a record is not part of that record, and any round trip drops it.
- Action: Recompute the provenance from the stored shape at every restore point rather than carrying
  a flag across the boundary — and check whether the flag answers one question or two before reusing
  it for the second.

## 2026-09-05
- Date: 2026-09-05
- Context: Run 5 had already recorded "a guard that has been reasoned about is not thereby applied
  everywhere it is needed". The next commit added `tryOnPageOnScreen` to `saveToVault` and not to
  `saveDraft` — the same mistake, made after writing the lesson about it.
- Lesson: Writing a rule down does not prevent the next occurrence. Removing the second copy does.
  Two writers of the same record answered the same question separately and drifted; one shared
  accessor makes the divergence impossible and makes a single mutation fail both call sites' tests.
- Action: When a condition governs more than one writer of the same data, express it once as a
  shared accessor rather than repeating it and relying on a lesson to keep the copies in step.

## 2026-09-05
- Date: 2026-09-05
- Context: Replacing a wig try-on portrait for the *same* wig defeated every staleness guard in the
  feature — the wig identity was unchanged and the page token did not advance.
- Lesson: Identity tokens catch substitution, not mutation in place. A value replaced under a stable
  key is invisible to a guard that compares keys.
- Action: For an operation that can be re-run against the same key, guard on "is a replacement in
  flight" rather than on whether the key changed.

## 2026-09-05
- Date: 2026-09-05
- Context: Run 5. `buildStudioTextFromSpec` had to return a `MeechieStudioTextOutput`, and the
  contract demands at least two `pageItems`, so a page that prints none — a wig try-on portrait —
  got the demo seed's. That fabrication was accepted as unavoidable and *guarded* instead: a
  `restoredSeedPageItems` flag kept it out of the vault write and out of the revision payload. It
  still reached the paper as the page's list, and still lit up Save to Vault through
  `canSaveToVault`, because a guard only covers the call sites someone thought of.
- Lesson: A schema minimum is a statement about valid values, not an obligation to produce one. When
  the honest answer is "this has no text", the return type should be able to say so. Accepting an
  invented value and guarding its uses means enumerating every use, forever, and the two that
  mattered most here were the two nobody enumerated — the screen and a derived `!!` check.
- Action: Before guarding a fabricated value, ask whether the function can return `null` instead.
  Deleting the invention removes the need for every guard on it, including the ones not yet written.

## 2026-09-05
- Date: 2026-09-05
- Context: Removing that fabricated text immediately broke a caller: the settings rebuild fell back
  to the demo seed and retitled a reopened try-on page, because the fabricated value had carried the
  page's real title in the one field it got right.
- Lesson: A wrong value is not inert. Callers come to depend on the parts of it that happen to be
  correct, so deleting it exposes them — and the exposure is a defect the fabrication was hiding,
  not one the deletion created.
- Action: After removing a fallback, re-read every consumer of the value for the fields it was
  silently supplying, and give each one a source that is right for the reason it needs it.

## 2026-09-05
- Date: 2026-09-05
- Context: A try-on test fixture used `data:image/png;base64,ZmFrZQ==` — four bytes spelling "fake".
  The vault refuses to rebuild image bytes whose magic number it does not recognise, so every reopen
  in that block restored no picture and the assertions after it were about an empty page.
- Lesson: A stub that the code under test *correctly rejects* makes a test pass by skipping the
  behaviour it names. This is the same failure as an assertion that holds either way, arriving
  through the fixture instead of through the expectation.
- Action: Fixtures for data the product validates must be valid. Use real bytes — a 1×1 PNG is
  small enough — or assert that the rejection happened, but never let a rejected stub sit upstream
  of assertions about what was restored.

## 2026-09-05
- Date: 2026-09-05
- Context: Rebuilding the home studio's download row (`WORST_TO_BEST_LOG.md` Run 6).
- Lesson: A `$derived` class field in Svelte 5 is still assignable, so a test that writes to one and
  then asserts on it passes whatever the production code does. Four existing `studio-state` tests
  became exactly that the moment `packagedFiles` stopped being `$state`, and the suite stayed green.
- Action: Arrange through the one stored field (`packageAttempts`), never through a derived view;
  and mutation-check any test whose subject changed from stored to derived.

## 2026-09-05
- Date: 2026-09-05
- Context: Same run — removing a packaging call from a path that could legitimately have no images.
- Lesson: Deleting a call also deletes whatever message that call was accidentally producing. The
  zero-image generate response (`images` is `z.array(...)` with no minimum) had only ever been
  reported as the packaging seam's "No images provided for packaging."; the rebuild would have
  replaced a confusing message with silence.
- Action: When an early return replaces a call, ask what the old call was reporting for the inputs
  the early return now swallows, and report it where it actually happens.
