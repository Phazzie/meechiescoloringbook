<!--
Purpose: Capture pitfalls, surprises, and fixes in short dated entries.
Why: Prevent repeat mistakes and preserve working knowledge.
Info flow: Experience -> lesson -> action applied to future changes.
-->
# Lessons Learned

Short, dated entries capturing pitfalls, surprises, and fixes.

## 2026-09-10
- Date: 2026-09-10
- Context: The image prompt's TYPOGRAPHY section opened with the constant `'Bold bubble letters; thick outlines.'` and then, four lines down, emitted `Stroke: 4px.` for a spec asking for the thinnest linework the contract allows. A review of PR #350 had found the identical shape one section over — `letteringLine` claiming page occupancy that `whitespaceScale` already owned — and the fix removed it from the line it was reported on and left it standing in the constant directly above.
- Lesson: **A contradiction reported on one line is a search, not a repair.** "Two instructions about one property" is a property of the whole prompt, and the review that found it named one instance because one instance is what the diff touched. Fixing only what was reported left the same defect live on the neighbouring field, in the section the fix had just edited, for a whole run.
- Action: When a review names a class of defect rather than a typo, grep the whole artifact for other members of the class before closing the finding. Here that is one command over the assembled prompt: which lines make a claim that a spec field also makes? The answer was two, and only one was fixed. Two more remain and are recorded rather than assumed absent — `'Bold bubble letters'` against `Font: block.`/`Font: hand.`, and `'Glitter outline only (no shading).'` against `Shading: hatch.`

## 2026-09-10
- Date: 2026-09-10
- Context: A test asserting that the prompt makes exactly one claim about linework weight was written three times before it was right. Matching the word "outlines" counted `outputLine`'s "Black outlines on white" (a colour claim) and `illustrationLine`'s "Illustrations: simple outlines" (a content claim). Narrowing to bare thickness adjectives then counted `no**thin**g else` out of the TEXT block, twice.
- Lesson: **A test for "how many places say X" fails in both directions before it works, and the passing version is the dangerous one.** The substring draft went green the moment the word list stopped matching anything — which reads as success and proves nothing, since the encoder's own weight words were not in the list. The repository already pins this exact trap for forbidden tokens in `drift-detection-helpers.test.ts` and it was re-derived from scratch anyway.
- Action: For any "exactly one occurrence" assertion, take the red proof by restoring the defect, not only the green run. Both new assertions here were confirmed against the reinstated constant before the fix went back in; the substring draft would have passed that check too, which is why the assertion has to match the *pairing* — a weight word applied to outlines — rather than either half alone.

## 2026-09-10
- Date: 2026-09-10
- Context: The packaging step turns a finished coloring page into its files entirely on the reader's own device. No network, no provider, no quota. It was therefore the cheapest step in the whole app to run a second time — and it was the only failing step with no way to run it again. The one control near a failed download was "Make the page", which buys a generation and returns a *different* picture.
- Lesson: **The cost of a retry and the presence of a retry were inversely related in this app.** Every expensive failure had been given a considered retry over three runs; the one free failure had none. The reason is that a local step reads as trivial while it is working, so nobody asks what it offers when it is not — and the moment it fails, the reader is standing in front of the only button on the screen, which is the paid one.
- Action: For each failure path, ask what the reader's *next press* would be if no remedy is offered. Where the nearest control spends money and the failed step did not, that is the gap, whatever the failure's likelihood.

## 2026-09-10
- Date: 2026-09-10
- Context: Three surfaces carried byte-similar twenty-line copies of one packaging call. All three read `result.error.message` and dropped `result.error.code` — the field that says whether trying again could work. The contract had carried `code` on every `SeamError` the whole time.
- Lesson: **A contract field that every call site discards is invisible in exactly the way a missing field is.** Nothing failed, nothing warned, and three separate authors each independently wrote the same lossy line, because `.message` is the field that reads like the answer. The distinction the app most needed — "this browser never will" versus "that missed, try again" — was already being returned and thrown away at each of the three doors.
- Action: When a seam returns a structured error, grep for `.error.message` and check whether `.error.code` is read anywhere at all. A code with zero readers is a design decision nobody made.

## 2026-09-09
- Date: 2026-09-09
- Context: A run fixed the raw-error-string defect for every AI call in the app, wrote a classifier and a notice component for it, and left storage doing the identical thing at twelve call sites — four of them writing a caught exception's own message. The AI module's own header even lists the five call sites it replaced, and none of the storage ones is among them. The follow-up sat unwritten for two runs while a carried-forward list described it as "a defensible next pick".
- Lesson: **A fix that establishes a rule does not apply it.** The module, the component and the invariant all existed and were good; what was missing was the sweep for every other place the rule holds. The AI sweep found its five sites by looking for *AI calls*, which is the wrong search — the defect was "a raw string reaches a reader", and searching for that instead would have found all seventeen at once.
- Action: When a change abolishes a pattern, grep for the *pattern* rather than for the feature that motivated it. `error.message` and `result.error.message` written into any field a component renders is a two-command search, and it is the search that says whether the job is finished.

## 2026-09-09
- Date: 2026-09-09
- Context: Classifying a seam failure means reading `error.code`. A caught exception can carry a `code` too — Node sets one on system errors, and application code attaches them freely — so a `catch` block feeding the classifier could hand it an `Error` that looks exactly like a seam refusal. The allowlist branch would then match its message and put the exception's own words on screen, which is the single defect the whole module exists to prevent.
- Lesson: **A structural check that recognises "a value with a `code` and a `message`" also recognises an `Error`.** Every `Error` has a `message`, and a `code` is one assignment away. Duck-typing a refusal apart from an exception needs an explicit `instanceof Error` rejection, not just a field test.
- Action: Where a classifier accepts `unknown` and branches on shape, close the exception path first and by name. Write the test that throws an `Error` carrying the very code the allowlist branch is keyed on.

## 2026-09-09
- Date: 2026-09-09
- Context: Five call sites in the app ended with `error instanceof Error ? error.message : '<fallback>'` written into a field a reader sees. Each one was locally reasonable and each carried a considered fallback string. Together they meant that the app's account of its own failures was whichever text an exception happened to carry — `Failed to fetch` when a connection dropped, and a `postJson: HTTP 502 …` line the app builds for itself when a gateway failed.
- Lesson: **The fallback in `e instanceof Error ? e.message : '<fallback>'` is backwards.** The author's own sentence — the thoughtful part — runs only in the rare case where something that is not an `Error` was thrown, and the common case shows a string nobody wrote for a reader. Every one of these five sites had a good sentence in it that almost never ran.
- Action: Treat a caught exception's `message` as diagnostic data, never as display text. Classify the failure into a value, word the sentence from the classification, and carry the original message somewhere a developer looks. Where a codebase has this pattern more than once, expect the sentences to have drifted apart as well.

## 2026-09-09
- Date: 2026-09-09
- Context: `navigator.onLine` was an obvious input for classifying a failed request, and the obvious implementation reads it first. It is wrong: a captive portal and a failed DNS lookup both report the device as online while no request can leave it, so a connection-led classifier tells those readers the service is having trouble and invites them to retry into a wall.
- Lesson: **Classify from the evidence of the event, and let ambient state only sharpen the result.** The exception shape says a request did not complete, which is true regardless of what `onLine` claims. Reading the connection afterwards can upgrade "could not reach the server" to "you are offline", and the worst it can do when it is wrong is leave the sentence one degree less specific.
- Action: When ambient state (`onLine`, a cached flag, a last-known value) is available alongside direct evidence, order the two so that the ambient reading can never *override* the evidence. Test the same event against every value of the ambient state and require all of them to produce a usable answer.

## 2026-09-09
- Date: 2026-09-09
- Context: Adding `$state`/`$derived` to `MeechieTools.svelte` compiled the whole component in runes mode, which broke every `$:` reactive statement already in it. `svelte-check` reported it immediately, but only after the edit had been made in four places.
- Lesson: **A single rune anywhere in a Svelte component switches the entire file's reactivity model.** There is no partial adoption, so introducing one to a legacy-mode component is a whole-file migration whether or not that was the intent.
- Action: Check a component's existing mode before adding a rune to it. Where the change is incidental to the actual work, use the file's own idiom instead — a plain `let` and a `$:` declaration achieve the same thing without converting anything.

## 2026-09-09
- Date: 2026-09-09
- Context: The Quote Vault capped itself at fifty saved pages and had built real machinery around that number — a `VAULT_CAPACITY` constant, a guard in `undoDelete`, a `vaultFullRefusal` sentence, and a test that drove the store past it. A single real captured provider image in `fixtures/image-generation/sample.json` is 236,380 base64 characters, so fifty of them cannot fit in a browser's localStorage. Every one of those guards defended a boundary no reader ever reaches, while the boundary they do reach surfaced as `Failed to write storage for cb_creations_v1.`
- Lesson: **A limit expressed in the wrong unit is worse than no limit, because it attracts the maintenance a real limit would earn.** Nobody had multiplied the cap by the size of the thing being capped. The number was plausible, the code around it was careful and well-reasoned, and the tests that drove it to fifty passed — because they stored a nine-byte stub image rather than a page. A fixture small enough to keep tests fast is also small enough to hide the only question that mattered.
- Action: When a store has a capacity, measure it in the unit the storage actually charges, using the largest real payload in the repository rather than the test fixture. Where the true ceiling is not knowable from here — it depends on the browser and on what is already stored — let the write fail and report the failure honestly, rather than picking a number that looks like knowledge.

## 2026-09-09
- Date: 2026-09-09
- Context: A red proof for "a pin on a full vault must still be allowed" was written by flipping `if (!isReplacement)` to `if (isReplacement || true)`. The mutation ran and every test still passed, so the proof briefly read as "no test covers this."
- Lesson: **A mutation that does not reproduce the defect proves nothing about the tests, only about the mutation.** Forcing the capacity branch to run was not enough: the count was taken from the array with the replaced record already removed, so a replacement on a full vault still measured forty-nine and still passed. The defect needed two edits, not one.
- Action: Read a passing mutation as a suspect mutation first. Before concluding a test is missing, check that the mutated code actually produces the wrong *output* for some input — not merely that a different branch was taken.

## 2026-09-08
- Date: 2026-09-08
- Context: `/describe` shows the reader a read-back of the interpreted spec before charging for a picture. Its first draft rendered `footerItem` last, after the list, with its number. `src/lib/adapters/prompt-assembly-seam/index.ts` uses `footerItem.label` as the **unnumbered second line directly under the headline**, and never reads `footerItem.number` at all.
- Lesson: **A preview is a claim about a consumer, and it can only be checked against that consumer.** `check`, `lint`, 1,789 tests, `build` and the whole `verify` chain passed on a preview that put a line in the wrong place, because none of them reads a promise — and no test written from the preview's own intent could have caught it either, since the intent and the code agreed with each other and both disagreed with the prompt.
- Action: When adding a surface that shows the reader what will happen, read the code that makes it happen, field by field, and write the test against *that* file's line numbers. The same round found a style hint silently dropping the subject the reader asked for, for the same reason: nobody had checked what the downstream consumer could actually carry.

## 2026-09-08
- Date: 2026-09-08
- Context: A reviewer asked `/describe` to call `chatInterpretationAdapter` instead of `postJson`. The same reviewer, in the same round, asked the read-back button to be gated on the reported quota — which needs the `RateLimit-*` headers the adapter discards.
- Lesson: **Two findings in one review can be individually reasonable and jointly unsatisfiable.** Taking each on its own merits would have produced a surface that reads a quota it cannot see. The resolution is not to pick the more senior-sounding one but to say which constraint the pair actually exposes: here, that the seam's contract has no place for a timeout or a response header, so "use the adapter" means "change the contract" — a different decision with a different approval bar.
- Action: Before implementing a review finding, check it against the other findings in the same round. When two conflict, answer both on the thread with the conflict named, rather than silently satisfying one.

## 2026-09-08
- Date: 2026-09-08
- Context: `DescribePageState.interpretedFrom` exists to pin a read-back to the words that produced it, because the message box stays editable while the request is in flight. Its first implementation assigned `this.message.trim()` *after* the await.
- Lesson: **A value is only pinned if it is read at the moment it is pinned.** The field, its name, its doc comment and its invariant all said "pinned"; the assignment read a live field seconds later, so a reader who typed during the request got a read-back captioned with words that were never sent — the exact drift the field was added to stop. Every test written from those comments passed, because they tested the intent rather than the timing.
- Action: Capture into a local `const` before the first await, and never read the live field again in that method. To catch it, a test has to hold the request open and change the input in between — asserting the happy path cannot distinguish "pinned at send" from "read on arrival".

## 2026-09-08
- Date: 2026-09-08
- Context: Three consecutive runs recorded `ChatInterpretationSeam` as "zero consumers" and carried it forward as a deletion candidate. It is a complete, tested, quota-metered feature — contract, mock, fixtures, probe, pipeline, live endpoint, browser adapter — with no user interface.
- Lesson: **"No consumers" is a measurement, not a verdict.** The same number reads as dead weight or as an undelivered feature depending entirely on whether the thing behind it is worth reaching, and nothing in the measurement itself answers that. Carrying the measurement forward three times without ever asking the second question is how a finished feature stays invisible for the life of an app.
- Action: When an inventory finds something unreferenced, record what it *does* alongside the count. Here the answer was that it is the only path by which this app can be told what to put on a page, which made a front door obviously worth more than a deletion.

## 2026-09-08
- Date: 2026-09-08
- Context: `/describe` needed the whole spec-to-finished-page lifecycle that `VerdictPageState` owns — generation, decoding, packaging, the export row, the drift report, the vault write — about 300 lines of it.
- Lesson: **The cheapest way to tell a refactor from a rewrite is to forbid yourself from touching its tests.** `tests/unit/verdict-page-state.test.ts` is 1,132 lines covering guards that are invisible from outside the class. Extracting the shared half and requiring all 50 of them to pass *unmodified* made the question mechanical: a test that needed editing to go green would have been the evidence that behaviour had moved, not a licence to edit it.
- Action: State "these tests must pass unmodified" in the plan before starting an extraction, and treat any edit to them as a finding rather than a fix.

## 2026-09-08
- Date: 2026-09-08
- Context: `aiActionsLeft` divided the bucket's remaining units by `STUDIO_TEXT_QUOTA_COST` (2). A read-back on `/describe` costs 1, from the same bucket.
- Lesson: **A shared reading needs the reader's own arithmetic.** Reusing the studio's constant on the new surface would have told a reader holding five units that they had two read-backs when they have five — the same class of defect as the invented counter the quota feature replaced, arrived at by reuse rather than by invention.
- Action: Where one resource funds actions of different prices, the price and the name of the action are the caller's facts, not the module's. Both are now parameters with the old value as the default, so two surfaces can honestly report different numbers from one reading and a reader can tell which is which.

## 2026-09-08
- Date: 2026-09-08
- Context: Run 16 rebuilt the packaged print download. Its first red proof set `PRINT_SAFE_MARGIN_MM` to 0 and only 4 of 27 tests failed.
- Lesson: **A test that asserts an invariant against the constant that produces it is self-referential and proves nothing.** Fourteen margin assertions compared the placement to `PRINT_SAFE_MARGIN_PT`; zeroing that constant moved both sides of every comparison at once, so a layout that bleeds to the edge of the paper passed its own margin tests.
- Action: Measure an invariant against a floor that is stated independently and owned by nothing under test — here `HARDWARE_CLEARANCE_PT` (0.25in, the printer's physical unprintable border). The same edit then fails 20 of 27. Run 15 recorded the general form of this and it still had to be rediscovered; when writing a red proof, check *how many* tests fail, not just that some do.

## 2026-09-08
- Date: 2026-09-08
- Context: The packaging adapter needed the image's intrinsic size to lay it out, so canvas creation moved inside `image.onload`.
- Lesson: **Moving a guard behind an event moves it behind an event that may never fire.** `Image` never fires `load` in jsdom, so an early `getContext` check that used to return `CANVAS_UNAVAILABLE` immediately became unreachable, and 20 existing tests hung to a five-second timeout each instead of failing fast.
- Action: Take the failable resource up front and only *resize* it once the event arrives. A guard's value is in running on the paths where the thing it guards is missing, which are exactly the paths where the happy-path event does not arrive.

## 2026-09-08
- Date: 2026-09-08
- Context: `src/routes/+layout.svelte` carried the comment "The packaged PDF bleeds its image to all four edges; this does not" — written by Run 13, beside the fix for the *other* print path.
- Lesson: A defect that has been written down in a comment is not a defect that has been reported. It sat in the source for three runs, in the file most relevant to it, and no run picked it up because a comment is not a test, an issue, or a log entry.
- Action: When a change notices a defect it is deliberately not fixing, put it in the log's "carried forward" list as well as in the comment. Run 15 did exactly that for this one, which is how Run 16 found it.

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

## 2026-09-06
- Date: 2026-09-06
- Context: Rebuilding the installable app's offline layer (`WORST_TO_BEST_LOG.md` Run 10).
- Lesson: `grep … | head -20` that returns exactly twenty lines looks identical to a grep that
  returned everything. I read a truncated list of `<title>` tags as the complete set, concluded the
  home page had none, and wrote a comment and nearly a log entry around the conclusion.
  `src/routes/+page.svelte:37` had had one all along.
- Action: When a search's result is going to become a claim about what does *not* exist, re-run it
  with no `head`. A truncated list can only ever support "at least these"; absence needs the whole
  output.

## 2026-09-06
- Date: 2026-09-06
- Context: Same run — choosing between adding a `CacheSeam` operation and prerendering the routes.
- Lesson: "The seam is missing an operation" was the wrong diagnosis for "the cache holds no HTML".
  The cache held no HTML because nothing was prerendered, and nothing was prerendered for no reason
  — not one route's `load` depended on the request. The textbook fix (`putResponse`, runtime
  caching) would have been a contract change that bought *less*: a page cached on first visit is
  still missing on the first offline launch.
- Action: Before widening a contract to make a consumer's job possible, check whether the consumer
  is being handed the wrong input. The seam's shape was fine; the build's output was not.

## 2026-09-06
- Date: 2026-09-06
- Context: Same run — the manifest's `background_color`, `theme_color` and the app's `--dark-base`.
- Lesson: Three files stated the same colour and all three disagreed, for as long as the app has
  existed, because the agreement was a convention and conventions are not checked. Writing "must
  equal" in a comment would have been a fourth copy of the same unchecked truth.
- Action: When two files have to agree, read both in a test and compare them. See
  `tests/unit/install-metadata.test.ts`, which parses the value out of `+layout.svelte` rather than
  restating it.

## 2026-09-06
- Date: 2026-09-06
- Context: Run 10 review — prerendering moved every document off the SvelteKit function, and
  `src/hooks.server.ts` stopped attaching five security headers to them.
- Lesson: The file that broke had a header comment saying exactly what would break it — "`vercel.json`
  carries the headers for those paths; the two must be changed together" — and I never opened it,
  because the change did not touch it. A change to *how* something is served invalidates every
  assumption held by whatever used to serve it, and those assumptions live in files the diff will
  never mention.
- Action: When a change alters the serving layer (prerendering, redirects, a rewrite, a CDN rule),
  read the hooks, middleware and platform config *first* and ask what each one stops seeing. Then
  write the relationship down as a test — `tests/unit/security-headers.test.ts` derives the covered
  paths from the routes' own `prerender` flags, so the next person cannot make this mistake quietly.

## 2026-09-06
- Date: 2026-09-06
- Context: Same run — a four-month-old probe file reading "automated Node.js probing is not possible".
- Lesson: That sentence was true and had been read as "not automatable", which is a different claim.
  The Web Cache API does not exist in Node; it exists in the browser this repository was already
  driving for another probe. The gap cost the seam its only reality check: step 5 of the manual
  procedure was "go offline and reload", nobody had run it, and it would have failed.
- Action: When a probe says a thing cannot be automated, check whether it says *where*. And when a
  probe finally does run, expect it to find things: this one found three defects that 42 unit tests
  and 46 end-to-end tests had all passed over, because none of them runs a service worker.

## 2026-09-06
- Date: 2026-09-06
- Context: Same run — the probe's first version waited for `registration.active.state === 'activated'`
  and read an empty cache; `+layout.svelte` used `navigator.serviceWorker.ready` and would have
  promised an offline copy that did not exist.
- Lesson: The same mistake twice in one change, in the harness and in the product: waiting on a
  signal that stands *near* the fact instead of on the fact. A registration's state is not the
  contents of a cache, and neither is a promise that resolved.
- Action: Wait on the thing you are about to assert. Both are now `caches.match('/offline')` — the
  question the code actually needs answered.

## 2026-09-06
- Date: 2026-09-06
- Context: Same run — `page.waitForFunction(async () => …)` in a Playwright probe.
- Lesson: A polling predicate that returns a Promise is truthy on its first evaluation, so the check
  passed instantly and read the store mid-`addAll`. `page.evaluate` awaits what it is given;
  `waitForFunction`'s polling does not.
- Action: Poll async conditions from Node around `page.evaluate`, never as an async predicate inside
  `waitForFunction`.

## 2026-09-06
- Date: 2026-09-06
- Context: Run 10 — SonarCloud failed the quality gate with "B Security Rating on New Code" and no
  readable detail, because `sonarcloud.io` is blocked from this container.
- Lesson: I reasoned about which of my own new lines most resembled a vulnerability, picked the
  redirect built from the request URL, and was wrong. The real finding was
  `spawn('npm', …)` in a probe — "OS commands should not rely on PATH resolution" — and it had
  already been delivered to this session as a review comment naming the file and the line. The
  claim "I cannot read the tool's output" was false: a different surface was carrying it.
- Action: Before ruling out or diagnosing a failure by reasoning, check every channel that might
  already carry the answer — code-scanning alerts and relayed review comments as well as the check
  run's own summary. "Which of these looks riskiest" is not a criterion that can be right.

## 2026-09-06
- Date: 2026-09-06
- Context: Same finding — the probe spawned `npm run preview`.
- Lesson: Resolving a command by name means the probe's result depends on the environment's PATH,
  and the npm wrapper process is also what made the dev server outlive its own kill signal and hold
  the port into the next run. One cause, two symptoms; I had fixed only the symptom I could see.
- Action: Spawn `process.execPath` with an entry point resolved from the installed package. No PATH
  lookup, no wrapper process, and the cleanup problem disappears with it.

## 2026-09-06
- Date: 2026-09-06
- Context: Run 10 — SonarCloud flagged `sonarjs/super-linear-regex` on `pathname.replace(/\/+$/, '')`
  in `cacheKeyFor`, which runs in the service worker on every navigation.
- Lesson: A trailing-slash trim looked like the most boring line in the change and was a denial of
  service. Measured: 3,108 ms against a path of 50,000 slashes, versus 0 ms for a linear scan — three
  seconds of the visitor's CPU for anyone who follows such a link.
- Action: No regex on a path, a URL, or anything else a request supplies, when a scan will do. And
  when a checker names a regex, measure it before deciding it is theoretical.

## 2026-09-06
- Date: 2026-09-06
- Context: Same run — the local `eslint-plugin-sonarjs` reproduction was configured `files: ['**/*.ts']`.
- Lesson: The probe is a `.mjs` file, so four rounds of "reproduced locally, clean" had never looked
  at it once. Both findings in this round were in files that glob excluded. A reproduction that
  silently covers less than the checker it stands in for reports clean for the wrong reason.
- Action: When reproducing a checker locally, confirm the file set matches too, not just the rules —
  print what it analysed if there is any doubt.

## 2026-09-06
- Date: 2026-09-06
- Context: Run 10 — I reasoned my way to a stale-banner bug after `clients.claim()`, wrote two fixes
  and a probe check for it.
- Lesson: The mutation check said both fixes were unreachable — `register().then(…)` already resolves
  after the claim, so the first measurement was correct all along. Worse, my *first* mutation was
  faulty: it removed the initial call but left the re-measure in the `offline` handler, so it passed
  for a reason I had not intended and nearly confirmed a fix that fixed nothing.
- Action: A mutation test that passes has told you nothing until you have checked it removed what
  you meant it to. And when a defect is found by reasoning rather than by a tool, treat it as a
  hypothesis until something fails without the fix.

## 2026-09-06
- Date: 2026-09-06
- Context: Run 10 — a browser-probe check for the trailing-slash redirect passed with the redirect
  removed.
- Lesson: The check navigated from an already-hydrated SvelteKit page, so the client router resolved
  the URL and the service worker never saw the request. The check was measuring the framework, not
  the code under test — and it had been written specifically to test that code. Given a cold
  context, the same mutation fails with `landed /meechie/, 19 assets at the wrong depth`.
- Action: A check on service-worker behaviour needs a cold navigation in its own context. More
  generally: when a mutation does not fail a check, do not conclude the code is unnecessary until
  you have confirmed the check can observe it at all.

## 2026-09-06
- Date: 2026-09-06
- Context: Run 10 — `safeReturnPath`, written to stop the offline page's retry button leaving the
  origin, accepted `/\t/evil.example`.
- Lesson: URL parsers strip tab, newline and carriage return *before* parsing, so a string that
  begins with one slash to a `startsWith('/')` check begins with two to the browser. Every
  string-prefix check on a URL is a claim about a parser, made without asking it.
- Action: Validate a URL by asking the platform (`new URL(raw, origin).origin === origin`) or, where
  the function must stay pure, reject every character below 0x21 rather than enumerating the
  dangerous ones — and assert the precondition in the test against the real parser, so the test
  cannot be more optimistic than the guard.

## 2026-09-06
- Date: 2026-09-06
- Context: Run 11 — `qualityState` and `revisionNote` are required of the provider on every studio
  text call under a `strict: true` JSON schema, and had no consumer anywhere in the application.
  Both were validated by the contract, stored in the vault, and rendered nowhere.
- Lesson: A field can be *required*, *validated*, *paid for* and *dead* at the same time, and none
  of the repository's gates notice. `chamber-lock`, the contract tests and the seam ledger all check
  that a field is declared and parsed correctly; not one of them asks whether anything reads it.
  The tell was mechanical and cheap: `grep -rn needs_more_evidence src tests fixtures` returned five
  lines, every one of them the prompt asking for the value or the schema accepting it.
- Action: When judging whether a feature delivers what it promises, enumerate the fields its
  contract returns and grep each one for a consumer. A field the provider is *required* to send and
  nothing reads is a promise the app is billing for and not keeping.

## 2026-09-06
- Date: 2026-09-06
- Context: Run 11 — a required contract field always holds a value, so `buildStudioTextFromSpec` has
  to invent `qualityState: 'ready'` to rebuild a legacy record's words. The moment that field
  reached the screen, the invention became an on-screen claim of approval.
- Lesson: This is the third run to arrive at the same shape — Run 9's `promptWasSent`, Run 10's
  `driftChecked`, and now `standingWasReported`. **Whether something was reported is a different
  fact from what it said, and a required field cannot carry both.** Making a field required does not
  make its value true; it only guarantees that something wrote one.
- Action: Before rendering a required field for the first time, find every producer and ask which of
  them knows the value rather than supplying one. Where a producer has to invent it, carry the
  provenance beside the value as its own input, and stop the invented value being written back to
  storage — otherwise the next read cannot tell an invention from a report.

## 2026-09-06
- Date: 2026-09-06
- Context: Run 11 — the provenance flag was first added as a second public field beside a public,
  writable `textOutput`. Sixteen test sites assigned `textOutput` directly, which would have left
  every one of them silently on the "nothing reported" path.
- Lesson: A pair of fields that must agree is a comment asking to be obeyed. Two of the tests it
  would have quietly weakened were tests of *other* guards, which would have kept passing for a
  reason nobody intended.
- Action: When one fact needs two fields, make the second unreachable without the first — a getter
  and a single named writer, so the wrong combination is a type error rather than a convention. The
  cost here was one `sed` over sixteen arrangements; the alternative was a rule enforced by hope.

## 2026-09-06
- Date: 2026-09-06
- Context: Run 11, PR #313 — the provenance flag carrying "was this standing reported?" was a
  boolean, keyed on whether the record stored studio text. Codex pointed out that a page saved from
  the *toolkit* stores studio text whose `qualityState` `buildToolStudioText` had to invent, so every
  such page would have reopened claiming an approval Meechie never gave.
- Lesson: The flag was answering two questions — *may this be claimed?* and *should this be written
  back?* — and a boolean can only answer one. It looked correct because both answers coincided in
  every case I had considered, and every case I had considered came from the one producer I was
  looking at. The field had two others.
- Action: When a provenance flag governs more than one decision, enumerate the decisions and the
  producers separately, and check every producer against every decision. Where the answers differ,
  the flag is not a boolean. And prefer refusing to believe a whole class — "no restored standing is
  trusted" — over detecting the one bad producer: the detection goes stale when a fourth producer
  appears, the refusal does not.

## 2026-09-06
- Date: 2026-09-06
- Context: Run 11, PR #313 — `rating` on the studio seam means severity (1-10, "don't undersell
  it"); `rating` on the tool seam means an excuse's credibility (1 = insulting, 10 = barely
  credible). `buildToolStudioText` had copied one into the other since it was written.
- Lesson: The mismatch was silent for as long as nothing said what the number meant. The moment this
  change rendered "Severity 2 of 10 — Meechie's read on how bad the situation is", an old bug became
  a sentence on screen. Two fields sharing a name and a range is not evidence they share a meaning.
- Action: A label does not create a semantic mismatch, it exposes one — which is an argument for
  labelling values rather than printing them bare, and an obligation to fix whatever the label
  turns up. Before rendering a number with its meaning attached, find every producer that writes
  that field and check each one's definition of it, not just the field's name.

## 2026-09-06
- Date: 2026-09-06
- Context: The home page's mode strip showed 3 of 8 modes and linked only those 3.
- Lesson: A feature can be invisibly broken because the app never shows you what is missing. The strip did not look wrong — it looked like a tidy three-card row — so no amount of using the app would surface that five features had no link anywhere in it. What surfaced it was counting the catalogue (`studioModes.length === 8`) against what the front door rendered (3).
- Action: When auditing a surface that renders a subset of a collection, compare the rendered count to the collection's length before looking at anything else. `/offline` and `/+error.svelte` already listed all eight through `modeCatalog()`; the error pages were a better feature directory than the home page.

## 2026-09-06
- Date: 2026-09-06
- Context: `prerender = true` on `/`, with `getWeeklyModes()` read from the host clock in a `StudioState` field initializer.
- Lesson: "Nothing in this `load` depends on the request" is not the same as "nothing in this page depends on when it is rendered". `+page.ts` carried that justification in a comment while the component tree beneath it read the clock at construction — so the prerendered document, which the service worker caches and replays offline for days, was dated to the build.
- Action: On a prerendered route, treat any clock or locale read reachable from the component tree as a build-time constant. Render the parts that cannot be known server-side only once `isBrowser` is true, and keep the complete, dateless content in the server HTML so a crawler, a no-JavaScript reader and a cached offline copy all still get it.

## 2026-09-06
- Date: 2026-09-06
- Context: The only test naming the mode rotation called `getWeeklyModes()` to compute its own expectation.
- Lesson: A test that derives its expectation from the function under test cannot fail. It is worse than no test, because it reports coverage. The same file's offline check ran `for (const mode of getWeeklyModes())` under the comment "Every mode is reachable from here" — iterating three while claiming eight, so the five modes with no home-page link were also the five nothing checked.
- Action: Assert against a written-down constant or an explicit `Date.UTC(...)` instant, never against a second call to the code being tested. When a comment says "every", make the loop iterate the collection the word refers to.

## 2026-09-06
- Date: 2026-09-06
- Context: `Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))` used as a week number.
- Lesson: Epoch-anchored week arithmetic rolls over on **Thursday**, because 1970-01-01 was one. Nothing in the code said so, and the surface it drove said nothing about a boundary at all.
- Action: Anchor week arithmetic on a named weekday (`FIRST_MONDAY_EPOCH_DAY = 4`) and put the boundary on screen where the reader can see whether it matches what they observe.

## 2026-09-06
- Date: 2026-09-06
- Context: `StudioState.init()` re-read `appOrigin` from the injected seam but not `nowMs` from the injected clock.
- Lesson: Field initializers run before a test can inject anything, so a `$state` seeded from a seam captures the *default* adapter. Every existing clock test survived it only because they all advance the clock explicitly before asserting; anything whose value is a function of the instant at render would have been reading the host clock.
- Action: When `init()` re-reads one injected seam because the field initializer could not, re-read all of them. A partial re-read is a trap that fires on the next feature.

## 2026-09-06
- Date: 2026-09-06
- Context: Found during Run 12 and deliberately not fixed — `handleModeSelect` calls `scheduleDraftSave()`, but `DraftRecordSchema` has no mode field.
- Lesson: The reader's chosen mode is not persisted. Pick a mode, type evidence, refresh: the evidence returns under a different question, wired to a different `toolId`. The save call implies otherwise, which is why it took a schema read to notice.
- Action: Left for a run that can hold a pull request open — `AGENTS.md` forbids auto-merging a change that carries a schema or contract change, and a scheduled run has no human to wait for. Do not half-fix it by persisting the mode outside the store seam.

## 2026-09-07
- Date: 2026-09-07
- Context: The app told the reader to "Print it. Color it." on four surfaces and had no print support at all — no control, and no `@media print` rule anywhere in the repository.
- Lesson: A feature can be entirely absent and still read as present in a review of the code, because the *instructions for using it* are everywhere. Grep for what the app promises, not only for what it does. `grep -rn "media print\|window.print" src/ static/` returning nothing, next to four surfaces saying "Print it", was the whole finding.
- Action: When a run looks for the worst feature, search the app's own copy for verbs it tells the reader to perform, then check each one has an implementation.

## 2026-09-07
- Date: 2026-09-07
- Context: Deciding what a browser prints, using `:has()` to hide everything not on the path to a marked element.
- Lesson: Print CSS cannot be reasoned about from the source; it has to be run. Two rules that read correctly were wrong in ways only a rendered PDF showed — `break-after: page` added a trailing blank sheet, and `.studio .generated-image` (two classes) silently outranked the single-attribute image rule and stretched the picture. Both were found by `page.pdf()` and a screenshot, in minutes.
- Action: Prototype print rules against the running app and capture a real PDF before writing them into the repository; assert page counts off the PDF in e2e, not off the DOM.

## 2026-09-07
- Date: 2026-09-07
- Context: Measuring what is visible in print media from `page.evaluate`.
- Lesson: `getComputedStyle(el).display !== 'none'` counts every descendant of a hidden ancestor as visible, because an element inside a `display: none` parent reports its own display. A first probe using it reported the navigation still printing when it was not.
- Action: Measure visibility from `getBoundingClientRect()` width and height, which is what the first version of `tests/e2e/print.spec.ts` was corrected to do.

## 2026-09-07
- Date: 2026-09-07
- Context: Run 6 rebuilt the home studio's export row and put every decision behind it in a pure, tested module. Twelve runs later that module had exactly one consumer, and the twelve other page-making surfaces still rendered the raw-filename row it replaced.
- Lesson: Extracting the *logic* does not spread a fix; extracting the *component* does. The rules that made the good row good were `:global(.studio .export-*)` in `+page.svelte`, so any surface that copied the markup rendered it unstyled and its author rewrote it into something plainer instead. A shared behaviour whose styling is owned by one host is not shared — it is a copy waiting to happen, and it happened twelve times.
- Action: When a run rebuilds a surface that exists on more than one route, ship the component and its own styling together, and check the other hosts in the same change. `grep -rn "class=\"[^\"]*<the-class>" src/` before finishing: a class name used in one file and styled `:global` in another is the signature.

## 2026-09-07
- Date: 2026-09-07
- Context: Reproducing the SonarCloud gate locally, per the method Runs 8, 12 and 13 recorded.
- Lesson: That method could only ever see `.ts` files. The throwaway config gave `eslint-plugin-svelte` no TypeScript sub-parser, so every component came back as `Parsing error: Unexpected token {` — which reads like a config problem to skip past, not like coverage silently missing. Adding `languageOptions.parserOptions.parser` surfaced four real findings in new component code that three runs of this reproduction would have missed.
- Action: `...svelte.configs['flat/recommended']` followed by `{ files: ['**/*.svelte'], languageOptions: { parserOptions: { parser: tsParser } }, plugins: { sonarjs }, rules: sonarjs.configs.recommended.rules }`. Treat a parsing error in a checker reproduction as a failed check, never as a skipped file.

## 2026-09-07
- Date: 2026-09-07
- Context: Adding a Web Share API call, and needing the button's label to be true before it is pressed.
- Lesson: Two constraints pull against each other. `navigator.share` needs transient user activation, so nothing may be awaited between the click and the call — which forces the file bytes to be prepared synchronously. And every page route here is prerendered, so a capability measured at build time would be the build machine's and would be replayed to every reader by the service worker. What resolves both: prepare bytes from the `data:` URLs already in memory (no await needed), and report "no page" *before* "no capability", so the prerendered document — which can never contain a finished page — says the same sentence as the hydrated one.
- Action: For any browser-capability-dependent control on a prerendered route, find the state that makes the capability irrelevant and answer with that first. Assert it: `describeShareJob` returns the same `blockedReason` for all three capabilities when there is no page.

## 2026-09-07
- Date: 2026-09-07
- Context: The red proof required by the workflow, run on two guards in `src/lib/core/vault-page.ts` at once.
- Lesson: **A red proof that fails fewer tests than it removed guards has found a test that pins nothing** — the proof is a check on the tests, not a formality on the code. Removing the NaN-date guard failed nothing, because the test asserted only the `newest` order of a four-row list, and on that list a `NaN` comparator happens to return exactly the guarded result. Measured with the guard out: `oldest` on four rows returned `a,c,b,bad` where the epoch puts `bad` first, and on thirteen rows the corrupt row landed in the *middle* of the list — which is the real damage, since `NaN` from a comparator makes the whole sort's result implementation-defined rather than just misplacing one row.
- Action: Remove every guard in the same proof rather than one at a time, and count the failures against the guards. When one comes back green, do not adjust the guard — find the input that discriminates, print both orderings, and assert the one that changes. Say in the test comment which assertion is load-bearing and why the other is there.

## 2026-09-07
- Date: 2026-09-07
- Context: Probing what the Quote Vault shows, by seeding `cb_creations_v1` in a real browser before visiting each route.
- Lesson: The first probe reported zero saved pages on *every* surface, including the one that works — which looked like a far larger finding than the real one. The seeded records used `pageSize: 'us_letter'` and `border: 'thin'`; the schema's enums are `US_Letter` and `none|plain|decorative`, so `parseCreationRecord` rejected all seven and the vault correctly rendered its empty state. A storage probe whose seed does not parse measures the empty state and reads as a defect in the feature.
- Action: Seed storage probes from the repository's own fixtures (`fixtures/creation-store/sample.json` here), varying only the fields the probe is about. Before believing a probe that reports "nothing anywhere", check it against the one surface already known to work — a probe that finds the working case broken is measuring itself.

## 2026-09-09
- Date: 2026-09-09
- Context: Deciding which of a studio's three live failures System Trace should explain, by keeping the most recently classified one and comparing it back against the three fields with `===`.
- Lesson: **`===` between two `$state`-held references to the same object is always false.** Svelte deep-proxies whatever is assigned to a `$state` field, so two fields holding one object hand back two different proxies of it. The identity guard silently matched nothing and the panel showed no diagnostic at all — and Svelte said so explicitly, as `state_proxy_equality_mismatch` on stderr, which a test run prints above the failure rather than as it. Property *reads* through a proxy are unaffected, which is what makes a stamp written onto the value work where identity does not.
- Action: Never key logic on object identity across `$state` fields. Carry a comparable value — a stamp, an id, a version — on the object itself, and read it back as a property. Treat `state_proxy_equality_mismatch` in test stderr as a failing assertion about the design, not as noise: it names the exact line that cannot work.

## 2026-09-09
- Date: 2026-09-09
- Context: Auditing whether a shared module was actually reaching every surface it was written for, by counting call sites rather than reading the module.
- Lesson: A shared abstraction can ship complete, tested and documented and still miss a caller, and neither the tests nor the types will say so — the unwired surface keeps compiling and keeps passing its own old tests. Here `grep -c postJson` returned eight call sites and `grep -c classifyGenerationFailure` returned seven, and the missing one had a purpose-built subject constant (`TRY_ON_SUBJECT`) and eight route-code mappings sitting in the classifier with **zero references anywhere in `src/` or `tests/`**. An exported constant with no callers is the cheapest possible signal that a rebuild stopped one surface short.
- Action: After extracting a shared module, count its call sites against the count of the thing it replaced, and grep every symbol it exports for references outside its own file and test. A zero means an unfinished migration, not a spare part. Record the count in the pull request so the next reader can re-measure it in one command.

## 2026-09-09
- Date: 2026-09-09
- Context: Running the Playwright suite three times in one session while an earlier run was still holding the preview server.
- Lesson: Concurrent Playwright runs against this repo's `webServer` config report **different totals for the same suite** — 79, then 57 — without failing, so a green summary line can describe a partial run. Combined with the already-recorded fact that a `| tail`ed pipeline reports `tail`'s exit code, two independent ways for a run to look green while proving less than it claims can stack in one command.
- Action: Run the end-to-end suite once, alone, with nothing else in the background; write the full output to a file rather than piping to `tail`; and **check the test count against the previous run's** before believing the word "passed". A count that dropped is a failed run whatever the summary says.
