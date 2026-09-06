<!--
Purpose: Decision log for architecture and process choices.
Why: Preserve rationale and prevent re-litigation.
Info flow: Decision -> consequences -> future changes.
-->
# Decisions

Short, durable decisions with context and tradeoffs.

## 2026-09-06 - Carry a failed drift check as an explicit `driftCheckFailure` field on the generate contract

- Date: 2026-09-06
- Decision: Add an optional `driftCheckFailure: { code, message }` to `GenerateResponseValueSchema` in `contracts/generate.contract.ts`. `runGeneratePipeline` populates it from `detectDrift`'s error when the seam returns `{ ok: false }`, leaving `violations` and `recommendedFixes` empty — not because nothing is wrong, but because the seam stopped at the first defect and graded nothing after it. `GenerateResponseValueSchema` is a `.refine()` that rejects a present failure alongside a non-empty `violations` or `recommendedFixes`, so the two cannot both be asserted. `src/lib/core/quality-report.ts` reads the field and renders the failure **as a `blocker` finding**, alongside `hasIncompleteCheck` on the report so the surrounding wording can say the rest of the prompt was never compared. No seam contract, probe, fixture, mock or adapter changes.
- Context: This supersedes the reserved-code decision recorded immediately below, which shipped first and was corrected under review. The behaviour is identical; the representation is not.
- Corrected under review (`f870c3a`, and this entry in the commit that follows it): the first version of this decision shipped a third weight, `check-failed`, described as "neither a blocker nor a note, because an incomplete check says nothing about the page in either direction". That reasoning does not survive contact with the only producer. The seam returns `{ ok: false }` for exactly one cause — `MISSING_REQUIRED_SECTION`, a *named heading it looked for and did not find* — which is a defect it identified, not a check that could not run. So the weight is `blocker` and `check-failed` no longer exists in the codebase. The entry went on describing the removed weight for two commits after the code stopped having it, which is the same defect this whole change is about: a record outliving the thing it describes. Codex caught it on PR #309, correctly noting that a stale entry in a source-of-truth document steers future maintenance back toward the classification the change removed.
- Alternatives: (a) The reserved violation code `DRIFT_CHECK_FAILED`, shipped in `b2831a6` — rejected on review. A Codex P1 made the argument the original entry had waved through: the pipeline was minting a *new public semantic* on `/api/generate` while leaving the contract silent about it, so a consumer reading `violations` receives what looks like an ordinary page violation and only this app's UI knows the code means "check incomplete". That the schema *accepted* the value was never the question — `ViolationSchema` accepts any non-empty string, which is exactly why it could not carry the distinction. (b) Add `checkCompleted: boolean` plus a separate message field — rejected: two fields that must agree is a second copy of one truth, and an optional object that is present-or-absent cannot disagree with itself. (c) Change `DriftDetectionOutputSchema` so the seam reports a missing required section as a violation instead of an error — the deepest fix, and genuinely tempting, but it changes the seam's grading contract and belongs in its own change with a probe.
- Consequences: The distinction between "graded, nothing wrong" and "stopped at a defect it named" now lives in the contract every consumer reads, not in a magic string. The reader is told the check found something wrong (a blocker) *and* that it did not finish (`hasIncompleteCheck`) — two facts the previous single `check-failed` weight collapsed into one hedge that asserted neither. The field is optional, so its *absence* is the signal that an empty `violations` is a real verdict — pinned by a test asserting the key is absent rather than `undefined`-valued. `/api/generate` is a route, not a seam: it appears in no row of `docs/seams.md` and has no probe, fixtures, mock, contract test or adapter, so the workflow steps that exist for it are contract, consumers, tests, and this entry.
- Self-critique: The riskiest assumption is that no consumer breaks on a new optional response field. Checked rather than asserted: the three consumers of `GenerateResultSchema` are `studio-state.svelte.ts`, `verdict-page-state.svelte.ts` and `MeechieTools.svelte`, all in this repo, all updated here; zod object parsing ignores unknown keys by default, so even an un-updated consumer parses unchanged. The second assumption — that the field is worth a contract change at all — is the one review settled against my original judgement, and the record should say so plainly: I documented the reserved code as "a compromise, not the right shape" and shipped it anyway. Writing down that something is the wrong shape is not the same as declining to build it.
- Revisit criteria: If the drift seam is ever changed to report a missing required section as a violation rather than an error, this field loses its only producer and should be removed with it.
- Evidence: docs/evidence/2026-09-06/verify-outer.txt (chain exit=0); docs/evidence/2026-09-06/test.txt; docs/evidence/2026-09-06/lint.txt; docs/evidence/2026-09-06/build.txt; docs/evidence/2026-09-06/e2e.txt; docs/evidence/2026-09-06/rewind-DriftDetectionSeam-self-contained.txt; tests/unit/quality-report.test.ts; tests/unit/pipeline-edge-cases.test.ts

- Cipher Gate:
  - Date: 2026-09-06
  - Seams: DriftDetectionSeam (self-contained), SpecValidationSeam (self-contained) — both read, neither modified
  - Evidence: plan.md; contracts/generate.contract.ts; src/lib/core/quality-report.ts; src/lib/core/generate-pipeline.ts; tests/unit/quality-report.test.ts; tests/unit/pipeline-edge-cases.test.ts; tests/e2e/smoke.spec.ts; docs/evidence/2026-09-06/verify-outer.txt; docs/evidence/2026-09-06/test.txt; docs/evidence/2026-09-06/e2e.txt; docs/evidence/2026-09-06/rewind-DriftDetectionSeam-self-contained.txt
  - Summary: Added an optional `driftCheckFailure` to the `/api/generate` response contract so a drift check that declined to grade is distinguishable from one that graded and found nothing. Closes a fail-open in which the seam's `{ ok: false }` branch — taken whenever the image provider returns a rewritten prompt, which carries none of the required headings — was reported to all three studio surfaces as a page with nothing wrong with it. No seam artifact modified.
  - Risks: A new optional response field is invisible to any consumer that does not read it, so the failure state is only as visible as the UI that renders it; all three consumers are updated here and route through one transform. The drift seam still reports a missing required section as an error rather than a violation, which is the underlying oddity this field works around rather than removes.

## 2026-09-06 - SUPERSEDED - Report a failed drift check as a violation, in the pipeline, without touching DriftDetectionSeam

**Superseded the same day by the entry above, after a Codex P1 on PR #309.** Kept because the reasoning it contains was applied correctly to a question it had framed too narrowly, and that is worth being able to read back. The error was not in any of its four checks — all four were true — but in the question they answered: it asked whether the change altered a *contracted shape*, and the objection was that it introduced a new *public semantic* the contract did not describe. A schema that accepts a value is not a schema that documents it.

- Date: 2026-09-06
- Decision: In `src/lib/core/generate-pipeline.ts`, map a `detectDrift` result of `{ ok: false }` to a single violation `{ code: 'DRIFT_CHECK_FAILED', message: 'The page could not be checked against what was asked for: <seam message>', severity: 'error' }` instead of to `violations: []`. Define `DRIFT_CHECK_FAILED_CODE` once in `src/lib/core/quality-report.ts` and import it into both the pipeline that writes it and the report that reads it. Do not add a field to `DriftDetectionOutputSchema`, `GenerateResponseSchema`, or any seam artifact.
- Context: The drift seam grades `revisedPrompt` in preference to `promptSent` (`src/lib/adapters/drift-detection-seam/index.ts:92-95`), and `revisedPrompt` is whatever the image provider rewrote the request into — it comes straight off the provider's `revised_prompt` field (`src/lib/adapters/image-generation-seam/index.ts:161`). A provider rewrite is prose and carries none of `PROMPT_REQUIRED_HEADINGS`, so `findMissingHeading` returns non-null and the seam takes its `{ ok: false, code: 'MISSING_REQUIRED_SECTION' }` branch. The pipeline mapped that to an empty violation list, and all three studio surfaces render an empty violation list as "nothing wrong". The net effect: the exact event drift detection exists to catch — a provider silently discarding the page's constraints — produced the feature's most reassuring output. A unit test named "includes empty violations when drift detection fails" had locked this in as intended behavior.
- Alternatives: (a) Add a `checkCompleted: boolean` to `DriftDetectionOutputSchema` and thread it through `GenerateResponseSchema` — rejected for this change, not on principle: it is the cleaner long-term shape, but it is a change to two contracts and therefore the full Seam-Driven Development workflow (contract, probe, fixtures, mock, test, adapter, Cipher Gate), which is a different piece of work from rebuilding the reporting surface. (b) Leave the pipeline alone and have each UI surface treat "empty violations" as suspicious — rejected: it puts the same inference in three components and none of them has the information, since by then the failure has already been erased. (c) Surface the raw seam error in `generationError` — rejected: that field is for "your request failed", and the request succeeded; the page exists and is downloadable, it just could not be graded.
- Consequences: A drift check that cannot complete is now visible to the reader as an unfinished check rather than invisible as a clean page. The report weighs it as `check-failed` — deliberately neither a blocker nor a note, because an incomplete check says nothing about the page in either direction — so it is never counted among "things the page got wrong". No seam contract, probe, fixture, mock, or adapter changed, so no existing consumer's parse changes: `ViolationSchema` already accepts any non-empty `code` and `message`.
- Self-critique / seam-workflow scope: `AGENTS.md` says "if there is any doubt, treat it as a seam change", so the doubt was investigated rather than waved off, following the 2026-09-03 precedent below. Four checks: (1) the diff touches no file under `contracts/`, `probes/`, `fixtures/`, `src/lib/mocks/`, `src/lib/adapters/`, or `src/lib/seams/`; (2) the violation is synthesized inside the pipeline *after* `detectDrift` has already returned, so it crosses no filesystem, network, process, clock, or randomness boundary — `AGENTS.md`'s own definition of touching a seam; (3) `ViolationSchema` pins only `{ code: NonEmptyString, message: NonEmptyString, severity: 'error'|'warning' }`, all of which this satisfies, so no contracted shape changes; (4) no route, component, or seam matched on violation `code` before this change (`grep` across `src/routes` and `src/lib/components`), so nothing downstream breaks on an unfamiliar one. The riskiest assumption is (4) — that introducing a code no seam emits does not collide with a consumer keyed on codes. Disproved by measurement rather than asserted: the only consumers were three components rendering `violation.message`, and all three now route through `buildQualityReport`, which is the single place the code is interpreted.
- Deliberately not done: `confidenceScore` is computed by the drift seam on every generation (`Math.max(0, 1 - violations.length / 10)`), validated by `DriftDetectionOutputSchema`, asserted by `tests/unit/drift-detection-helpers.test.ts`, and then dropped at this pipeline because `GenerateResponseSchema` has no field for it. Surfacing it is a change to `contracts/generate.contract.ts` and so requires the full workflow. Left out of this change rather than half-wired.
- Revisit criteria: If a second caller ever needs to distinguish "the check did not run" from "the check found an error" programmatically rather than for display, promote it from a reserved violation code to a real field on `DriftDetectionOutputSchema` and run the full workflow at that point. This entry does not create a standing exemption for encoding states as reserved codes.
- Evidence: docs/evidence/2026-09-06/verify-outer.txt (chain exit=0); docs/evidence/2026-09-06/test.txt; docs/evidence/2026-09-06/lint.txt; docs/evidence/2026-09-06/build.txt; docs/evidence/2026-09-06/e2e.txt; docs/evidence/2026-09-06/rewind-DriftDetectionSeam-self-contained.txt; docs/evidence/2026-09-06/proof-tape.md; tests/unit/quality-report.test.ts; tests/unit/pipeline-edge-cases.test.ts

## 2026-09-05 - Persist the Page Controls' style selection with the pages it made (CreationStoreSeam)

- Date: 2026-09-05
- Decision: Add an optional `styleSelection` field (`StyleSelectionSchema`: `themeId`, `voice`, `glitter`, optional `wig` name/style) to `CreationRecordSchema` and `DraftRecordSchema` in `CreationStoreSeam`, and make `src/lib/core/page-style.ts` the single encoder of the prompt's `Vibe:` line.
- Context: Of the seven Page Controls on the home studio, only page size and border were persisted, because those two are `ColoringPageSpec` fields. Theme, intensity, rawness, third person and glitter reach a page only through the style hint, which is composed at request time and stored nowhere. A reopened page therefore showed defaults in its controls, and because `applyTextToSpec` recomposes the hint from the live controls on every setting change, touching one control silently restyled the page with the other five.
- Alternatives: (a) Recover the hint by parsing the `Vibe:` line back out of the stored `assembledPrompt` — rejected: it makes restore depend on `PromptAssemblySeam`'s exact template, so a prompt-format change breaks restore silently, and it is the "read a value back out of a proxy" mistake this log records four times. (b) Leave restore alone and only warn — rejected: it accepts the data loss it describes. (c) Reset the controls to defaults when a record has no stored style — implemented first, then rejected when a test caught it destroying settings the reader had just chosen; the controls belong to the reader, not to the record.
- Consequences: Reopening a page or restoring a draft puts back the style that made it. Records written before this field parse unchanged (the field is optional) and are reported to the reader as "this page's style is not on file" rather than being presented as the defaults. Nothing about a live generation changes: `buildStyleHint` reproduces the previous inline template byte for byte, pinned by a literal test.
- Revisit criteria: If a future release removes a theme, `themeForSelection` falls back to the first theme; if theme removal becomes common, store the theme's style hint alongside its id.
- Self-critique: The riskiest assumption is that making the field optional is enough for backward compatibility. Disproved-by-testing rather than asserted: a contract test parses a record with the key deleted, and a mutation making the field required turned ten vault tests red — the adapter validates with these schemas, so a required field would have silently emptied every existing reader's vault on upgrade.
- Evidence: docs/evidence/2026-09-05/verify.txt; docs/evidence/2026-09-05/test.txt; docs/evidence/2026-09-05/chamber-lock.json; docs/evidence/2026-09-05/seam-ledger.json; docs/evidence/2026-09-05/proof-tape.json
- Plan:
  - Goal: Store the style a page was made with, restore it on reopen and on draft refresh, and make the Page Controls panel explain and report itself.
  - Seams: `CreationStoreSeam (self-contained)` — the suffix is the seam's registered name in `docs/seams.md`, not a description of it, and the unsuffixed `CreationStoreSeam` is a different row whose rewind runs four legacy tests that touch none of this. Both this line and the Cipher Gate entry below said the unsuffixed name while the evidence beside them spelled out the distinction. (contract, validators, adapter, mock, fixtures and contract tests — see the file list below, which is the authoritative one). This line originally read "adapter and mock unchanged", on the reasoning that the adapter validates through these schemas and stores JSON, so an added optional field needs no adapter change. That was true of the field and stopped being true of the change: review round seven found the required `validators.ts` present but imported by nothing and the adapter still calling `safeParse` at four sites of its own, and round nine found the mock replaying its fixture for records the adapter refuses. Both were fixed here, and this summary went on contradicting the inventory three lines down — a plan disagreeing with its own file list, in a change about two descriptions of the same thing drifting apart.
  - Files — every path the change touches, with what happens to each. Checkable against the commit with `git diff --name-status <base>..HEAD`; an earlier version of this list omitted four of them and marked none, which made the scope gate uncheckable in the direction that matters (understating it).
    - `[MODIFY] src/lib/seams/creation-store-seam/contract.ts` — add `StyleSelectionSchema` (importing `MeechieStudioVoiceSettingsSchema` rather than restating three enums) and an optional `styleSelection` field on `CreationRecordSchema` and `DraftRecordSchema`; export `StoredStyleSelection`.
    - `[NEW] src/lib/seams/creation-store-seam/validators.ts` — the seam's required validators artifact and its only parse of stored JSON: the contract schemas re-exported, throwing variants, and `parseCreationRecord`/`parseDraftRecord` returning `{ ok, value }` so the adapter's read path can keep what parses and skip the rest without one corrupt record emptying a vault.
    - `[MODIFY] src/lib/adapters/creation-store-seam/index.ts` — route all four parse sites through those validators instead of calling `safeParse`/`parse` on the schemas directly.
    - `[MODIFY] src/lib/seams/creation-store-seam/test.ts` — contract tests for the added field: mock round-trip, and a record with the key deleted.
    - `[MODIFY] fixtures/creation-store/sample.json` — add `styleSelection` to the `saveCreation`/`saveDraft` inputs and to the `saveCreation`/`getCreation`/`listCreations`/`saveDraft`/`getDraft` outputs.
    - `[MODIFY] fixtures/creation-store/fault.json` — add a `rejected` block of payloads the seam must refuse (a voice the text seam does not accept, an empty theme id, a draft whose style is a string), so the mandated red proof has a fixture behind it rather than only the `BROWSER_REQUIRED` outputs.
    - `[MODIFY] src/lib/seams/creation-store-seam/fixtures.ts` — expose that block as `unknown`; typing it as records would make the module throw on import, which is the point.
    - `[MODIFY] src/lib/seams/creation-store-seam/mock.ts` — validate the handed-in record and draft through the seam's validators, so the mock refuses exactly what the adapter refuses and the fault fixture's rejected payloads can be driven through the mock itself.
    - `[MODIFY] src/lib/core/page-exports.ts` — carry the packaged paper on `PageExportAttempt` and drop the page-size parameter from `describePackagedExports`, so a download's label cannot name paper its file was not made on.
    - `[NEW] src/lib/core/page-style.ts` — `StyleSelection`, `PaperSelection`, `DEFAULT_STYLE_SELECTION`, `themeForSelection`, `buildStyleHint` (the sole encoder of the `Vibe:` line), `isSameStyleSelection`, the total label/help `Record`s, and the panel summarizers.
    - `[MODIFY] src/routes/studio-state.svelte.ts` — hold the selection as one value; capture the style and the generated spec with the artifact at both generate paths and on reopen; save the captured pair rather than the live controls, carrying the reader's dedication across by key deletion; add `settingsError`, `settingsIssues`, `styleSelectionUnknown` and `pageGlitter`.
    - `[MODIFY] src/lib/components/studio/StudioSettingsPanel.svelte` — rebuild as a `<details>` with three fieldsets, per-value help, `aria-pressed` theme chips, a summary naming all seven controls, and the two error regions.
    - `[MODIFY] src/lib/components/studio/StudioPreviewPanel.svelte` — document `glitter` as the page's, not the checkbox's.
    - `[MODIFY] src/routes/+page.svelte` — pass `styleSelectionUnknown`, `settingsIssues`, and `pageGlitter` instead of the live `glitter`.
    - `[NEW] tests/unit/page-style.test.ts`, `[NEW] tests/e2e/page-controls.spec.ts`, `[MODIFY] tests/unit/studio-state.test.ts`, `[MODIFY] tests/unit/page-exports.test.ts` (the packaged-export labels moved onto `PageExportAttempt`, so its tests moved with them).
    - `[MODIFY] docs/seams.md`, `[MODIFY] CHANGELOG.md`, `[MODIFY] DECISIONS.md`, `[MODIFY] WORST_TO_BEST_LOG.md`.
    - `docs/evidence/2026-09-05/`, named rather than globbed — a wildcard is not an inventory, and a review caught it standing in for one. Written by the chain: `[MODIFY] chamber-lock.json`, `[MODIFY] verify.txt`, `[MODIFY] test.txt`, `[MODIFY] shaolin-lint.json`, `[MODIFY] assumption-alarm.json`, `[MODIFY] seam-ledger.json`, `[MODIFY] seam-ledger.md`, `[MODIFY] clan-chain.json`, `[MODIFY] clan-chain.md`, `[MODIFY] proof-tape.json`, `[MODIFY] proof-tape.md`. Written around it: `[MODIFY] cipher-gate.json`, `[MODIFY] build.txt`, `[MODIFY] e2e.txt`, `[MODIFY] verify-outer.txt`, `[MODIFY] verify-chain.txt`, `[NEW] rewind-CreationStoreSeam-self-contained.txt`, `[MODIFY] rewind-CreationStoreSeam.txt`, `[MODIFY] rewind-CreationStoreSeam(self-contained).txt`, `[NEW] probe-browser-seams.txt`.
    - `[MODIFY] lint.txt`. This line read "`lint.txt` is deliberately absent — eslint prints nothing on success, so the file does not change and does not appear in the diff." That was true when it was written and stopped being true two commits later, when the capture script began appending its own `lint exit=0` line so the transcript would carry its own result. The reasoning outlived the fact by three pushes, and the sentence declaring the list complete is what made the omission a defect rather than a rounding error. Caught by a reviewer diffing the claim against `git diff --name-status`, which is the check the next line names.
    - The whole list above is meant to equal `git diff --name-status <base>..HEAD`, and that is the check: any path in one and not the other is a defect in this entry. Nothing is deliberately absent from it.
  - Do not touch: the `cb_creations_v1` / `cb_drafts_v1` localStorage key names or the adapter's storage format; the `Vibe:` line's existing byte-for-byte output; any seam other than `CreationStoreSeam`; the legacy flat-layout `contracts/` copies of this seam.
  - Commands: `npm run check`, `npm run lint`, `npm test`, `npm run build`, `npm run cipher:gate`, `npm run verify`, `npm run rewind -- --seam "CreationStoreSeam (self-contained)"`, `npx playwright test`, `node probes/browser-seams.probe.mjs`. The last two do not run against the container's browser as written — see the Chromium version note in `docs/evidence/2026-09-05/verify-chain.txt` for the `launchOptions.executablePath` override the successful captures used. `cipher:gate` and the probe were missing from this list while the evidence folder carried both a regenerated `cipher-gate.json` and a new `probe-browser-seams.txt` proving they had run: the chain does not invoke either, so a list that omits them cannot reproduce the seam evidence this change ships.

- Cipher Gate:
  - Date: 2026-09-05
  - Seams: CreationStoreSeam (self-contained)
  - Evidence: docs/evidence/2026-09-05/verify.txt; docs/evidence/2026-09-05/test.txt; docs/evidence/2026-09-05/chamber-lock.json; docs/evidence/2026-09-05/seam-ledger.json; docs/evidence/2026-09-05/proof-tape.json
  - Summary: Added an optional `styleSelection` to `CreationRecordSchema` and `DraftRecordSchema` so a saved page carries the theme, voice, glitter and wig that composed its `Vibe:` line, reusing `MeechieStudioVoiceSettingsSchema` rather than restating three enums.
  - Risks: A record naming a theme that a later release removes falls back to the first theme rather than failing; the field is optional, so a record written by an older build restores no style and is reported as unknown rather than guessed at.

## 2026-09-05 - The client AI counter reports the server's quota instead of inventing one

- Date: 2026-09-05
- Decision: Stop counting `generate_text` against the home studio's client-side allowance, refill that allowance whenever a new verdict reaches the screen, and display the per-caller quota the server already publishes in `RateLimit-Limit` / `RateLimit-Remaining` / `RateLimit-Reset` / `Retry-After` on every `/api/meechie-studio-text` response.
- Context: `revisionBudget` was an in-memory `$state(3)` that counted the first verdict as a revision, never refilled, disabled every AI button on a mode switch that had just deleted the verdict the charge was for, and described itself as being "for this page" while being per tab-load and global across all eight modes. Meanwhile `postJson` discarded the quota headers the rate-limit guard computes on every exit, and `rate-limit-route.ts` explicitly asks routes to advertise them.
- Tradeoff being recorded: this removes the only client-side cap on verdict generation from the home page. A reader can now press Generate Verdict as often as the server allows. That is accepted because the cap was never a spend control and could not have been one — it lived in browser memory, a reload restored it, and the same generation runs uncapped on `/meechie`, the three mode routes and all eight `/m/<slug>` pages. Spend is metered server-side by the quota gate: the `text` bucket is 20 units per 60 seconds at `STUDIO_TEXT_QUOTA_COST` 2, i.e. ten actions a minute per caller. The client cap was more than three times stricter than the real one and permanent where the real one lasts sixty seconds, so it was costing readers function without protecting spend.
- Alternatives: (a) keep counting `generate_text` and merely refill on a new round — rejected, because a rewrite-budget that the Generate button can refill for free is a cap in name only, and the honest rule is that asking is not rewriting; (b) persist the allowance so a reload cannot reset it — rejected for now, because it needs a new field on `DraftRecordSchema` and therefore the full Seam-Driven Development workflow, for a churn guardrail whose refill rule already makes the reload path uninteresting. Recorded as deliberately deferred in `WORST_TO_BEST_LOG.md`.
- Consequences: `CostClass` loses `'unclassified'` and every provider-calling action is graded `paid`; `canRunStudioAction` reads the in-flight guard off the AI metadata rather than off the budget flag, so Generate Verdict is still single-submit; `STUDIO_TEXT_QUOTA_COST` has one definition, in `$lib/core/ai-quota`, imported by both the pipeline that charges it and the meter that divides by it.
- Revisit criteria: if the client cap is ever wanted as a real spend control, it belongs server-side in the quota policy, not in browser memory. If the image path's quota is surfaced too, `readAiQuota` already reads it — only the wiring on `/api/generate` is missing.
- Self-critique: the riskiest assumption was that the quota headers are reliably present. Disproved as a risk two ways — the guard emits them on every allowed and denied decision, including via the in-memory store used when Upstash is unconfigured, and `readAiQuota` returns `null` for any absent, malformed, negative, fractional or over-limit header set, which the studio renders as no line at all rather than as a guessed number. Nine such cases are pinned in `tests/unit/ai-quota.test.ts`.
- Evidence: docs/evidence/2026-09-05/verify.txt; docs/evidence/2026-09-05/test.txt; tests/unit/ai-quota.test.ts; tests/unit/studio-state.test.ts ("StudioState AI budget meter"); tests/unit/meechie-studio.test.ts
- Seams: none changed; two used. No file under `contracts/`, `probes/`, `fixtures/`, `src/lib/mocks/`, `src/lib/adapters/` or `src/lib/seams/` is touched, and the rate-limit seam contract is unchanged - this reads headers the server already sends. The quota reading is expired through `ClockSeam.scheduleAt`, which is a *consumer* of an existing registered seam (`docs/seams.md`), through its published contract and its mock in tests - the same way `studio-state.svelte.ts` already scheduled its day-boundary label refresh before this change. Reaching for `setTimeout` instead is what the clock/time seam rule forbids; calling the seam is what it asks for. No seam gains, loses or alters an operation, so no Cipher Gate entry is required.

## 2026-09-05 - Consumer Import Re-routing and Mock Synchronization (Batch 3 Seam Migration v2.0)

- Date: 2026-09-05
- Decision: Re-route all consumer imports across API routes, core pipelines, studio state stores, UI components, and mode page factories to canonical self-contained seam packages (`$lib/seams/<name>-seam/contract` and `$lib/adapters/<name>-seam`), and synchronize legacy mock files in `src/lib/mocks/` to re-export canonical modular mocks for all 7 migrated seams (`SessionSeam`, `AuthContextSeam`, `CreationStoreSeam`, `OutputPackagingSeam`, `ChatInterpretationSeam`, `MeechieStudioTextSeam`, `ProviderAdapterSeam`).
- Context: Batches 1 & 2 established modular seam directories, contracts, fixture modules, in-memory mocks, and canonical adapters, while providing backward-compatibility re-exports. Batch 3 eliminates downstream coupling to legacy paths across the entire codebase and aligns all legacy mock entrypoints with their modular equivalents.
- Alternatives: Keep legacy mocks with separate fixture parsers; rejected because duplicate fixture parsing creates drift between legacy and canonical contract test runners.
- Consequences: All consumers import directly from canonical modular paths, legacy mocks delegate cleanly without code duplication, contract tests pass across both legacy and self-contained paths, and full verification suite passes.
- Revisit criteria: Any future seam additions should follow the self-contained blueprint directly (`docs/SEAM_BLUEPRINT.md`).
- Self-critique: Riskiest assumption is that an unmigrated test or third-party consumer relies on internal mock details; disproved by running the complete vitest suite across all 1,279+ tests and full `npm run verify`.
- Evidence: docs/evidence/2026-09-05/verify.txt; docs/evidence/2026-09-05/test.txt; docs/evidence/2026-09-05/chamber-lock.json; docs/evidence/2026-09-05/seam-ledger.json; docs/evidence/2026-09-05/proof-tape.json
- Plan:
  - Goal: Re-route consumer imports and synchronize legacy mocks for the 7 migrated seams, then run full verification.
  - Seams: SessionSeam, AuthContextSeam, CreationStoreSeam, OutputPackagingSeam, ChatInterpretationSeam, MeechieStudioTextSeam, ProviderAdapterSeam.
  - Files: `src/routes/api/meechie-studio-text/+server.ts`, `tests/unit/api-meechie-studio-text-endpoint.test.ts`, `src/lib/core/chat-interpretation-pipeline.ts`, `src/lib/core/meechie-studio.ts`, `src/lib/core/meechie-studio-text-pipeline.ts`, `src/routes/studio-state.svelte.ts`, `src/lib/components/studio/StudioPreviewPanel.svelte`, `src/lib/components/studio/VerdictRow.svelte`, `src/lib/components/verdict-page-state.svelte.ts`, `src/lib/components/MeechieTools.svelte`, `src/lib/mocks/session.mock.ts`, `src/lib/mocks/auth-context.mock.ts`, `src/lib/mocks/creation-store.mock.ts`, `src/lib/mocks/output-packaging.mock.ts`, `src/lib/mocks/chat-interpretation.mock.ts`, `src/lib/mocks/meechie-studio-text.mock.ts`, `src/lib/mocks/provider-adapter.mock.ts`, `docs/seams.md`, `CHANGELOG.md`, `DECISIONS.md`, `plan.md`.
  - Commands: `npm run check`, `npm run lint`, `npm test`, `npm run verify`.

- Cipher Gate:
  - Date: 2026-09-05
  - Seams: SessionSeam, AuthContextSeam, CreationStoreSeam, OutputPackagingSeam, ChatInterpretationSeam, MeechieStudioTextSeam, ProviderAdapterSeam
  - Evidence: docs/evidence/2026-09-05/verify.txt; docs/evidence/2026-09-05/test.txt; docs/evidence/2026-09-05/chamber-lock.json; docs/evidence/2026-09-05/seam-ledger.json; docs/evidence/2026-09-05/proof-tape.json
  - Summary: Completed Batch 3 consumer import re-routing and mock re-export synchronization across all 7 migrated seams.
  - Risks: Runtime browser environment missing canvas implementation during packaging; potential intermittent network timeouts during xAI provider calls.

## 2026-09-05 - Modularize Batch 2 Generation and Transport Seams (OutputPackagingSeam, ChatInterpretationSeam, MeechieStudioTextSeam, ProviderAdapterSeam)

- Date: 2026-09-05
- Decision: Modularize `OutputPackagingSeam`, `ChatInterpretationSeam`, `MeechieStudioTextSeam`, and `ProviderAdapterSeam` into canonical self-contained seam packages under `src/lib/seams/` with production adapters at `src/lib/adapters/<name>-seam/index.ts` and legacy re-export compatibility stubs at `contracts/` and `src/lib/adapters/`.
- Context: These 4 generation and transport seams handle document packaging, LLM chat interpretation, studio text synthesis, and external AI provider transport. Modularizing them standardizes contract exports, creates typed fixture modules (`fixtures.ts`), in-memory mocks (`mock.ts`), and self-contained contract tests (`test.ts`) while hardening boundaries with 8KB chunked base64 encoding, browser canvas guards, SVG viewBox parsing, and AbortSignal cancellation.
- Alternatives: Large monolithic refactor combining consumer import migration in the same branch; rejected to maintain atomic, reviewable batches and satisfy CI audit gates incrementally.
- Consequences: All 4 seams support dual rewind (`npm run rewind -- --seam <Name>` and `npm run rewind -- --seam "<Name> (self-contained)"`), contracts enforce strict type boundaries, and provider adapters properly clean up sockets on client abort.
- Revisit criteria: Once Batch 3 completes and consumers are re-routed to canonical paths, legacy stubs in `contracts/` and `src/lib/adapters/` can be retired.
- Self-critique: Riskiest assumption is that upstream provider responses could alter field formats; mitigated by strict Zod schema validation and fixture-backed contract tests.
- Evidence: docs/evidence/2026-09-05/verify.txt; docs/evidence/2026-09-05/test.txt; docs/evidence/2026-09-05/chamber-lock.json; docs/evidence/2026-09-05/seam-ledger.json
- Plan:
  - Goal: Implement Batch 2 of Seam Migration v2.0 for OutputPackagingSeam, ChatInterpretationSeam, MeechieStudioTextSeam, ProviderAdapterSeam.
  - Seams: OutputPackagingSeam, ChatInterpretationSeam, MeechieStudioTextSeam, ProviderAdapterSeam.
  - Files: `contracts/output-packaging.contract.ts`, `contracts/chat-interpretation.contract.ts`, `contracts/meechie-studio-text.contract.ts`, `contracts/provider-adapter.contract.ts`, `docs/seams.md`, `plan.md`, `src/lib/adapters/output-packaging.adapter.ts`, `src/lib/adapters/output-packaging-seam/index.ts`, `src/lib/seams/output-packaging-seam/*`, `src/lib/adapters/chat-interpretation.adapter.ts`, `src/lib/adapters/chat-interpretation-seam/index.ts`, `src/lib/seams/chat-interpretation-seam/*`, `src/lib/adapters/meechie-studio-text.adapter.ts`, `src/lib/adapters/meechie-studio-text-seam/index.ts`, `src/lib/seams/meechie-studio-text-seam/*`, `src/lib/adapters/provider-adapter.adapter.ts`, `src/lib/adapters/provider-adapter-seam/index.ts`, `src/lib/seams/provider-adapter-seam/*`.
  - Commands: `npm run check`, `npm run lint`, `npm test`, `npm run verify`.

- Cipher Gate:
  - Date: 2026-09-05
  - Seams: OutputPackagingSeam, ChatInterpretationSeam, MeechieStudioTextSeam, ProviderAdapterSeam
  - Evidence: docs/evidence/2026-09-05/verify.txt; docs/evidence/2026-09-05/test.txt; docs/evidence/2026-09-05/chamber-lock.json; docs/evidence/2026-09-05/seam-ledger.json
  - Summary: Migrated OutputPackagingSeam, ChatInterpretationSeam, MeechieStudioTextSeam, and ProviderAdapterSeam to canonical self-contained seam packages with fixture modules, in-memory mocks, self-contained contract suites, canonical adapters with chunked memory buffers and abort handling, and backward-compatible re-export stubs.
  - Risks: Headless canvas unavailability in non-browser execution environments; upstream AI provider socket stalls on long generative responses.

## 2026-09-05 - Modularize Batch 1 Identity and Storage Seams (SessionSeam, AuthContextSeam, CreationStoreSeam)

- Date: 2026-09-05
- Decision: Modularize `SessionSeam`, `AuthContextSeam`, and `CreationStoreSeam` into canonical self-contained seam packages under `src/lib/seams/` with production adapters at `src/lib/adapters/<name>-seam/index.ts` and legacy re-export compatibility stubs at `contracts/` and `src/lib/adapters/`.
- Context: Flat legacy seams coupled domain contracts directly to legacy root layout. Modularization standardizes contract exports, creates typed fixture modules (`fixtures.ts`), in-memory mocks (`mock.ts`), and self-contained contract tests (`test.ts`) alongside canonical production adapters while keeping downstream consumers unbroken through backwards-compatible re-export stubs.
- Alternatives: Immediate destructive migration without re-export stubs; rejected because hundreds of downstream tests and components depend on legacy paths, risking breaking changes across independent components.
- Consequences: All three seams now support dual rewind (`npm run rewind -- --seam <Name>` and `npm run rewind -- --seam "<Name> (self-contained)"`), contracts enforce strict type refinements (e.g. `userId` required for authenticated context, non-whitespace session IDs), and `CreationStoreSeam` includes optimistic ID merge and malformed record skip observability.
- Revisit criteria: Once Batch 2 and Batch 3 complete and all consumers are re-routed to canonical paths, legacy stubs in `contracts/` and `src/lib/adapters/` can be deprecated and retired.
- Self-critique: Riskiest assumption is that concurrent localStorage writes could conflict; mitigated by fresh reads before upserting and optimistic ID merging.
- Evidence: docs/evidence/2026-09-05/verify.txt; docs/evidence/2026-09-05/test.txt; docs/evidence/2026-09-05/chamber-lock.json; docs/evidence/2026-09-05/seam-ledger.json
- Plan:
  - Goal: Implement Batch 1 of Seam Migration v2.0 for SessionSeam, AuthContextSeam, and CreationStoreSeam.
  - Seams: SessionSeam, AuthContextSeam, CreationStoreSeam.
  - Files: `contracts/session.contract.ts`, `contracts/auth-context.contract.ts`, `contracts/creation-store.contract.ts`, `docs/seams.md`, `plan.md`, `src/lib/adapters/session.adapter.ts`, `src/lib/adapters/session-seam/index.ts`, `src/lib/seams/session-seam/*`, `src/lib/adapters/auth-context.adapter.ts`, `src/lib/adapters/auth-context-seam/index.ts`, `src/lib/seams/auth-context-seam/*`, `src/lib/adapters/creation-store.adapter.ts`, `src/lib/adapters/creation-store-seam/index.ts`, `src/lib/seams/creation-store-seam/*`.
  - Commands: `npm run check`, `npm run lint`, `npm test`, `npm run verify`.

- Cipher Gate:
  - Date: 2026-09-05
  - Seams: SessionSeam, AuthContextSeam, CreationStoreSeam
  - Evidence: docs/evidence/2026-09-05/verify.txt; docs/evidence/2026-09-05/test.txt; docs/evidence/2026-09-05/chamber-lock.json; docs/evidence/2026-09-05/seam-ledger.json
  - Summary: Migrated SessionSeam, AuthContextSeam, and CreationStoreSeam to canonical self-contained seam packages with fixture modules, in-memory mocks, self-contained contract suites, canonical adapters, and backward-compatible re-export stubs.
  - Risks: Concurrent multi-tab localStorage writes could lead to race conditions if two tabs write simultaneously; localStorage access may throw SecurityError in locked-down iframes.
## 2026-09-05 - Run 5 merge close-out (micro plan + self-critique)

- Date: 2026-09-05
- Decision: Record Run 5's merge outcome in `WORST_TO_BEST_LOG.md` as a separate, docs-only change
  after PR #297 merged as `cc5f622`, and regenerate this date's evidence artifacts on that
  close-out head rather than citing the merged head's.
- Context: The worst-feature routine's log is the only memory between runs. Run 5 exists because
  three previous runs deferred the wig try-on by citing each other; a run that merges without
  recording its outcome and its gate reasoning leaves the next one inheriting a claim instead of
  evidence. A review found this close-out had no micro Plan of its own and was inheriting the
  pre-merge feature plan in `plan.md`, which describes a different change.
- Alternatives: Fold the close-out into the feature PR (impossible - it records that PR's merge);
  skip it (loses the outcome, the gate reasoning and the two carried-forward findings); leave the
  merged head's evidence in place (rejected, and correctly: the routine requires check, lint, test
  and build before *every* push).
- Consequences: `docs/evidence/2026-09-05/` now describes two heads, so provenance is stated per
  artifact. `verify-outer.txt` is added because `verify.txt` holds only the inner verify-runner
  stage, which left the audit gate's result and the chain's exit status asserted rather than
  captured.
- Revisit criteria: If the routine ever produces the close-out inside the feature PR, the two-head
  split in `verify-chain.txt` becomes unnecessary and should be removed rather than maintained. If
  `verify-chain.txt` is ever generated rather than hand-written, its stale-header failure mode goes
  away and the per-artifact labelling should be reassessed. And `scripts/proof-tape.mjs` should
  learn to compare artifact times against the start of the current push rather than against
  `chamber-lock.json`: as it stands, `cipher-gate.json` can never clear that test, because the
  ordering above requires it to be written *before* the chain in order to be inventoried correctly
  at all, so the tape calls it "written by an earlier run" every time. That is a generator change
  with its own tests, not a close-out change, which is why it is recorded here instead of made.
- Plan (micro):
  - Goal: record the merge outcome, the gate conditions and exclusions as actually checked, and the
    findings worth carrying to the next run.
  - Seams: none. No file under `contracts/`, `probes/`, `fixtures/`, `src/lib/mocks/`,
    `tests/contract/`, `src/lib/adapters/` or `src/lib/seams/` is touched, and no `src/` or `tests/`
    file at all.
  - Files:
    - `WORST_TO_BEST_LOG.md` (the close-out entry and its corrections)
    - `DECISIONS.md` (this entry)
    - `docs/evidence/2026-09-05/verify-outer.txt` (new; written after the chain completes, so it
      is deliberately absent from that run's own `proof-tape` inventory)
    - `docs/evidence/2026-09-05/verify-chain.txt`
    - `docs/evidence/2026-09-05/verify.txt`
    - `docs/evidence/2026-09-05/test.txt`
    - `docs/evidence/2026-09-05/lint.txt`
    - `docs/evidence/2026-09-05/build.txt`
    - `docs/evidence/2026-09-05/cipher-gate.json`
    - `docs/evidence/2026-09-05/chamber-lock.json`
    - `docs/evidence/2026-09-05/shaolin-lint.json`
    - `docs/evidence/2026-09-05/assumption-alarm.json`
    - `docs/evidence/2026-09-05/seam-ledger.json`
    - `docs/evidence/2026-09-05/seam-ledger.md`
    - `docs/evidence/2026-09-05/clan-chain.json`
    - `docs/evidence/2026-09-05/clan-chain.md`
    - `docs/evidence/2026-09-05/proof-tape.json`
    - `docs/evidence/2026-09-05/proof-tape.md`
  - Not touched, and deliberately so: `docs/evidence/2026-09-05/e2e.txt`,
    `docs/evidence/2026-09-05/rewind-wig-catalog-seam.txt` and
    `docs/evidence/2026-09-05/rewind-WigCatalogSeam.txt` carry the code head's results, because the
    routine scopes end-to-end runs to user-facing changes and no code has changed since.
  - Commands: `npm run check`, `npm run lint`, `npm test`, `npm run build`, `npm run verify`,
    `npm run cipher:gate`. `npx playwright test` is deliberately not re-run: the routine scopes
    end-to-end runs to user-facing changes, and a log entry is not one.
  - How behaviour stays unchanged: no file under `src/` or `tests/` is in the diff at all, so there
    is no code whose behaviour could differ - that, and not any property of the build output, is
    what establishes it. `npm run build` exits 0 and every emitted chunk keeps its byte size, and
    `npm test` is unchanged at 1252 passed / 1 skipped. Note what those do *not* show: the hashed
    filenames differ between two builds of identical source, so a green build is not evidence of an
    identical bundle and is not offered as any. Reproduce it from a clean tree with
    `npm run build && cp -r .svelte-kit/output /tmp/a && npm run build` and compare the emitted
    filenames: four chunks change name at byte-identical sizes with no source edit between them.
    Neither a hash nor a commit range is cited here on purpose. A hash quoted in prose is wrong on
    the next build, which is the very instability being documented; and a range of close-out commits
    is not guaranteed to remain reachable once this branch is merged and its ref deleted. Running
    the build twice needs neither.
- Self-critique (micro): The riskiest thing here is not the diff, it is the prose. Every review
  finding on this close-out has been a sentence about evidence that was looser than the evidence,
  and twice the looseness was introduced by the commit fixing the previous instance - a stale
  "Results on this head" heading over a Playwright run that had not happened, an await-timing
  explanation that misdescribed code the reader can check, and a header still naming a superseded
  head. `npm run cipher:gate` cannot catch any of them: it verifies that an entry exists, not that
  it is true. The mitigation applied is structural rather than a resolution to be careful - claims
  are now attached to the artifact they describe rather than to a section heading, and the moving
  totals were removed from a hand-written header and left only in the append-only log where they
  cannot go stale.

## 2026-09-05 - The wig carousel loads through `WigCatalogSeam`, and facet counts are cross-filtered

- Cipher Gate:
  - Date: 2026-09-05
  - Seams: WigCatalogSeam (existing; no contract, validator, mock, probe, fixture or adapter changed). The change is a new *consumer*: the UI stops bypassing the seam and starts calling `listWigs()` through the existing adapter, as `/api/wig-try-on` already does. CreationStoreSeam, SpecValidationSeam and OutputPackagingSeam are likewise consumed through their existing adapters, unchanged.
  - Evidence: docs/evidence/2026-09-05/rewind-wig-catalog-seam.txt, docs/evidence/2026-09-05/chamber-lock.json, docs/evidence/2026-09-05/test.txt, docs/evidence/2026-09-05/verify.txt, docs/evidence/2026-09-05/seam-ledger.md, docs/evidence/2026-09-05/clan-chain.md, docs/evidence/2026-09-05/proof-tape.md, src/lib/seams/wig-catalog-seam/contract.ts, src/lib/seams/wig-catalog-seam/validators.ts, src/lib/seams/wig-catalog-seam/mock.ts, src/lib/seams/wig-catalog-seam/probe.ts, src/lib/seams/wig-catalog-seam/test.ts, src/lib/seams/wig-catalog-seam/fixtures.ts, src/lib/adapters/wig-catalog-seam/index.ts, docs/seams.md
  - Summary: `WigCarousel.svelte` previously read the catalog with `import wigData from '$lib/data/wigs.json'` and `wigData as unknown as Wig[]`, so `validateWigCatalog` never ran for the UI and the seam's `WIG_CATALOG_LOAD_FAILED` and `WIG_CATALOG_EMPTY` results had no path to a reader - a malformed or empty catalog rendered as an empty row with no message. The seam is now the only reader, and it is called from the page's `load` in `src/routes/+page.ts`, which runs on the server and on the client. `WigCarousel.svelte` is presentational: it receives `wigs` and `loadError` as props and renders either the validated wigs or the seam's own error message. It has **no** loading state, because there is nothing to wait for - the cards and their affiliate links are in the server-rendered HTML. (An intermediate version of this change did the load in a component `$effect`; that removed the catalog from the initial HTML entirely and was replaced. This entry describes the shipped design, not that one.) This is recorded as a Cipher Gate entry because the integration makes seam outcomes newly observable in the UI, which a reviewer reasonably read as crossing the boundary, and `AGENTS.md` says to treat doubt as a seam change. What the entry does not claim is a seam change: the seam's six artifacts all pre-date this work and none is in the diff (`git diff origin/main...HEAD --name-only` matches nothing under `contracts/`, `probes/`, `fixtures/`, `src/lib/mocks/`, `tests/contract/`, `src/lib/adapters/` or `src/lib/seams/`), no contract shape moved, and the seam returns exactly what it returned before for the same input. `npm run rewind -- --seam WigCatalogSeam` passes 27 tests on the code head this entry describes; it is not re-run for the docs-only close-out that follows, which changes no code for it to verify.
  - Risks: The seam now runs on the server as well as in the browser. That is safe to assert rather than hope for, because the adapter's only input is a bundled `import rawCatalog from '../../data/wigs.json'` - no `fs`, no network, no `process.cwd()` - so it is the same computation in both runtimes and cannot fail on one and succeed on the other. What does change is how often it runs: `+page.ts` constructs a fresh seam per load, and `cachedWigs` lives in that instance's closure, so `validateWigCatalog` now runs once per page load instead of once per browser tab. Accepted, and stated rather than glossed: the catalog is eight entries, and the alternative - a module-level instance - would make the parse result outlive a deploy inside a warm serverless instance. A `wigs.json` edited in a running dev server is still not re-read until the module graph reloads, exactly as the raw import behaved. `wig-catalog-seam` carries a documented manual probe with no `runProbe` export and `N/A` in the registry's probe-date column; that pre-dates this change and is untouched by it, so the seam's automated evidence here is its contract test via rewind and chamber-lock's artifact-presence gate, not a fresh probe run. Making the failure paths visible also means a reader can now be shown a catalog error where they previously saw an empty row, which is better but is a new user-facing string on a path that had none - and because the load runs on the server, that string can now reach the initial HTML.


- Date: 2026-09-05
- Seams: none changed. `WigCatalogSeam` is consumed through its existing adapter
  (`src/lib/adapters/wig-catalog-seam/index.ts`), exactly as `/api/wig-try-on` already consumes it;
  `CreationStoreSeam`, `SpecValidationSeam` and `OutputPackagingSeam` through the adapters
  `studio-state.svelte.ts` already calls. No file under `contracts/`, `probes/`, `fixtures/`,
  `src/lib/mocks/`, `tests/contract/`, `src/lib/adapters/` or `src/lib/seams/` is in the diff and no
  contract shape changed. A Cipher Gate entry is recorded above all the same: a reviewer read the
  new consumer as making seam outcomes observable across the boundary, and `AGENTS.md` says to treat
  doubt as a seam change.
- Decision 1: the catalog is read by `createWigCatalogSeam().listWigs()` in `src/routes/+page.ts`,
  not by importing `wigs.json` into `WigCarousel.svelte` and casting it with `as unknown as Wig[]`.
  The carousel becomes presentational and takes `wigs` and `loadError` as props.
  - Why: the cast meant `validateWigCatalog` never ran for the UI and the seam's
    `WIG_CATALOG_LOAD_FAILED` / `WIG_CATALOG_EMPTY` errors could not reach a reader, so a broken
    catalog rendered as an empty row with no message. The component's own comment claimed
    "validators run at adapter layer" while never calling the adapter.
  - Why in `load` and not in the component: the first attempt read the seam from an `$effect`, which
    does not run during SSR. That took the wigs and their affiliate links out of the
    server-rendered HTML — the one thing this section of the page exists to carry — and left a
    loading line for a crawler or a reader with scripting off. A `load` runs in both places, so the
    seam is still the only reader and the markup comes back. An e2e test asserts against the
    response body, not the hydrated DOM, so the two cannot silently diverge again.
  - Tradeoff: a fresh seam instance per load means `validateWigCatalog` runs once per page load
    rather than once per tab. Accepted for an eight-entry catalog; the alternative is a UI that
    cannot report a failure it is having.
- Decision 2: facet counts are computed against the search and every *other* dimension, not against
  the whole catalog.
  - Why: two of eight wigs are synthetic and neither is black; four are black and none is synthetic.
    A catalog-wide count renders "Black 4" while Synthetic is selected and returns nothing when
    tapped — a control that describes itself falsely, which is the defect this rebuild exists to
    remove.
  - Alternative rejected: catalog-wide counts, which are one line shorter. A count of 0 also
    disables its chip, so a dead end cannot be entered.
- Decision 3: try-on portraits are held as a list keyed by the wig they were made for, and the wig
  is captured before the request rather than read after it.
  - Why: a single shared string made two looks impossible to compare and let a late response attach
    itself to whichever wig was selected when it landed.
  - Tradeoff: `selectedWigId` becomes derived from `selectedWig` rather than separately assigned, so
    the two cannot disagree about which wig is on screen.
- Decision 4: `saveToVault` accepts a page with images and no studio text.
  - Why: a try-on page has no verdict behind it and was the only page in the app the vault refused.
    `CreationRecordSchema.studioText` is already optional and `loadCreation` already restores
    records without it.
  - Tradeoff: `assembledPrompt` is required and non-empty, so the try-on path supplies a description
    of the page rather than a machine prompt — `loadCreation` puts a reopened record's own words in
    the evidence box, and a prompt there is shipped to the provider as the reader's facts.

## 2026-09-04 - The focused-mode catalog is derived from `studioModes`, and an unknown slug is a 404

- Date: 2026-09-04
- Seams: none changed. `MeechieToolSeam`, `SpecValidationSeam`, `OutputPackagingSeam`,
  `CreationStoreSeam`, `SessionSeam` and `ClockSeam` are reached through `VerdictPageState`, which
  already calls their existing adapters for the three standalone mode routes. No file under
  `contracts/`, `probes/`, `fixtures/`, `src/lib/mocks/`, `src/lib/adapters/` or `src/lib/seams/`
  was touched, so no Cipher Gate entry is required.
- Decision 1: `/m/[mode]` delegates everything after the verdict to `VerdictPageState` +
  `VerdictPageStudio`, exactly as `/who-fucked-up`, `/rate-his-excuse` and `/random` already do.
  - Alternative rejected: give it its own lifecycle. That is the duplication run 3 removed, and it
    is how all three standalone routes ended up each missing a different thing.
  - Alternative rejected: delete `/m/[mode]` and redirect to the standalone routes. Only three of
    the eight modes have a standalone route; the other five would lose their only page.
- Decision 2: the mode catalog is derived from `studioModes` rather than restated beside it.
  - Why: the home page renders a `/m/<id>` link for every studio mode, and the route resolved those
    ids against a second hand-written map. The two had to agree for the links to work and nothing
    checked that they did — a mode added to `studioModes` alone would have got a working home-page
    link to a page that silently served Random Meechie.
  - Consequence: adding a mode to `studioModes` gives it a mode card, a home-page link and a `/m/`
    page in one edit. A mode whose tool has no field definition is left out of the catalog rather
    than rendered with a dead button.
- Decision 3: an unrecognised slug returns 404 instead of falling back to Random Meechie.
  - Tradeoff: this is a behaviour change, and a fallback never 404s. But answering 200 with a
    different mode's page under the requested address is worse than saying the address is wrong —
    it is indistinguishable, from the reader's side, from the mode having been renamed.
  - Every slug the previous hand-written map accepted is kept as an alias and asserted by test, so
    the change reaches typos only, never a link that works today. Aliases resolve to the canonical
    slug because the slug becomes the download filename stem.
- Decision 4: `/m/[mode]` keys `MeechieModePage` on the slug.
  - Why: SvelteKit reuses one component instance across parameter changes on the same route, and
    the page owns a `VerdictPageState` built once per instance. Without the key, walking from one
    mode to another leaves the first mode's verdict on screen under the second mode's title, and
    the page it made still downloads under the first mode's filename.
  - Proven by deleting the key and watching the end-to-end test fail. The first version of that
    test used `page.goto`, which builds a new document, and so passed with the key deleted — the
    navigation has to be client-side for the reuse to happen at all. The test now marks the
    document and asserts the mark survives the click.

## 2026-09-04 - The standalone mode routes share one verdict-to-page lifecycle, and it needs two staleness tokens

- Date: 2026-09-04
- Seams: none changed. `MeechieToolSeam`, `SpecValidationSeam`, `OutputPackagingSeam`,
  `CreationStoreSeam` and `SessionSeam` are called through their existing adapters exactly as
  `src/routes/+page.svelte` and `src/lib/components/MeechieTools.svelte` already call them. No file
  under `contracts/`, `probes/`, `fixtures/`, `src/lib/mocks/`, `src/lib/adapters/` or
  `src/lib/seams/` was touched, so no Cipher Gate entry is required.
- Decision 1: `/who-fucked-up`, `/rate-his-excuse` and `/random` delegate everything after the
  verdict to `VerdictPageState` + `VerdictPageStudio`, and keep only their own hero, input and
  verdict presentation.
- Context: the three routes carried ~2,000 lines of near-identical copy-paste. All three sent
  `listMode: 'title_only'` for every verdict, discarding the `Fault:`/`Consequence:`/`Move:`
  structure the tool prompts explicitly request and capping the whole answer at a 96-character
  title; all three discarded the drift report; none could write to the Quote Vault; all three
  packaged print and share in one call, so a failed share image took the printable PDF with it; and
  all three cleared the verdict and previews before the request went out, so a failed retry
  destroyed a page the user had already paid to generate. Every one of those was already solved
  once, in the toolkit, by code these routes could not reach.
- Alternatives: fix the three copies in place (rejected — it preserves the thing that made them
  diverge); make the routes render `MeechieTools.svelte` (rejected — it would replace three distinct
  landing experiences with one tool picker, and the hero, the score ring and the tap-for-truth
  loading state are the reason these routes exist).
- Decision 2: the shared class keeps **two** staleness tokens, `verdictToken` and `pageToken`, not
  the single token the toolkit uses.
- Context: `pageToken` is bumped by anything that makes the displayed page wrong, including editing
  the dedication. `verdictToken` is bumped only by an explicit reset. With one shared token, typing
  in the dedication field — which on these routes is on screen while a replacement verdict is still
  loading — silently cancels that verdict request and re-enables the button with nothing on the
  way. The toolkit never hits this because it clears the verdict on every tool switch.
- Consequences: a fix to any of these behaviours now lands on all three routes at once. The cost is
  one more concept in the shared class; it is tested directly
  (`tests/unit/verdict-page-state.test.ts`, "does not cancel an in-flight verdict request"), and
  collapsing the two tokens makes that test fail.
- Revisit criteria: if `MeechieTools.svelte` is ever migrated onto `VerdictPageState`, re-check
  whether it still needs the tool-switch reset that currently makes one token sufficient there.

## 2026-09-04 - A tool page is shaped by the verdict's structure, and a page saved from the toolkit carries no `studioText`

- Date: 2026-09-04
- Seams: none changed. `MeechieToolSeam`, `CreationStoreSeam`, `SessionSeam` and
  `OutputPackagingSeam` are called through their existing adapters; no contract was touched.
- Decision 1: `src/lib/core/tool-page-recipe.ts` chooses the page type per verdict rather than per
  tool. A verdict that parses into two or more structured lines — the `Fault:`/`Consequence:`/`Move:`
  beats that `red_flag_or_run` and `wwmd` are prompted to emit, or the `Nth place:` entries
  `lineup` is prompted to emit — becomes a numbered list page; everything else becomes a full-quote
  page.
- Context: the three standalone mode routes each flatten headline plus response into one
  `title_only` page title capped at 96 characters, which discards the structure the tool prompt
  deliberately asked for. The app already has a list page format (`listMode: 'list'`), and nothing
  was using it outside the studio.
- Tradeoff: parsing a provider's prose is not guaranteed. The mitigation is that the fallback is
  not a failure — an unstructured answer is a perfectly good quote page — and the threshold is two
  items, because a one-item list is a quote wearing a list's clothes. Alternative rejected: always
  emitting a list page, which would print single-item lists whenever a provider ignored the format.
- Decision 2: list labels are truncated to the contract's 40 characters and then trimmed back to
  the last word that carries meaning (`trimDanglingTail`), dropping a trailing conjunction or
  preposition and the fragment one drags behind it.
- Context: proven necessary rather than assumed. Driving the rebuilt hub in a real browser produced
  `Fault: he had time to answer and used` — a printed page line cut mid-phrase. The word-boundary
  cut alone was not enough.
- Tradeoff: the rule is a word list, so it is English-only and will not catch every awkward cut
  (`Move: change the locks before he asks` survives). It is a readability improvement on a hard
  40-character contract limit, not a grammar engine, and it is tested against the cases that
  actually occurred.
- Decision 3 (**superseded on the same day — see the correction below**): a page saved to the vault
  from the toolkit stores no `studioText`.
- Context: `MeechieStudioTextOutputSchema` requires a verdict, a quote, a page title, and between
  two and six page items. A tool verdict supplies none of those fields, and manufacturing them
  would put words in the vault that Meechie never said.
- Tradeoff as originally recorded: the vault row for a toolkit page shows its title, thumbnail and
  save date but no quote line, and vault search matches it on title rather than on quote. This is
  the behaviour `vault-gallery.ts` already documents and handles for records saved before
  `studioText` existed (`vaultQuote` returns `''` and `VerdictRow.svelte` omits the line).

## 2026-09-04 - Correction: a toolkit vault save must store `studioText`

- Date: 2026-09-04
- Supersedes: Decision 3 above, which was wrong. Raised by a Codex review on PR #291 and confirmed
  against the code before acting on it.
- What the original reasoning got wrong: it checked how an absent `studioText` renders in the vault
  **row** (`vaultQuote`, which correctly returns `''`) and concluded the absence was handled
  everywhere. It is not handled on the **reopen** path. `loadCreation` runs the record through
  `buildStudioTextFromCreationRecord` → `buildStudioTextFromSpec`, which
  - falls back to `assembledPrompt` for the quote, and on a generated page that field holds the
    full image-generation prompt, so reopening a saved page would print `STYLE:` / `NEGATIVE
    PROMPT:` rendering instructions inside quotation marks as if Meechie had said them; and
  - falls back to `DEFAULT_STUDIO_TEXT_OUTPUT.pageItems` when the saved spec has no items — which
    is *every* full-quote page — attaching the unrelated default landlord lines to the user's own
    saved page.
- Decision: `buildToolStudioText` in `src/lib/core/tool-page-recipe.ts` builds the stored text, and
  every field is text Meechie actually produced: `verdict` is the headline, `quote` is the
  response, `pageTitle` is the page's own title, and `pageItems` are the lines the page really
  prints. A full-quote page prints no items, so it falls back to the response's own sentences, and
  only if those cannot yield the schema's two does it lead with the headline — still her words,
  never a placeholder.
- Evidence: `tests/unit/tool-page-recipe.test.ts` asserts the output against
  `MeechieStudioTextOutputSchema` for every tool across list and quote pages, drives the real
  `buildStudioTextFromCreationRecord` to prove the reopen path is faithful, and keeps a red proof
  showing the old behaviour leaking `NEGATIVE PROMPT` into the quote and the default landlord items
  into the page.
- Lesson worth keeping: "an existing comment says this case is handled" is a claim about the code
  path that comment sits on, not about every path that reads the field.

## 2026-09-04 - Vault image completeness is checked at the edges, not by decoding

- Date: 2026-09-04
- Decision: `looksCompleteImage` in `src/lib/core/vault-gallery.ts` validates a stored image by its
  signature and its format's terminator (PNG `IEND`, JPEG `FFD9`, WebP's RIFF declared size against
  the actual byte length, a closed root for SVG) rather than by decoding or structurally walking the
  payload.
- Context: A review on PR #289 correctly observed that a PNG signature followed by arbitrary bytes
  and a valid `IEND` trailer passes this check, and asked for the image structure or decoding to be
  validated before the stored bytes are preferred over a fallback url. The observation is right; the
  remedy is where this decision differs.
- Tradeoff, and why the cheaper check was kept: `vaultImageSource` runs for every visible row inside
  a `$derived`, so it re-runs on every keystroke in the vault search box, and a saved page can be a
  megabyte of base64. Walking PNG chunk headers or decoding the payload turns a constant-cost check
  into one proportional to total vault size per keystroke. The failure it would additionally catch —
  bytes that are correctly framed at both ends but corrupt in the middle — is also much rarer than
  the one the edge check already catches, since truncation is how stored base64 actually gets
  damaged. Consequence: a middle-corrupt image still produces a broken thumbnail rather than falling
  back to a url. Alternative rejected: full decode on every render. Alternative worth revisiting:
  validating once at save time, or caching the verdict per record id, which would make a structural
  walk affordable — that is a change to the save path or a new cache, and neither belongs in a
  review-fix pull request.

## 2026-09-04 - Cipher Gate: ClockSeam, AppOriginSeam and PageVisibilitySeam

- Cipher Gate:
  - Date: 2026-09-04
  - Seams: ClockSeam (new), AppOriginSeam (new), PageVisibilitySeam (new). No existing seam contract changed.
  - Evidence: docs/evidence/2026-09-04/chamber-lock.json, docs/evidence/2026-09-04/test.txt, docs/evidence/2026-09-04/verify.txt, docs/evidence/2026-09-04/seam-ledger.md, docs/evidence/2026-09-04/clan-chain.md, docs/evidence/2026-09-04/proof-tape.md, src/lib/seams/clock-seam/test.ts, src/lib/seams/clock-seam/probe.ts, src/lib/seams/app-origin-seam/test.ts, src/lib/seams/app-origin-seam/probe.ts, src/lib/seams/page-visibility-seam/test.ts, src/lib/seams/page-visibility-seam/probe.ts, docs/seams.md
  - Summary: Three host-environment reads that the Quote Vault rebuild had left outside any seam are now behind one each. ClockSeam owns reading the current instant and running a callback when a given instant arrives, which is what makes the saved-date labels roll over at UTC midnight; its adapter re-arms long waits in chunks so a delay past setTimeout's 32-bit limit does not fire immediately. AppOriginSeam owns reading the origin the app is served from, which decides whether a stored absolute image URL is same-origin and therefore loadable under img-src 'self'. PageVisibilitySeam owns whether the page is being looked at and announcing when it comes back, which is the other half of the label refresh. All three ship with a validator, fault fixtures driven through the mock, and a runnable probe; every mock is deterministic - the clock only moves when a test moves it, the origin is fixed by scenario, and visibility changes only when a test changes it.
  - Risks: ClockSeam and PageVisibilitySeam have synchronous contracts with no Result arm, unlike most seams here, so an invalid instant throws rather than returning an error - deliberate, because NaN would make setTimeout fire immediately and a self-re-arming timer spin, but it does differ from the house shape. Three pre-existing Date.now()/new Date() reads in src/routes/studio-state.svelte.ts are untouched, so that file currently mixes seamed and unseamed clock access; converting them is recorded as deferred in WORST_TO_BEST_LOG.md. AppOriginSeam degrades any unusable origin to the empty string rather than throwing, which makes the same-origin check refuse every absolute URL - a safe default, but one that hides a misconfigured host rather than reporting it. PageVisibilitySeam resolves any out-of-spec visibility state to "visible" for the same reason: a wrong visible costs one refresh nobody needed, a wrong hidden silently withholds one the reader is waiting on.

## 2026-09-04 - Introducing ClockSeam rather than a test-only clock injection

- Date: 2026-09-04
- Decision: Add `ClockSeam` (`src/lib/seams/clock-seam/`, adapter at
  `src/lib/adapters/clock-seam/index.ts`) covering two operations — reading the current instant and
  running a callback when a given instant arrives — and route the Quote Vault's saved-date labels
  through it.
- Context: The vault's "Saved today / 3 days ago" labels need to know the current instant and to
  roll over at UTC midnight. The first attempt read `Date.now()` directly in
  `src/routes/studio-state.svelte.ts`; the second replaced that with a plain injectable function
  defaulting to `Date.now()`. A review on PR #289 flagged both, correctly: `AGENTS.md` classifies
  clock/time as a seam, and a test-overridable default still leaves the production path reading the
  host clock outside any boundary. The full workflow was done rather than argued with a second time.
- Tradeoff 1, scheduling lives in the seam alongside reading: `scheduleAt` is part of the contract
  rather than a bare `setTimeout` at the call site. A timer is a clock read in disguise — it asks
  the host "tell me when it is T" — so leaving it outside would have reproduced the same problem one
  layer along, and the mock could not then drive a rollover end to end. Consequence: the seam owns
  two operations instead of one. Alternative rejected: a read-only clock seam plus a separate timer
  seam, which splits one concern across two boundaries for no gain.
- Tradeoff 2, the contract is synchronous and does not return `Result<>`: neither operation can
  fail on any host this app runs on, and an async `now()` would report the instant it resolved
  rather than the instant it was asked for. Consequence: `ClockSeam` does not match the `Promise<
  Result<>>` shape most seams in this repository use. Judged the honest contract over the uniform
  one — a `Result` whose error arm is unreachable is noise at every call site.
- Tradeoff 3, the three pre-existing `Date.now()` reads in `studio-state.svelte.ts` (creation ids,
  `createdAtISO` on drafts and saves) were **not** converted. They are untouched by this change, and
  rewriting them would widen a review-fix pull request into unrelated code. Consequence: the file
  temporarily has both styles. Converting them is a good small follow-up and is recorded as deferred
  in `WORST_TO_BEST_LOG.md`.
- Tradeoff 4, both a day-boundary timer and `visibilitychange` refresh the labels: the timer alone
  is not enough because a backgrounded tab can have its timers throttled or deferred, and
  `visibilitychange` alone is not enough because a tab left in the foreground across midnight never
  fires one. Consequence: two paths to the same refresh, both tested.

## 2026-09-04 - Rebuilding the Quote Vault without touching a seam

- Date: 2026-09-04
- Decision: Rebuild the Quote Vault entirely in `src/lib/core/`, `src/routes/`, and
  `src/lib/components/`, reading what it needs out of the existing `CreationRecord` rather than
  changing `CreationStoreSeam`'s contract or adapter.
- Context: The scheduled "worst feature -> best feature" run picked the Quote Vault (see
  `WORST_TO_BEST_LOG.md` for the full case). Everything the rebuild needed — the saved image
  bytes, `createdAtISO`, `favorite`, the studio text — was already persisted in the record and
  simply never read. Changing the contract would have pulled in the full Seam-Driven Development
  workflow for no behavioural gain.
- Tradeoff 1, image format is recovered from bytes, not from storage: `saveToVault` writes
  `{ b64 }` only, discarding the `format`/`encoding` the generator reported, and fixing *that*
  would be a contract change. So `detectVaultImageKind` in `src/lib/core/vault-gallery.ts`
  reads the real byte signature instead (reusing `detectRasterMimeTypeFromBytes`), and returns
  null rather than guessing when it does not recognise the bytes. Consequence: an image in a
  format the sniffer does not know renders as a placeholder rather than a broken thumbnail, and
  is skipped on restore. Alternative rejected: storing the format in the record, which is the
  cleaner fix and belongs in a seam-scoped change.
- Tradeoff 2, save-date labels count calendar days in UTC: `formatVaultSavedLabel` uses UTC day
  boundaries so the label is a pure function of the stored instant and never depends on the
  runner's or the viewer's timezone. Consequence: a page saved within a few hours of UTC midnight
  can read "yesterday" to someone whose local date still says today. Accepted because the
  alternative — local-time formatting — is nondeterministic in tests and risks an SSR/hydration
  mismatch, for a distinction that does not matter in a list of saved coloring pages.
- Tradeoff 3, re-packaging a reopened page is best effort: reopening a saved page rebuilds its
  printable PDF so Download PDF works, but the packaging adapter needs a browser canvas for some
  formats. A failure there is swallowed rather than surfaced: the page still previews and still
  exports as an image, so an error message would be noise about a capability the reader did not
  ask for. Both paths are covered in `tests/unit/studio-state.test.ts`.
- Known, deliberately not fixed here (all need the seam workflow, all recorded in
  `WORST_TO_BEST_LOG.md`): `creationStoreAdapter.deleteCreation` ignores `owner` and deletes by
  `id` across owners; `parseRecords`' `skippedIndices` is computed and never surfaced; and
  `localStorage` will eventually reject a vault of fifty full-size base64 pages — that last one is
  at least no longer silent, because this change surfaces `STORAGE_WRITE_FAILED`.

## 2026-09-03 - audit:gate's registry endpoint was unreachable during a scheduled quick-wins run

- Date: 2026-09-03
- Decision: Treat this run's `npm audit --audit-level=high` result as still valid without a fresh
  live re-check, and record why here rather than silently reusing it or blocking the whole PR on an
  external outage.
- Context: A scheduled quick-wins run (PR #282) made three docs-only commits over roughly 25
  minutes. The first `npm run verify` pass (22:12:22) completed cleanly, including a passing
  `audit:gate` ("found 0 vulnerabilities"). After the third commit (adding this run's Plan +
  Self-Critique and an `AGENTS.md` section), `npm audit --audit-level=high` was retried directly
  (bypassing the `verify` wrapper) three times with increasing timeouts (30s/60s/90s) and produced
  zero output each time; `npm ping` to the same `registry.npmjs.org` succeeded in 150ms in between
  retries, isolating the failure to the audit endpoint specifically rather than general
  connectivity, DNS, or the session's egress proxy (`registry.npmjs.org` is in `NO_PROXY`). A fourth
  retry (45s) after Vercel's own rate-limit failure on the same PR separately cleared also hung, and
  a fifth (30s) after a further round of governance-doc repairs also hung — five attempts in total,
  spanning roughly 20 minutes.
  `package.json`/`package-lock.json` are byte-identical to the tree the 22:12:22 run audited
  (confirmed via `git status --short package.json package-lock.json`, empty), so `npm audit`'s
  result is a deterministic function of a dependency tree that has not changed - only the ability
  to reach the endpoint changed.
- Alternatives: Block the whole run and leave the PR unmerged until the registry recovers; rejected
  because the two-hour-plus outages this endpoint has shown historically (see the `audit:gate`
  entry's own registry-round-trip risk in the 2026-09-03 security-headers Decision below) would
  leave a green, reviewed, docs-only PR stuck for no reason tied to its actual content. Silently
  reuse the earlier result with no note; rejected as exactly the "claiming compliance without
  evidence" failure mode `AGENTS.md`'s Anti-Laziness section exists to catch - a live Codex review
  finding on this PR correctly flagged this gap and asked for either a fresh full chain or an
  explicit blocked declaration. Skip `audit:gate` permanently or lower its threshold; rejected -
  `AGENTS.md`'s own revisit criteria for this gate says a registry outage should be recorded as an
  Assumption, not used to weaken the gate.
- Consequences: This PR merges on the strength of a same-session, same-dependency-tree audit result
  that is a few commits old rather than from the exact final diff, for the `audit:gate` step only -
  every other step (`check`, `test`, `lint`, `build`, chamber lock, shaolin lint, assumption alarm,
  seam ledger, clan chain, proof tape) ran fresh against the final diff and is captured in
  `docs/evidence/2026-09-03/verify-chain.txt`, which documents this reasoning inline as well.
- Revisit criteria: Re-run `npm audit --audit-level=high` directly the next time `package.json` or
  `package-lock.json` changes, or the next time a scheduled run has spare capacity to retry it -
  whichever comes first. If this endpoint keeps failing across multiple runs, that is itself worth
  a Decision about moving the audit off the critical path (e.g. a separate scheduled job) rather
  than reproducing this same Assumption every time.

- Assumption:
  - Date: 2026-09-03
  - Seams: None - `audit:gate` is a dependency-vulnerability check, not a seam.
  - Statement: The dependency tree at this PR's final commit (`package.json`/`package-lock.json`, unchanged since 22:12:22 this same session) has 0 high-or-critical-severity vulnerabilities, matching the `found 0 vulnerabilities` result `npm audit --audit-level=high` reported at 22:12:22 against the identical tree.
  - Validation: The registry's audit endpoint hung with zero output across five separate attempts (30s/60s/90s/45s/30s timeouts) spanning roughly 20 minutes, while `npm ping` to the same registry succeeded in 150ms in between, isolating the failure to the audit endpoint specifically. A sixth attempt (after PR #282 merged and further Codex-review repairs were prepared) succeeded once (`found 0 vulnerabilities`, matching this Statement), but a seventh attempt moments later, via `npm run verify`'s own wrapper, hung again - the endpoint is intermittently flaky rather than durably recovered, so this Assumption stays open rather than being marked resolved on one transient success. A separate, concurrent scheduled run (`session_01C9GA2bo9c2ebAWTo3YsaNb`) independently observed the identical pattern against this same unchanged tree: one clean pass at 23:19:21, then a registry-side 400 at 23:22:23, then another hang at 23:30 - consistent with genuine intermittent flakiness rather than a one-off. `package.json`/`package-lock.json` remain byte-unchanged throughout. Validate definitively by getting two consecutive clean runs of `npm audit --audit-level=high`; if any run reports anything other than 0 vulnerabilities, treat that as a regression to fix immediately, not as evidence this Assumption was wrong (the dependency tree has not changed since 22:12:22).
  - Status: Resolved - this Assumption's own validation criterion ("two consecutive clean runs of `npm audit --audit-level=high`") is now met: the same concurrent session (`session_01C9GA2bo9c2ebAWTo3YsaNb`) recorded three consecutive clean `npm run verify` wrapper invocations with no intervening failure - 23:55:53, then 00:15:49 and 00:28:47 after midnight UTC - all against this same byte-unchanged dependency tree (see `docs/evidence/2026-09-03/verify-chain.txt` and `docs/evidence/2026-09-04/verify-chain.txt`). A Codex review on that session's own PR pointed out the criterion had been satisfied while this entry still read Open, prompting this update.

## 2026-09-03 - Make the Cipher Gate certify the right entry, and the Proof Tape admit stale evidence

- Date: 2026-09-03
- Decision: Tie-break Cipher Gate selection on document position so the newest same-date entry wins, and mark evidence files older than the current run's `chamber-lock.json` in both `proof-tape.json` and `proof-tape.md`. Guard both scripts so importing them does not run them.
- Context: Both gates could report success while describing something other than the change under test. `scripts/cipher-gate.mjs` sorted blocks by date alone and took the last element; `Array.prototype.sort` is stable, so equal dates kept document order and the last element was the last same-date block. `DECISIONS.md` is newest-first, so that is the *oldest* entry. On a day carrying two Cipher Gate entries the gate therefore validated the older entry's evidence paths, wrote that entry into `cipher-gate.json`, and exited 0 without ever checking the new entry's evidence - a green `cipher-gate` run was not proof that the newest Cipher Gate entry had been validated. Separately, `scripts/proof-tape.mjs` inventories whatever files sit in the evidence directory. `verify-chain.txt` is hand-written and nothing regenerates it, so a later `npm run verify` refreshes `verify.txt` and `test.txt` around it and the tape lists all three with no indication that one describes a different run. Both were found by Codex review on PR #255, where the first fired for real: the artifact certified the 2026-09-03 security-header entry while the change under review was a contract change, and the tape carried a 05:10/817-test transcript beside a 09:08/816-test one.
- Alternatives: Sort by a parsed timestamp rather than position; rejected because Cipher Gate entries carry a date only, so same-day entries have no time to order by and position is the sole real signal. Require unique dates; rejected as it would forbid two decisions in one day, which this repository does routinely. Mark against `verify.txt` rather than `chamber-lock.json`; rejected after trying it - `chamber-lock.mjs` runs about a minute *before* `verify-runner.mjs` in the same chain, so the run flagged its own `chamber-lock.json` as predating itself. `chamber-lock.json` is the first artifact `npm run verify` writes (`audit:gate` writes none), so its mtime marks the start of the chain and everything the run produces is at or after it. Fail the verify chain on a stale artifact rather than flagging it; rejected because an older artifact is frequently deliberate - a red proof captured earlier in the same session is not wrong - so failing would produce false positives on correct runs, and the actual defect was silence, not tolerance. Delete `verify-chain.txt` and have `verify-runner.mjs` capture the outer chain instead; a genuine option and arguably the better end state, but it means restructuring the runner to invoke itself, which is a larger change than the reporting defect warrants and would be its own decision.
- Consequences: `parseCipherBlocks` now records `position`, and `selectLatestCipherBlock` is exported and unit-tested rather than inline. `proof-tape.json` gains `runMarker` (`chamber-lock.json`) and `filesPredatingRun`, and `proof-tape.md` marks each such file inline and closes with a short note naming them - so a reader sees which artifacts belong to the run being summarized. `predatesRun` is `null`, not `false`, when the marker is missing or a timestamp will not parse: the tape reports "unknown" rather than claiming freshness it never checked. Both scripts only execute when they are the entry point; without that guard, importing either to unit-test its helpers ran the whole gate and rewrote its artifact as a side effect of the test run, which is how this change's own first test attempt dirtied `cipher-gate.json`.
- Revisit criteria: If Cipher Gate entries ever gain a time component, order on that instead of position and drop the newest-first assumption, which is a convention this repository follows but does not enforce. If `verify-chain.txt` is ever generated rather than hand-written, the marking becomes redundant for it and should be reassessed rather than left as decoration. If a stage is ever added to `npm run verify` ahead of `chamber-lock.mjs` that writes an artifact, move the marker to that stage.
- Self-critique: The riskiest assumption is that `DECISIONS.md` is newest-first, since the tie-break is meaningless if it is not. Checked rather than assumed: the date headings run 2026-09-03, 09-03, 09-03, 08-26, 08-26, 08-25, 08-24, 08-24, 06-07, 06-06, 06-05, 05-15 in document order, strictly descending. It is a convention, not an invariant - nothing enforces it - which is why the revisit criteria name it. The second risk is that flagging without failing is too weak to matter; that is a deliberate trade, and the note in `proof-tape.md` is written to be read by the same non-coder audience the tape exists for rather than buried in JSON. The marking earned itself on the first real run: it flagged `build.txt` and `lint.txt`, two artifacts left in `docs/evidence/2026-09-03/` by an earlier run today, which nothing had previously said anything about. What this change does not do: it does not make `verify-chain.txt` fresh, and the copy in this commit is regenerated by hand as before.
- Forced widening (SonarCloud, on the first CI run): the quality gate failed on two conditions, both genuinely this change's. `C Reliability Rating` was one MAJOR bug - `selectLatestCipherBlock` used `reduce()` with no seed. An early return made it unreachable in practice, but the rule is about the call, and an explicit `[...dated].sort(...)` reads better anyway and stops mutating the caller's array, which the old code did. `7.0% Duplication on New Code` was subtler and is why this change is wider than its title: `toDateFolder` and `fileExists` were copy-pasted into nine and seven scripts respectively, byte-identical in every one. Sonar never counted it because the copies were old; adding JSDoc above two of them made those lines new and the long-standing duplication finally registered. Deduplicating only the two files that tripped the gate would have moved the same block into a third place, so all three helpers - plus the new `isEntryPoint` - now live in `scripts/evidence-reporting.mjs` and every script imports them.
- Evidence: docs/evidence/2026-09-03/evidence-gate-selection-red-proof.txt; docs/evidence/2026-09-03/verify.txt; docs/evidence/2026-09-03/test.txt; docs/evidence/2026-09-03/verify-chain.txt
- Plan:
  - Goal: Stop two gates from reporting success while describing the wrong run or the wrong entry.
  - Seams: None registered in `docs/seams.md`. This changes verification tooling under `scripts/` only; no contract, adapter, mock, fixture or probe is touched.
  - Files: `scripts/cipher-gate.mjs`, `scripts/proof-tape.mjs`, `scripts/evidence-reporting.mjs`, and the seven other scripts migrated onto its shared helpers (`assumption-alarm`, `chamber-lock`, `clan-chain`, `install-githooks`, `rewind`, `seam-ledger`, `shaolin-lint`, `verify-runner`), `tests/unit/evidence-gate-selection.test.ts`, `tests/unit/evidence-reporting.test.ts`, `DECISIONS.md`, and the regenerated `docs/evidence/2026-09-03/` artifacts including `evidence-gate-selection-red-proof.txt`.
  - Commands: `npm run check`, `npm run lint`, `npm test`, `npm run verify`, `node scripts/cipher-gate.mjs`, `node scripts/assumption-alarm.mjs`.

- Cipher Gate:
  - Date: 2026-09-03
  - Seams: None registered in docs/seams.md - this change is verification tooling under scripts/ and creates no contract, adapter or mock
  - Evidence: docs/evidence/2026-09-03/evidence-gate-selection-red-proof.txt; docs/evidence/2026-09-03/verify.txt; docs/evidence/2026-09-03/test.txt; docs/evidence/2026-09-03/verify-chain.txt
  - Summary: Cipher Gate selection now tie-breaks on document position so the newest same-date entry is the one validated, instead of the stable sort silently certifying the oldest. Proof Tape marks evidence older than the current run's chamber-lock.json - the first artifact the verify chain writes - in both its JSON and Markdown output, reporting unknown rather than fresh when it cannot tell. Both scripts run only as entry points so importing them for tests no longer rewrites their artifacts.
  - Risks: The tie-break depends on DECISIONS.md staying newest-first, a convention nothing enforces; if an entry is ever appended at the bottom it will be treated as the oldest for its date. Stale evidence is flagged, not failed, so a reader who ignores the note still gets a tape listing an artifact from a different run. Nine scripts now share toDateFolder and fileExists from evidence-reporting.mjs, so a change there reaches every evidence gate at once - the copies were byte-identical, and each script was run standalone and through the full chain, but the blast radius is real.

## 2026-09-03 - Give `/api/meechie-studio-text` its own Vercel function budget

- Date: 2026-09-03
- Decision: Add a per-route `export const config = { maxDuration: 230 }` to `src/routes/api/meechie-studio-text/+server.ts`, leaving the global `maxDuration: 120` in `svelte.config.js` (and every other route) unchanged.
- Context: `meechie-studio-text-pipeline.ts`'s `runProviderExchange` can make two sequential `ProviderAdapterSeam.createChatCompletion` calls (the initial attempt plus one bounded correction retry when the model's JSON fails to parse or match schema), each able to run the full `CHAT_TIMEOUT_MS = 110_000` single-attempt budget - a genuine ~220s server-side worst case. PR #247 (2026-09-03, this same day's earlier run) already raised the *client-side* `POST_JSON_TIMEOUTS_MS.studioText` budget in `http-client.ts` to 230s for exactly this reason, but nothing had told the Vercel platform about the longer budget: the global 120s (set 2026-08-26, scoped to image generation - see that day's Cipher Gate above) would still kill a legitimately slow-but-succeeding two-attempt exchange mid-second-call, making PR #247's client-side fix unreachable in production.
- Alternatives: Raise the global `maxDuration` instead of a per-route override; rejected because every other route's true worst case is bounded by a single ~120s provider call (confirmed for `generate`, `tools`, `wig-try-on`), so a blanket 230s would hide a real regression in any of those routes behind a budget they don't need. Shorten `studioText`'s correction retry instead of raising the budget; out of scope for a quick, code-only fix and changes product behavior (fewer chances to self-correct malformed output) rather than just infrastructure.
- Consequences: `studioText` can now legitimately run up to 230s without the platform killing it before the client-side timeout would. No other route's budget changed. Verified in the built output, not just by reading config: `npm run build` produces `.vercel/output/functions/api/meechie-studio-text.func/.vc-config.json` with `"maxDuration": 230`, while sibling routes (`generate.func`, etc.) stay at `120`.
- Self-critique / seam-workflow scope: this changes observable behavior (a request between 120s and 230s that used to be killed by the platform now completes), which is why it's recorded here rather than treated as a pure comment/doc change. It is not run through the full contract/probe/fixture/mock/adapter workflow, because it does not touch any seam's contract, mock, fixture, or adapter code - `MeechieStudioTextSeam`'s input/output schema, error taxonomy, and the `ProviderAdapterSeam` it calls through are all byte-for-byte unchanged; only the platform's own function-lifetime enforcement moved. This mirrors PR #247's client-side `studioText` timeout-constant change earlier today, which was reasoned through the same way for the same route. If a future change to this route ever needs a new fixture, probe, or contract shape, that change goes through the full workflow on its own merits - this entry does not create a standing exemption for anything beyond the platform time budget.
- Revisit criteria: If `runProviderExchange`'s call count or `CHAT_TIMEOUT_MS` changes, recompute the worst case and re-check both this budget and the client-side one in `http-client.ts` together - they must stay reconciled, which is the gap this entry closes.

## 2026-09-03 - Owner ruling: merge on green, do not ask

- Date: 2026-09-03
- Decision: The "Merge When The Gates Are Green" rule in `AGENTS.md` stands and is reaffirmed by the owner. A pull request meeting its four conditions **and tripping none of its four exclusions** is merged without asking. This entry does not restate or replace the rule: `AGENTS.md` is the source of truth, and its exclusions are load-bearing - an unresolved human change request, a schema/contract/data migration, an open Assumption covering the shipped behaviour, or an owner hold each stop the merge no matter how green CI is. A migration can satisfy all four numbered conditions and must still not be auto-merged. Two clarifications are added to condition 1, both drawn from failures on PR #244: CI status must be read on **both** surfaces - check runs and commit statuses - and a red check established as not that pull request's failure, by matching failure signature rather than check name, does not block the merge.
- Context: The owner said, in his own words, "go ahead and merge whats ready to be. can you add a note somewhere to always merge when ci is green and review comments are done." The rule he is asking for already existed, added 2026-08-25 for exactly this reason and deleted the same day by a concurrent session. It was not followed on PR #244: that pull request sat green, with every review comment answered, while the agent reported status and waited to be told to merge. Asking is the defect the rule exists to prevent, so the useful response was not a new note but an owner ruling recorded where `AGENTS.md` demands one before the rule can be removed again.
- Alternatives: Add a fresh note in `CLAUDE.md`; rejected because `CLAUDE.md` states it does not repeat governance and defers it to `AGENTS.md`, so a copy there would be a second source of truth one edit from drifting. Add nothing and simply follow the existing rule; rejected because the rule has already been silently deleted once, and an owner ruling in `DECISIONS.md` is the specific thing `AGENTS.md` requires to make that harder.
- Consequences: Future sessions merge without a permission round-trip, which is the point. The two clarifications close real gaps rather than hypothetical ones. On #244 every check run passed while the `Vercel` **commit status** was failing on two consecutive heads, and that failure was reported to the owner as green - reading one surface and not the other. Separately, `Rosentic - Conflict Detection` is red on every pull request in this repository because it compares the whole open-branch backlog pairwise; without the second clarification, that single check would block every merge indefinitely.
- Revisit criteria: If a red check that is genuinely a pull request's own failure is ever waved through under the "not this pull request's" clause, tighten it to require the establishing comment to name the base-branch or unrelated-head run that reproduces it.
- Plan (governance-only change, per the `AGENTS.md` "Only Exception" clause):
  - Goal: Record the owner's reaffirmation of the merge-on-green rule where `AGENTS.md` requires it, and close two gaps in condition 1.
  - Seams: None. No seam contract, adapter, mock, fixture or probe is touched, and `docs/seams.md` is unchanged.
  - Files: `AGENTS.md`, `DECISIONS.md`, and the regenerated `docs/evidence/2026-09-03/` artifacts.
  - Commands: `npm run verify`, `node scripts/cipher-gate.mjs`, `node scripts/assumption-alarm.mjs`.
  - How behaviour stays unchanged: the change is prose in two Markdown governance files. No file under `src/`, `tests/`, `contracts/`, `fixtures/`, `scripts/` or any configuration is modified, so no application or build behaviour can differ. The full suite is run anyway, as the evidence records, to demonstrate that rather than assert it.
- Self-critique: The riskiest part of this ruling is the second clarification - "established as not this pull request's failure" is a judgement, and a wrong judgement merges a genuinely broken change. The mitigation is that it demands a matching failure *signature* - the same error, files and branch pair - written on the pull request first, where it can be checked afterwards, rather than being a private call. The first draft of this clause said only "reproducing on the base branch or on unrelated heads", which would have accepted a matching check *name* as proof; review caught that, and the distinction matters because `.github/workflows/rosentic.yml` already passes `GITHUB_TOKEN` to scope that check to active branches, so a Rosentic failure here is not automatically the historical whole-backlog one. On #244 that meant a comment naming the failing check, the branch pairs it cited, the files this change does not touch, and two unrelated heads showing the identical failure.

## 2026-09-03 - Declare a security policy at the edge, and gate the dependency tree

- Date: 2026-09-03
- Decision: Add `src/hooks.server.ts` to set X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy and Strict-Transport-Security on every server-rendered response; add `vercel.json` to carry the same baseline onto the filesystem-served paths the hook cannot reach; declare a Content Security Policy through `kit.csp` in `svelte.config.js` rather than by hand; resolve every open npm advisory; and add `audit:gate` (`npm audit --audit-level=high`) as the first step of `npm run verify`.
- Context: The deployed application sent exactly one security header, `Strict-Transport-Security`, and it came from Vercel's edge rather than from this repository. Nothing declared framing policy, so the site was embeddable in any third party's iframe while accepting selfie uploads. A lockfile audit reported ten advisories - one critical, six high - across the build chain, and `npm run verify` had no step that would ever notice. The Content Security Policy is declared through `kit.csp` and not in the hook because SvelteKit injects its own inline hydration script and must be free to attach a nonce to it; hand-writing that header would break hydration the next time Kit changed that markup.
- Alternatives: Write the Content Security Policy directly into `hooks.server.ts` alongside the other headers; rejected for the nonce reason above. Restrict `audit:gate` to production dependencies (`--omit=dev`), which would essentially never fire spuriously since production carries only `pdf-lib` and `zod`; rejected because the rot this gate exists to catch was entirely in the build chain, and a gate that cannot see it is decoration. Take PR #174's jump to vite 8.0.16; unnecessary, because the advisory is fixed within the existing `^7` range at 7.3.6. Apply the `vercel.json` headers to `/(.*)`; rejected because that would also match document responses the hook already covers, and a repeated `X-Frame-Options` is ignored outright by some browsers - the sources therefore name only filesystem-served paths.
- Consequences: `style-src-attr 'unsafe-inline'` is granted. Four hand-written inline `style` attributes exist - the verdict colour in `rate-his-excuse`, a width in `StudioPreviewPanel`, and the hero background and mode-card CSS variables in `StudioHero` - and an element attribute cannot carry a nonce; once SvelteKit puts a nonce on `style-src`, browsers ignore `'unsafe-inline'` there. Isolating the allowance to the attribute directive keeps `<style>` elements strictly governed. Removing all four would let the allowance go. The hook and `vercel.json` now split one guarantee across two files and must be changed together. Separately, `audit:gate` can turn CI red with no code change when a new advisory lands against an existing dependency; the intended response is to update the dependency, not to lower the threshold. It also puts a registry round-trip in front of every local gate, so a registry outage stops `verify` before any local check runs. `npm audit fix` also carried @sveltejs/kit from 2.63.1 to 2.70.3, which is a wider change than the advisories strictly required.
- Revisit criteria: If `audit:gate` blocks work on an advisory with no available fix, record the waiver as an Assumption rather than weakening the gate. If a registry outage blocks `verify` in practice rather than in theory, move the audit behind a seam with an explicit registry-failure contract instead of removing it. If all four inline style attributes are removed, drop `style-src-attr`. If SvelteKit ever serves static assets through the hook, fold `vercel.json` back in.
- Self-critique: The riskiest assumption was that this policy would not break the live site, since a wrong Content Security Policy is invisible until a real browser runs it. It was tested rather than reasoned about: the production build was served and driven with Chromium across all six routes, collecting `securitypolicyviolation` events, and none fired. A control confirmed the policy was actually being enforced during that run - an injected image from a disallowed origin fired `img-src`. Two claims in the first version of this entry were wrong and are corrected above: it said two inline style attributes when there are four, because the search used to count them matched only the `style="..."` form and missed `style={...}`; and it said the hook covered every response, when the adapter's route table places `{"handle":"filesystem"}` ahead of the SSR rewrites, so `/service-worker.js` and `/_app` assets were measured returning 200 with no security headers at all. What remains unproven: `vercel.json` header application is Vercel platform behaviour that no local run exercises, and the Google Fonts directives are proven by reading the served header rather than by watching a font render - both are recorded as Assumptions below. That unprovability already cost one broken deployment: the first version of `vercel.json` carried a `"//"` key to satisfy the file-header requirement, and Vercel rejected the whole file - "should NOT have additional property `//`" - failing the preview deploy on two heads before it was caught. `vercel.json` takes no comment of any kind; its rationale lives in the `src/hooks.server.ts` header instead.
- Evidence: docs/evidence/2026-09-03/verify.txt; docs/evidence/2026-09-03/test.txt; docs/evidence/2026-09-03/proof-tape.md; tests/unit/hooks-server.test.ts
- Merge safety under the open Assumptions: `AGENTS.md` blocks auto-merge while an open Assumption covers shipped behaviour, and offers the alternative of stating why the change is safe without validation. That alternative is taken here, because neither Assumption *can* be resolved first - both require requesting the deployed production site, which only exists after this merges, and the pull request's own preview is behind deployment protection that 302s every request to `vercel.com/sso-api`. Waiting would be waiting for something that cannot happen. Both are safe to ship unvalidated for the same structural reason: neither can regress below current behaviour. If the `vercel.json` rules do not match, the filesystem-served paths keep exactly the headers they carry today, which is none - the floor is the status quo, and adding response headers cannot break asset serving. If the font directives are wrong, the Google Fonts stylesheet is refused and the site falls back to the next family in each stack: cosmetic, visible on first load, and revertible in one commit. Including those directives is also strictly safer than omitting them, since `default-src 'self'` would otherwise block the fonts outright. The one failure mode that could have broken the deployment - a malformed `vercel.json` - is no longer hypothetical: it happened on `0a8facb`, was caught by the Vercel build rather than by users, and is fixed. Each Assumption names the exact post-deploy request that closes it.

- Cipher Gate:
  - Date: 2026-09-03
  - Seams: None registered in docs/seams.md - this change adds HTTP response headers and a Content Security Policy at the transport boundary and a dependency-audit step, and creates no contract, adapter or mock
  - Evidence: docs/evidence/2026-09-03/verify.txt; docs/evidence/2026-09-03/test.txt; docs/evidence/2026-09-03/proof-tape.md; docs/evidence/2026-09-03/chamber-lock.json
  - Summary: Added repository-owned baseline security headers for server-rendered responses plus a scoped vercel.json for filesystem-served paths, a SvelteKit-managed nonce-aware Content Security Policy verified in Chromium across all six routes with a positive enforcement control, resolution of all ten npm advisories within existing semver ranges, and an npm audit gate as the first step of the verify chain.
  - Risks: The audit gate can redden CI with no code change when a new advisory lands, and it puts a registry round-trip ahead of every local check, so a registry outage stops verify early. The baseline is now split between hooks.server.ts and vercel.json and the two can drift. vercel.json header application was not exercised locally. style-src-attr 'unsafe-inline' remains granted for four inline style attributes.

- Assumption:
  - Date: 2026-09-03
  - Seams: None registered - Content Security Policy font directives at the transport boundary
  - Statement: `style-src https://fonts.googleapis.com` and `font-src https://fonts.gstatic.com` admit the fonts the layout actually requests, so the site renders in its intended typefaces under the new policy.
  - Validation: The probe was blocked - every browser in the verification runtime returned ERR_CONNECTION_RESET for fonts.googleapis.com, and the same failure reproduced on an unmodified `main` worktree built and served identically, so it is that runtime's egress and not the policy. The directives are therefore proven only by reading the served header. Validate by loading the deployed site after this merges and confirming the Google Fonts stylesheet returns 200 with no securitypolicyviolation event.
  - Status: Open - pending first deploy.

- Assumption:
  - Date: 2026-09-03
  - Seams: None registered - static-asset response headers served by the Vercel edge
  - Statement: The `headers` rules in `vercel.json` attach X-Content-Type-Options, X-Frame-Options and Referrer-Policy to the filesystem-served paths that `src/hooks.server.ts` never sees.
  - Validation: Not exercised locally - `vite preview` does not read `vercel.json`, so no local run can confirm it. Verification against the pull request's own Vercel preview was attempted and is also impossible: the preview is behind deployment protection and every request 302s to `vercel.com/sso-api`, so no response body or header of the app itself is reachable unauthenticated. The gap being closed is nonetheless confirmed on live production, which does not yet carry this change - `https://meechiescoloringbook.vercel.app/service-worker.js` returns 200 with no security headers at all. Validate after this merges and deploys to production, not on a preview: request `/service-worker.js` and an `/_app/immutable` asset from `https://meechiescoloringbook.vercel.app` and confirm X-Content-Type-Options, X-Frame-Options and Referrer-Policy are present.
  - Status: Open - pending first deploy.

## 2026-08-26 - The wig try-on asks for a try-on, and the generation model moves on evidence

- Date: 2026-08-26
- Decision: Rewrite the WigTryOnSeam prompt to request a photorealistic try-on rather than a coloring-book illustration, feed it the catalogue name and style that already crossed the seam, and explicitly discount the pink neon lighting in the product photography. Separately, move IMAGE_MODEL from `grok-imagine-image` to `grok-imagine-image-2.0` and set an explicit Vercel `maxDuration`.
- Context: The owner confirmed the wig section was never meant to emit coloring pages - that is the separate studio flow, where a described situation becomes a Meechie response and then a page. The wig prompt asked for "one bold black-and-white coloring-book illustration", so the feature contradicted its own UI copy ("See what you look like walking in"). Four live calls established the fix: a photorealistic prompt alone returned rose-pink hair for a wig named Honey Blonde Bombshell, and adding "match the colour faithfully" did not correct it; naming the wig in words and telling the model to ignore the pink studio lighting did, in one shot. Every packaged wig photo is shot under magenta backlighting, and the model was reading that cast as hair colour.
- Alternatives: Change the UI copy to admit it returns a coloring page; rejected because the owner stated the intended behaviour and the copy was right. Neutralise the neon in the packaged photography; rejected as more expensive than a sentence of prompt and it would discard product imagery the affiliate links depend on.
- Consequences: `wigName` and `wigStyle` finally do something. They were on the contract, required by the validator, and populated by the pipeline since the seam's first commit, and the adapter had ignored them the whole time - a field can satisfy every schema in the codebase and still be dead. A pipeline test now asserts they reach `tryOn`, which is the check that was missing.
- Revisit criteria: If a future catalogue ships neutrally-lit photography, the lighting sentence becomes unnecessary and should be removed rather than left as folklore.
- Self-critique: The prompt now depends on catalogue text being accurate. A wig whose `name` and `color` disagree with its photograph will produce a confident wrong answer, and nothing in the app checks that they agree.

- Cipher Gate:
  - Date: 2026-08-26
  - Seams: WigTryOnSeam, ImageGenerationSeam
  - Evidence: docs/evidence/2026-08-26/rewind-WigTryOnSeam.txt; docs/evidence/2026-08-26/test.txt; docs/evidence/2026-08-26/verify.txt; docs/evidence/2026-08-26/proof-tape.md
  - Summary: Replaced the wig try-on's coloring-book prompt with a photorealistic try-on prompt built from the catalogue name and style, discounting the product photography's neon cast; upgraded the image-generation pin to grok-imagine-image-2.0 after measuring both models against the live API; and set a function budget that matches the adapter's own 120s timeout.
  - Risks: grok-imagine-image-2.0 is twelve to eighteen times slower than the model it replaces - 5.2s and 5.7s against 71.2s and 93.6s, measured twice each. That leaves roughly 26s of headroom under the 120s budget, so a slower-than-observed response will surface as a timeout rather than a page. The old model was replaced because it hallucinated the page's list text into near-misses of the title, which is unusable, so the trade was made knowingly. 2.0 also left the item list as blank write-in lines in one of two samples, which is usable but not what the prompt asked for; the image prompt gives no guidance on item content and should be strengthened before that is blamed on the model.

## 2026-08-26 - Meter every billable route, with a degraded store instead of an unauthorized one

- Date: 2026-08-26
- Decision: Wire one required rate-limit gate through all six billable routes, threading SvelteKit's own `event.getClientAddress`. Select the store by configuration: durable Upstash when all three settings are valid, a bounded in-process fixed window when all three are absent, and a fail-closed 503 when the set is partial or invalid. Charge after local validation and immediately before the first billable provider call, and give `/generate` an explicit required precharged mode rather than letting it and the image pipeline both charge.
- Context: R0 built a complete, reviewed durable limiter and called it from no route, so production had no rate limiting at all — verified directly against the deployed application. Wiring it fail-closed with no durable store provisioned would have turned every AI request into a 503 and taken the live app down, and provisioning that store (ticket R2) is not authorized.
- Alternatives: Fail closed with no fallback; rejected because it breaks a working deployment to satisfy a ticket. An enable/disable switch; rejected previously and again here, because it permits unmetered provider calls and is the exact bypass this work exists to prevent. Charging per variation inside a loop; rejected because a mid-request denial bills a caller for work already in flight.
- Consequences: Degraded mode still meters every call at the same 20/min text and 8/min image budgets, and is weaker only in that N serverless instances allow at most N times the budget. No input can express "no quota" — the gate is a required dependency and the precharged mode is a discriminated union, so an unmetered path fails to typecheck rather than failing silently. Module-scope deps presets carry only the adapter half, because a preset has no event and therefore cannot carry a gate.
- Revisit criteria: Replace degraded mode with the durable store as soon as R2 is authorized and the three settings are configured; no code change is required, only configuration.
- Self-critique: The shared fallback bucket is a single global budget, so any future change that makes address resolution fail turns a partial degradation into a near-total outage. That risk is now pinned by tests rather than left to inspection.

- Assumption:
  - Date: 2026-08-26
  - Seams: RateLimitSeam
  - Statement: The durable Upstash-backed RateLimitSeam adapter behaves in production as its fixtures and fake-store tests describe. No live durable store has been provisioned or contacted, so atomic INCRBY/PEXPIREAT semantics, timeout behaviour, and cross-instance sharing are proven only against a fake that models them.
  - Validation: Once R2 is authorized, configure UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN and RATE_LIMIT_IDENTITY_SECRET, then run the bounded non-billable allow/deny/reset acceptance sequence against a dedicated probe key and record redacted status, timing and TTL evidence.
  - Status: Open. Provisioning a durable store is infrastructure mutation and was not authorized by the owner; the earlier claim that it had been could not be substantiated. Degraded in-process metering is in force meanwhile, so the absence of this store reduces the strength of the limit but never disables it.

- Assumption:
  - Date: 2026-08-26
  - Seams: WigTryOnSeam
  - Statement: The configured xAI account accepts the exact two-image edit payload the production adapter sends to /v1/images/edits and returns a supported raster image.
  - Validation: Execute the single capped W11B acceptance call once, with no retry, and assert 200 plus non-empty supported raster output with secret-free evidence.
  - Status: Open. A live provider call spends money and was not authorized by the owner. Transport correctness is proven against a fake that asserts exact URL, headers, body, image order and model, and that no credential appears in any URL — but that is request compatibility, not account acceptance.

## 2026-08-25 - Reconcile the concurrent PR #228 head without widening repository authority

- Date: 2026-08-25
- Decision: Preserve the concurrent head's review-backed prompt, provider-message redaction, AppConfig default, and live-evidence repairs; strengthen its timeout change to a single provider-chat attempt; apply a single-line printable-text boundary plus the established 96-character route-title limit to titles; and share redaction with the fixture probe. Delete and gitignore its committed `.claude/settings.local.json`, remove its unrelated auto-merge rule, and record the owner's explicit merge hold in `HANDOFF.md`. Keep `DEFAULT_IMAGE_SIZE=1024x1024` in `.env.example`, but continue omitting the inactive `MAX_IMAGES_PER_REQUEST` example.
- Context: While a reviewed local repair was ready, another session advanced PR #228 from `5ad74a1` to `4c29e0f`. The compare-and-swap publish check stopped the older commit from overwriting that work. Review of the new head found valid fixes for the newest comments, plus a repository-wide `bypassPermissions` default and an instruction to merge green PRs without asking. Those authority changes were unrelated to the product repair and conflict with the owner's current instruction to pause before every merge.
- Alternatives: Force-push the already-tested local tree; rejected because it would discard concurrent work. Keep the permission and auto-merge files because CI was green; rejected because passing product tests do not validate repository authority changes. Drop the entire concurrent commit; rejected because it contains the strongest current fixes and traceable live prompt evidence.
- Consequences: PR #228 retains the current own-line exact-text boundary while newline-bearing titles are rejected before assembly; provider chat, including late `429`/`5xx` responses, is never retried; both runtime and probe fixture output share identifier redaction; the default image size and live image artifact remain; and repository permissions and merge authority stay unchanged. Publication must be a single descendant commit of the current head and must stop if it moves again. The PR remains open even after all gates pass.
- Revisit criteria: Add a repository-wide merge policy or permission default only through a dedicated, explicitly approved governance change; revisit the image-request-limit example only when the corresponding route behavior is part of the same reviewed slice.
- Plan:
  - Goal: Reconcile current PR #228 safely, close review findings, and leave it verified but unmerged.
  - Seams: ProviderAdapterSeam, PromptAssemblySeam, SpecValidationSeam, AppConfigSeam, DriftDetectionSeam, ImageGenerationSeam.
  - Files: `plan.md`, `DECISIONS.md`, `.env.example`, `.gitignore`, `AGENTS.md`, `HANDOFF.md`, `.claude/settings.local.json`, `contracts/spec-validation.contract.ts`, the `src/lib/{adapters,seams,core}/**/*` paths enumerated in the active plan, `scripts/verify-runner.mjs`, the named provider/prompt/drift/image fixtures and probes, focused tests, and `docs/evidence/2026-08-25/*`.
  - Commands: focused Vitest, six seam rewinds, check, lint, full tests, build, verify, Cipher Gate, Assumption Alarm, diff check, remote-head compare, and current-head CI.
- Self-critique: The local reconstruction intentionally lacks the concurrent commit's binary JPEG object, so local gates prove the code and text fixtures while the final GitHub tree and current-head CI must prove the preserved binary evidence path. A remote-head race or failed current-head check blocks publication.

## 2026-08-24 - Bind optional secondary prompt instructions to their value

- Date: 2026-08-24
- Decision: Emit the secondary exact-text instruction and `footerItem` label as one conditional pair in the canonical PromptAssemblySeam adapter, version the changed prompt contract as `v3`, and make the legacy adapter a typed compatibility re-export. Keep `TYPOGRAPHY:` immediately after the title when no footer exists, and enforce that input/result relationship with a fixture-backed execution validator. Restore `.env.example` as plain text, omit its inactive image-request-limit setting, and document that Gemini 429 quota exhaustion is resolved through provider quota/billing, not an adapter change.
- Context: The adapters always emitted `[Secondary line EXACT — omit if none.]` but conditionally emitted its value. Without a `footerItem`, the next physical line was `TYPOGRAPHY:`, which image generation could interpret as the requested secondary page text. Separately, `.env.example` was committed as a base64 payload, so the documented copy workflow produced unusable configuration. The live wig try-on failure is a provider 429 with an already modeled error path.
- Alternatives: Remove the secondary instruction for every prompt; rejected because footer-bearing pages still need an explicit exact-text boundary. Add a blank placeholder; rejected because blank physical lines do not give the model a stronger boundary. Change WigTryOnSeam retry/error behavior; rejected because retries or wording cannot replenish exhausted quota and could repeat a billable request. Wire `MAX_IMAGES_PER_REQUEST` into route validation here; rejected as unrelated behavior expansion when removing the inactive example resolves the configuration claim.
- Consequences: Title-only prompts cannot shift `TYPOGRAPHY:` into the absent secondary slot, footer-bearing prompts retain their existing instruction/value pair, downstream results identify the changed prompt as template `v3`, the checked-in fault fixture proves the boundary through its mock, the flat adapter no longer duplicates the canonical implementation, local configuration can be copied from `.env.example` without advertising an unenforced limit, and the operational quota repair remains outside repository code.
- Revisit criteria: Revisit the prompt structure if a provider supports structured text/layout fields instead of a flat prompt, or revisit WigTryOnSeam only if a reproducible 429 occurs while the configured Gemini project has confirmed available quota.
- Plan:
  - Goal: Repair the prompt text boundary and plain-text environment example without disguising a billing incident as a code defect.
  - Seams: PromptAssemblySeam. WigTryOnSeam is verification-only and unchanged.
  - Files: `plan.md`, `DECISIONS.md`, `CHANGELOG.md`, `.env.example`, both prompt-assembly fixtures, both PromptAssemblySeam adapters/tests, `docs/evidence/2026-08-24/*`, and UTC-generated `docs/evidence/2026-08-25/*`.
  - Commands: focused red/green Vitest, `npm run rewind -- --seam PromptAssemblySeam`, plain-text `.env.example` assertion, `npm run lint`, `npm run build`, `npm run verify`, `npm run cipher:gate`, and `git diff --check origin/main...HEAD`.
- Self-critique: The main regression risk is accidentally removing secondary text from footer-bearing specs or breaking the legacy contract type while consolidating adapter ownership. The sample fixture proves the pair remains, the title-only fixture proves it is omitted, the semantic fault fixture proves the mock is rejected, and the legacy contract suite proves the compatibility re-export remains valid.

- Cipher Gate:
  - Date: 2026-08-25
  - Seams: PromptAssemblySeam
  - Evidence: docs/evidence/2026-08-24/prompt-assembly-red.txt; docs/evidence/2026-08-24/prompt-assembly-fixture-red.txt; docs/evidence/2026-08-24/prompt-assembly-green.txt; docs/evidence/2026-08-24/env-example-check.txt; docs/evidence/2026-08-25/rewind-PromptAssemblySeam.txt; docs/evidence/2026-08-25/rewind-PromptAssemblySeam(self-contained).txt; docs/evidence/2026-08-25/verify.txt; docs/evidence/2026-08-25/test.txt
  - Summary: Made the optional secondary exact-text marker/value atomic in both PromptAssemblySeam adapters, versioned the changed prompt as `v3`, and restored the environment template as readable text.
  - Risks: Live wig try-on success remains unproven until the configured Gemini project has available quota; no code path can restore provider billing state.

## 2026-08-24 - Cut the Meechie voice to one owner-ruled list

- Date: 2026-08-24
- Decision: Replace the three overlapping Meechie quote lists with a single 20-line list in `voice-pack.ts`, tiered `canon` (5) and `approved` (15), and have every prompt read from it.
- Context: Meechie lines lived in three places that had drifted apart: the `quotes` array (49 entries), `tone.samples` (26 entries), and a hardcoded block inside `MEECHIE_SYSTEM_PROMPT`. Six lines existed in conflicting wordings across them, including three versions of the door line and two of the stolen-shit line. The `coloringPageReady` flag read like an output gate but actually selected eight `responses.quotes` to append after all 26 `tone.samples`. Every selected quote was already present exactly in `tone.samples`, so the old tool prompt contained 34 physical examples / 30 exact-distinct examples; it did not exclude those eight lines. The owner reviewed all 82 stored entries and ruled on each.
- Alternatives: Keep all 49 and only dedupe wordings; rejected because most entries were generated pastiche the owner ruled out (an eleven-variant "one more X and I'm at your family Y" formula, six lines using the "it's not X, it's Y" structure the pack's own `donts` bans). Keep the metadata fields and fix the filter; rejected because `category`, `rawness`, `thirdPersonUsage`, `modeFit`, `defaultMode`, `coloringPageReady`, and `visualMotifs` had no consumer other than the filter being removed.
- Consequences: `MeechieQuoteSchema` is now `{ tier, id, text }`. `tone.samples` derives from the same array, so the two cannot drift. `tone.dos` is empty — four of its six lines were promoted into the list and two were ruled out — so the prompt no longer emits a "RULES:" section. Both tool adapters intentionally move from 34 physical / 30 exact-distinct prompt examples to the 20 owner-ruled lines. The studio prompt moves from its hardcoded seven examples to the same 20-line list. The quote schema and the tool system-prompt builder each live in one module that both the legacy and self-contained layouts import, so neither was copied into two files. `DEFAULT_STUDIO_TEXT_OUTPUT` no longer previews a ruled-out line.
- Revisit criteria: Revisit if lines need per-mode targeting again (that is what `modeFit` did), or if canon and approved need to feed prompts differently.
- Plan:
  - Goal: One list, one wording, every consumer reading from it.
  - Seams: MeechieVoiceSeam, MeechieToolSeam.
  - Files: `src/lib/seams/meechie-voice-seam/voice-pack.ts`, `src/lib/seams/meechie-voice-seam/contract.ts`, `contracts/meechie-voice.contract.ts`, `contracts/meechie-quote.contract.ts`, `src/lib/core/meechie-system-prompt.ts`, `src/lib/adapters/meechie-tool-seam/index.ts`, `src/lib/adapters/meechie-tool.adapter.ts`, `src/lib/core/meechie-studio-text-pipeline.ts`, `src/lib/core/meechie-studio.ts`, `fixtures/meechie-voice/sample.json`, `fixtures/meechie-voice/malformed-pack.json`, `src/lib/seams/meechie-voice-seam/fixtures.ts`, `src/lib/seams/meechie-voice-seam/mock.ts`, `src/lib/seams/meechie-voice-seam/test.ts`, `tests/unit/meechie-tool-adapter.test.ts`, `tests/unit/meechie-studio.test.ts`.
  - Commands: `npm run verify`, `npm test`, `npm run rewind -- --seam MeechieVoiceSeam`, `npm run rewind -- --seam "MeechieVoiceSeam (self-contained)"`, `npm run rewind -- --seam MeechieToolSeam`, `npm run rewind -- --seam "MeechieToolSeam (self-contained)"`, `npm run check`, `npm run lint`. Note: `rewind` resolves a seam to the test file named in its `docs/seams.md` row, so the bare names run only the legacy flat tests; the `(self-contained)` rows are the ones covering the canonical seam folders where the red proof lives.
- Red proof: The pre-existing fault fixture only exercises an unknown `voiceId`, so it could not show that the new quote schema rejects a malformed pack. Two halves now cover it. (a) `src/lib/seams/meechie-voice-seam/test.ts` drives faulty quotes straight at `MeechieQuoteSchema` (missing/unknown tier, missing/empty id, missing/empty text, an extra field on a `.strict()` object, and the retired pre-migration shape). (b) The fixture-backed half that section 3 of `src/lib/seams/AGENTS.md` actually asks for: `fixtures/meechie-voice/malformed-pack.json` is a checked-in pack whose quotes still carry the retired shape, `createMalformedVoicePackMock()` serves it the way `createMeechieVoiceMock()` serves the good fixture, and the contract test runs the mock and requires `MeechieVoiceResultSchema` to reject what comes back, with the issue paths all landing under `responses.quotes`. Proven to bite by weakening the schema in stages: 18 pass -> tier optional and `.strict()` dropped -> 2 fail -> id optional and empty text allowed -> 7 fail -> tier enum widened to any string so every malformed quote parses -> 10 fail, including all three fixture-backed cases -> schema restored -> 18 pass. See docs/evidence/2026-08-24/voice-canon-red-proof.txt.
- Self-critique: The riskiest change is dropping the tool prompt from 34 physical / 30 exact-distinct examples to 20, all of them in a narrower register, while growing the studio prompt from seven to 20. Every canon line is explicit, so the model sees a rawer average than before and may pull generations harder in that direction. That is the intended effect, but it is worth watching the first authenticated generations. Regenerating `fixtures/meechie-voice/sample.json` from the pack rather than hand-editing means the fixture can no longer catch a mistake in the pack itself — the contract tests confirm adapter and mock agree, not that the content is right.

- Cipher Gate:
  - Date: 2026-08-24
  - Seams: MeechieVoiceSeam, MeechieToolSeam
  - Evidence: docs/evidence/2026-08-24/voice-canon-rewind-MeechieVoiceSeam-selfcontained.txt; docs/evidence/2026-08-24/voice-canon-rewind-MeechieToolSeam-selfcontained.txt; docs/evidence/2026-08-24/voice-canon-verify-ci.txt; docs/evidence/2026-08-24/voice-canon-verify.txt; docs/evidence/2026-08-24/voice-canon-full-tests.txt; docs/evidence/2026-08-24/voice-canon-red-proof.txt; docs/evidence/2026-08-24/voice-canon-rewind-MeechieVoiceSeam.txt; docs/evidence/2026-08-24/voice-canon-rewind-MeechieToolSeam.txt; docs/evidence/2026-08-24/voice-canon-check.txt; docs/evidence/2026-08-24/voice-canon-lint.txt; docs/evidence/2026-08-24/voice-canon-focused-tests.txt
  - Summary: Collapsed three drifted Meechie quote lists into one 20-line owner-ruled source and pointed every prompt builder at it.
  - Risks: Both required CI verify jobs passed on the final PR head `b660549`; the workflow reported 534 passing and one skipped. The owner-approved corpus change still needs representative authenticated generations because deterministic tests prove prompt propagation, not output quality.

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

- Cipher Gate:
  - Date: 2026-08-25
  - Seams: ProviderAdapterSeam, AppConfigSeam, ImageProviderConfigSeam, MeechieStudioTextSeam, MeechieToolSeam, ChatInterpretationSeam
  - Evidence: docs/evidence/2026-08-25/verify.txt; docs/evidence/2026-08-25/test.txt; docs/evidence/2026-08-25/proof-tape.md; docs/evidence/2026-08-25/seam-ledger.md; docs/evidence/2026-08-25/chamber-lock.json; docs/evidence/2026-08-25/rewind-ProviderAdapterSeam.txt; docs/evidence/2026-08-25/rewind-AppConfigSeam.txt; docs/evidence/2026-08-25/rewind-ImageProviderConfigSeam.txt; docs/evidence/2026-08-25/rewind-MeechieStudioTextSeam.txt; docs/evidence/2026-08-25/rewind-MeechieToolSeam(self-contained).txt; docs/evidence/2026-08-25/rewind-ChatInterpretationSeam.txt; fixtures/provider-adapter/PROVENANCE.md; tests/unit/provider-adapter-helpers.test.ts; tests/unit/probe-entrypoints.test.ts; probes/provider-adapter.probe.mjs; probes/chat-interpretation.probe.mjs
  - Summary: Pinned the xAI text and image model ids in the checked ESM module src/lib/core/models.js and removed every runtime read of XAI_TEXT_MODEL and XAI_IMAGE_MODEL. Plain JavaScript is intentional here: the documented provider probes run directly on the repository's Node 20 baseline and must import the same source without a TypeScript loader. Production had been pinned to grok-4-1-fast-reasoning, which xAI retired, so every text call returned HTTP 400 — killing verdict generation, all Meechie tools, and chat interpretation, and transitively blocking image generation because the page button requires a verdict first. The stale id lived in a deployment variable that silently overrode the code default, so a code-only change could not have fixed it. Text is now grok-4.6. The image model is deliberately left at grok-imagine-image: image generation was the one path still working during the outage, and a newer id could not be verified because the preview deployment sits behind Vercel SSO, so upgrading it would have risked trading a partial outage for a total one. Also widened ProviderAdapterSeam error parsing to read xAI's string-shaped `error` field, which had been discarded in favour of a bare "Bad Request" and is why the outage was invisible.
  - Risks: AppConfigSeam now supplies both model ids as constants rather than env values. Its schema requires both to be non-empty, so leaving them env-backed would have 500'd the wig try-on route (its only consumer) for any deployment that dropped the variables. The contract shape is unchanged. Changing a model id now requires a deploy rather than a dashboard edit — a deliberate tradeoff, since the dashboard path is what caused this outage. The checked-in provider fixtures were refreshed as authenticated live captures on 2026-08-25 and prove the probe's strict-schema chat plus image request; the open Assumption below is now limited to the larger deployed Meechie payload.

- Assumption:
  - Date: 2026-08-24
  - Seams: ProviderAdapterSeam, AppConfigSeam, MeechieStudioTextSeam, MeechieToolSeam, ChatInterpretationSeam
  - Statement: grok-4.6 answers POST /v1/chat/completions with the request shape this app sends, including the json_schema response_format.
  - Validation: Partially proven. The authenticated 2026-08-25 provider capture shows `grok-4.6` accepted the probe's strict `json_schema` request and returned `{"status":"OK"}`; `grok-imagine-image` also returned image data. The preview deployment is still behind Vercel SSO, so POST `/api/meechie-studio-text` with the full Meechie system prompt was not captured through the deployed app in this workspace.
  - Status: Open only for the deployed full-payload path — resolve by probing POST `/api/meechie-studio-text` on a reachable deployment and confirming `ok:true` with a non-empty verdict. If it fails, the response now carries xAI's real message rather than a bare "Bad Request", which names the next model to try. The separate image-model upgrade remains deferred: `grok-imagine-image` is now live-capture-proven, and any replacement belongs in its own authenticated probe-backed change.

## 2026-08-25 - Supersede the 2026-01-22 prompt-template lock (bracket notes)
- Date: 2026-08-25
- Decision: Remove the three literal bracket notes from the canonical prompt template, emit each drawable-text instruction followed by its value on a separate line and a self-terminating sentence, keep the legacy adapter as a typed re-export, and identify this combined prompt contract as template `v4`. All seven required headings and every required phrase are unchanged.
- Context: Supersedes the 2026-01-22 lock that froze the template "including literal bracket notes for drift checks" and incorporates merged PR #229's `v3` optional-footer boundary repair. That entry's own revisit criterion — "If canonical template fails to produce acceptable outputs" — has been met. Observed generated pages rendered the literal label "TYPOGRAPHY:" in bubble letters as a second line of page text. Root cause: `[Secondary line EXACT — omit if none.]` was emitted unconditionally while the value beneath it was conditional, so a spec with no footerItem left an empty slot and the image model drew the next physical line — the "TYPOGRAPHY:" heading — as the page's second line. The concurrent broader rewrite was based on `v2`; calling the integrated result `v4` preserves the already-merged version history.
- Alternatives: (a) Add negative-prompt lines naming the forbidden labels. Rejected: "no extra words" was already in the negative list and did not prevent the leak, and naming the labels risks drawing attention to them. (b) Wrap values in quote delimiters. Rejected because accepted input can itself contain quotes; the hostile `He Said "Go"` live case proves that own-line values preserve them without delimiter ambiguity. (c) Reorder sections so the text block is not followed by a bare heading. Rejected as a larger change than needed once the empty slot is closed; the terminator sentence achieves the same guarantee.
- Consequences: The bracket notes were addressed to a prompt author, not the model, so nothing that validates the prompt depended on them — verified by locating every enforcing file. `outline-only` and `easy to color` remain present via the always-emitted Vibe line. Prompt logic now has one owner; the flat adapter is a typed compatibility export. The checked-in semantic fault and execution validator prove that a title-only result cannot smuggle an extra drawable line before the terminator. The canonical prompt string remains duplicated across seven fixtures and one probe; all were regenerated from the adapter in this change, and `fixtures/drift-detection/fault.json` was regenerated with its intentional missing-NEGATIVE-PROMPT defect preserved.
- Revisit criteria: If a future template change reintroduces content between the drawable text block and the next heading.

- Cipher Gate:
  - Date: 2026-08-25
  - Seams: PromptAssemblySeam; DriftDetectionSeam; ImageGenerationSeam
  - Evidence: docs/evidence/2026-08-25/verify.txt; docs/evidence/2026-08-25/test.txt; docs/evidence/2026-08-25/proof-tape.md; docs/evidence/2026-08-25/chamber-lock.json; docs/evidence/2026-08-25/prompt-boundary-live-README.md; docs/evidence/2026-08-25/prompt-boundary-live-request.json; docs/evidence/2026-08-25/prompt-boundary-live-prompt.txt; docs/evidence/2026-08-25/prompt-boundary-live-response.json; docs/evidence/2026-08-25/prompt-boundary-live-page.jpg
  - Summary: Stopped the prompt template leaking its own section labels onto generated coloring pages. Drawable values now follow their exact-text instructions on their own lines, the block is explicitly terminated, and the three bracketed author-facing notes are gone. Verified end to end against the live image endpoint, not just by unit test: POST `/api/image-generation` with the checked-in canonical prompt returned `ok:true`; the preserved JPEG visibly contains `He Said "Go"`, `Say It Again`, both list items, and the dedication with no section label. The previous prompt produced a page reading "CROWN ENERGY / TYPOGRAPHY:".
  - Risks: The canonical prompt is still duplicated in seven fixtures plus `probes/image-generation.probe.mjs`, so future template changes must regenerate every consumer. Required-phrase validation was not weakened to accommodate the fix, and the legacy import path now exercises the same canonical implementation rather than a copy. The generate-route test now stubs the global image-provider boundary with guaranteed cleanup, so it cannot issue a live request or turn provider retry latency into a false unit-test failure.

## 2026-08-25 - Widen the chat timeout budget so slow generations are not retried
- Date: 2026-08-25
- Decision: Raise `CHAT_TIMEOUT_MS` from 60s to 110s, keep the client budgets `studioText` at 150s and `tools` at 120s, and limit ProviderAdapterSeam chat requests to one attempt with no automatic retry after timeouts, network failures, or completed `429`/`5xx` responses.
- Context: A real `grok-4.6` studio generation with the large Meechie system prompt and strict `json_schema` took about 55s. That sat close enough to the old 60s budget that `fetchWithRetry` could abort useful work, retry, and push total latency beyond the browser's former 90s budget.
- Alternatives: Raise both browser budgets above the theoretical three-attempt window of more than 330s; rejected because it would leave users waiting more than five minutes after a stalled call. Retry only completed rate-limit or transient-server responses; rejected because a response can arrive near the 110-second attempt limit and still start duplicate work that cannot finish inside the 120-second tools budget. Switch models for latency; deferred because model choice changes product voice and needs separate owner review.
- Consequences: A normal slow generation can finish on its first attempt, and every timeout or provider error ends before either browser budget instead of starting a second billable call. Shared `fetchWithRetry` callers retain their configured retry behavior; only ProviderAdapterSeam chat opts out completely.
- Revisit criteria: Re-measure if p95 generation latency or the pinned text model changes.

- Cipher Gate:
  - Date: 2026-08-25
  - Seams: ProviderAdapterSeam
  - Evidence: plan.md; tests/unit/http-resilience.test.ts; tests/unit/provider-adapter-helpers.test.ts; docs/evidence/2026-08-25/rewind-ProviderAdapterSeam.txt; docs/evidence/2026-08-25/verify.txt; docs/evidence/2026-08-25/test.txt
  - Summary: Kept thrown-timeout retry eligibility explicit in `fetchWithRetry` and limited provider chat to one attempt, preventing a timeout, network failure, or late retryable response from starting work beyond the 120-second tools client budget.
  - Risks: A transient provider failure now reaches the caller instead of receiving an automatic second attempt. Shared retry behavior remains covered independently, and provider-level tests prove both timeout and retryable-response paths perform one fetch.

- Cipher Gate:
  - Date: 2026-08-25
  - Seams: ProviderAdapterSeam, PromptAssemblySeam, SpecValidationSeam, AppConfigSeam, DriftDetectionSeam, ImageGenerationSeam
  - Evidence: plan.md; HANDOFF.md; fixtures/provider-adapter/PROVENANCE.md; docs/evidence/2026-08-25/prompt-boundary-live-README.md; docs/evidence/2026-08-25/prompt-boundary-live-request.json; docs/evidence/2026-08-25/prompt-boundary-live-prompt.txt; docs/evidence/2026-08-25/prompt-boundary-live-response.json; docs/evidence/2026-08-25/rewind-ProviderAdapterSeam.txt; docs/evidence/2026-08-25/rewind-SpecValidationSeam.txt; docs/evidence/2026-08-25/rewind-AppConfigSeam.txt; docs/evidence/2026-08-25/rewind-PromptAssemblySeam.txt; docs/evidence/2026-08-25/rewind-PromptAssemblySeam(self-contained).txt; docs/evidence/2026-08-25/rewind-ImageGenerationSeam.txt; docs/evidence/2026-08-25/verify.txt; docs/evidence/2026-08-25/test.txt; tests/unit/http-resilience.test.ts; tests/unit/provider-adapter-helpers.test.ts; tests/unit/app-config-seam.test.ts; tests/unit/probe-entrypoints.test.ts; tests/contract/prompt-assembly.test.ts; tests/contract/spec-validation.test.ts; src/lib/seams/prompt-assembly-seam/test.ts; src/lib/seams/spec-validation-seam/test.ts
  - Summary: Reconciled every reviewed PR #228 repair on the concurrent head: one-attempt provider chat with shared identifier redaction, schema-defaulted image size, injection-safe exact-text prompt boundaries, strict nonblank/single-line title and label validation, regenerated prompt/drift/image fixtures, and truthful live/replay evidence, while removing unrelated permission and merge-authority changes.
  - Risks: The authenticated strict-schema probe does not prove the deployed full Meechie payload, so that assumption remains open. The preserved live JPEG exists only in the current remote tree; publication must descend from head `4c29e0f`, preserve blob `834250d967273dc3ab61715bc94042cda8d114eb`, delete `.claude/settings.local.json`, pass current-head CI, and remain unmerged until the owner explicitly approves a merge.

## 2026-09-03 - Fix the image-id numbering gap in the pipeline, not the seam

- Date: 2026-09-03
- Decision: Fix `runImageGenerationPipeline`'s `GeneratedImage.id` numbering (PR #252) as a pipeline-level change only - number by position in the filtered output array (`images.length + 1` at push time) - without touching `ImageGenerationSeam`'s contract, mock, fixtures, or adapter, and without a full contract/probe/fixture/mock/adapter cycle for this fix.
- Context: A Codex review on PR #252 (commit `e9325fa`) flagged the fix as P1, arguing that because a provider result missing `b64` ahead of a valid image changes the client-visible `id` values returned by `/api/image-generation` and `/api/generate`, the change must go through the full seam workflow per `AGENTS.md:L82-L84`. Verified directly rather than dismissed: (1) `git diff --name-only origin/main..HEAD` for PR #252 touches only `src/lib/core/image-generation-pipeline.ts`, its unit test, `WigCarousel.svelte`, and docs/evidence - no file under `contracts/`, `probes/`, `fixtures/`, `src/lib/mocks/`, `src/lib/adapters/`, or `src/lib/seams/*` is in the diff; (2) the response contract (`contracts/image-generation.contract.ts`) types `GeneratedImage.id` as `NonEmptyStringSchema` - any non-empty string satisfies it, so the exact numbering algorithm was never a contracted invariant, only an implementation detail; (3) the `id` string is synthesized entirely inside the pipeline, after `ImageGenerationSeam.generate()` has already returned - it crosses no filesystem/network/process/clock/randomness boundary, which is `AGENTS.md`'s own definition of what "touches a seam"; (4) no route, component, or seam reads back `GeneratedImage.id` to key or match anything (confirmed by grep across `src/routes` and `src/lib/components`), so "client-visible" is true only in the sense that the field appears in the JSON body, not that any consumer's behavior depends on its value.
- Alternatives: Run the full seam workflow anyway (new fixture cases, contract test updates, a Cipher Gate entry) to be maximally safe; rejected as disproportionate for a one-line pure-function correctness fix that changes no contracted shape, and inconsistent with this same day's precedent (see the `meechie-studio-text` `maxDuration` entry above), which drew the same distinction between "observable" and "seam-crossing." Leave the bug unfixed and only reply to the review; rejected because the existing test had locked in the wrong id (`'image-2'` for the sole surviving image) as correct, which is the actual defect PR #252 exists to fix.
- Consequences: `GeneratedImage.id` values now count contiguously from 1 in the emitted array regardless of gaps in the provider's own array. Any future change that does need to pin the numbering scheme as a contracted invariant (e.g. a client starts keying off `id`) goes through the full workflow on its own merits - this entry does not create a standing exemption for `ImageGenerationSeam` beyond this specific fix.
- Self-critique / seam-workflow scope: `AGENTS.md` says "if there is any doubt, treat it as a seam change." The doubt here was real enough to investigate rather than wave off with precedent alone (unlike this repo's default posture toward Rosentic's whole-backlog scan noise, this was a specific, code-literate finding from a bot that has been right before). The investigation above is the resolution: the fix touches no seam artifact, the contract does not pin the value, and no consumer depends on it. If any one of those three had been false, this would have gone through the full workflow instead.
- Revisit criteria: If `GeneratedImage.id` is ever read by client code to key, sort, or deduplicate images, or if the contract is tightened to pin a specific format (e.g. a regex), route id assignment through a proper seam or contract-tested pure function with fixture coverage at that point.

## 2026-09-06 - Rebuild the offline layer by prerendering the app, not by adding an operation to CacheSeam

- Date: 2026-09-06
- Decision: Make the installable app work offline (`WORST_TO_BEST_LOG.md` Run 10) by prerendering all fourteen routes and pre-caching `$service-worker`'s `prerendered` list, moving every service-worker decision into a new pure module `src/lib/core/offline-cache.ts`, and leaving `CacheSeam`'s contract, adapter, mock, fixtures, validators and probe untouched.
- Context: On `main` at `ad3bfe7` the service worker pre-cached 63 URLs totalling 3,462,111 bytes and zero bytes of HTML, in a single atomic `cache.addAll`, then answered every GET cache-first with a bare `fetch` fallback whose rejection produced the browser's network-error page. Since `static/manifest.webmanifest` declares `display: standalone`, that error page was the whole installed app. Nothing was prerendered, so under `adapter-vercel` no document existed for the cache to hold. The file also had no tests, because its decisions were tangled with `$service-worker` and the Web Cache API.
- Alternatives: **(a) Add `putResponse` to `CacheSeam` and cache documents at runtime.** This is the textbook answer and was rejected on two grounds. First, it is a contract change, which `AGENTS.md` names as a condition under which a pull request is not merged without asking — a cost worth paying only if it buys something prerendering does not. Second, it buys *less*: runtime caching populates a page only after the reader has visited it online, so the first offline launch of a route still fails, whereas a prerendered page is in the cache from install. **(b) Prime a single URL at a time through the existing `primeCache` to fake a write-through.** Rejected: `cache.addAll` re-fetches, so every navigation would cost a second network request for a copy of a document already in hand. **(c) Cache-first for navigations.** Rejected: a precached document is a whole deploy behind, and the last four runs of this routine shipped corrections to what the app *says*, so freshness beats latency here; navigations and `__data.json` are network-first with the cache as the fallback. **(d) `prerender = true` on `/m/[mode]`.** Rejected: it would prerender the eight canonical slugs and 404 at the CDN for the five `SLUG_ALIASES` URLs that resolve today; `'auto'` prerenders the canonical slugs and keeps the route in the server manifest, which was verified in `.vercel/output/config.json` rather than assumed.
- Consequences: All fourteen routes are served as static HTML from the CDN instead of per-request function invocations, and `WigCatalogSeam.listWigs()` now runs at build time for `/`. The seam contract is unchanged and its input is a bundled JSON module, so the rendered document is identical; `npm run rewind -- --seam CacheSeam` is 14 passed and all 46 e2e tests pass. The precache is now graded — 62 critical URLs whose failure fails the install, 15 optional artwork files retried individually, 1 skipped — so one unreachable picture no longer means nothing is cached. `/api/*`, cross-origin and non-GET requests are no longer intercepted at all. Two facts that could previously go stale silently are now measured by tests: whether `/offline` is still prerendered (`planPrecache().fallbackAvailable`), and whether the manifest, `app.html` and the app's own `--dark-base` agree on a colour.
- Self-critique / seam-workflow scope: `AGENTS.md` says to treat any doubt as a seam change. The doubt was real and was investigated rather than waved off: `git status` shows no file under `contracts/`, `probes/`, `fixtures/`, `src/lib/mocks/`, `src/lib/adapters/` or `src/lib/seams/` in this change; `CacheSeam`'s three operations are called with the same argument types as before; and the new module reaches the Cache API only through the seam, which is what makes it testable against `createMockCacheSeam` at all. No Cipher Gate entry is claimed, because no seam artifact changed — recording one would assert a workflow this change did not need and did not run.
- Revisit criteria: If a route ever gains a request-dependent `load`, its `prerender` flag must come out, and the build will say so. If the app ever needs to cache something that is not part of the build — a provider response, or a page rendered on demand — that is the point at which `CacheSeam` needs a write operation and the full Seam-Driven Development workflow, and it should not be smuggled in through `primeCache`.

## 2026-09-06 - Automate the CacheSeam probe rather than exempt it, after a review said the workflow was skipped

- Date: 2026-09-06
- Decision: Answer the "run the CacheSeam change through the full workflow" finding on PR #311 by writing the probe it said was missing (`probes/cache-seam.probe.mjs`, a real Chromium driven over the production build), rather than by arguing that no seam artifact had changed. Keep the contract, mock, fixtures, adapter and contract tests unchanged, and record why each is genuinely unaffected.
- Context: The Run 10 plan named `CacheSeam` and declared its contract, probe, fixtures, mock, contract tests and adapter out of scope. A Codex review argued that an existing `rewind` plus unit tests provides no fresh reality probe and no red proof for a change that alters what the service worker caches and serves. Measured rather than assumed: `git diff --name-only origin/main..HEAD` contains no file under `contracts/`, `probes/`, `fixtures/`, `src/lib/mocks/`, `tests/contract/`, `src/lib/adapters/` or `src/lib/seams/` *before* this entry, and the seam's three operations are called with the same argument types as before. But the finding was right about the part that mattered: `src/lib/seams/cache-seam/probe.ts` had said since 2026-05-15 that "automated Node.js probing is not possible" and listed six manual DevTools steps, of which step 5 is "Throttle the network to Offline and reload — the app should load from cache". Nobody had ever run it, and on `main` at `ad3bfe7` it would have failed. "Not possible in Node" is true and is not the same claim as "not automatable": this repository already drives a real browser in `probes/browser-seams.probe.mjs`.
- Alternatives: **(a) Reply with the file-list measurement and decline.** Rejected: it answers the letter of the finding and not its substance, and the substance was a four-month-old unexecuted probe on the seam this run is entirely about. **(b) Add contract/mock/fixture changes to look compliant.** Rejected outright: the contract is unchanged, and CacheSeam's fixtures are error-shape constants rather than captured payloads, so a "sample cache" fixture would be invented data — the one thing the workflow bans by name. **(c) Record an Assumption entry for a blocked probe.** This was the intended answer while the probe looked unrunnable from this container; it stopped being honest the moment a probe was actually possible, and an assumption is for what cannot be checked, not for what has not been.
- Consequences: The probe found three defects that 42 unit tests and 46 end-to-end tests had all passed over, because none of them runs a service worker. (1) The worker cached all fourteen documents and then controlled nothing — no `clients.claim()` — so a reader whose first visit was also the visit they lost signal got the browser's error page with a complete copy of the app sitting unreachable on their device. (2) The navigation fallback returned the offline page's bytes under the requested URL, and SvelteKit's client router then resolved that URL, found no route, and rendered its 404 over the top; it now redirects to `/offline` so the document is the route it claims to be. (3) The probe's own first version read Cache Storage mid-`addAll` because it waited on `registration.active.state` instead of on the cache containing anything — the same substitution of a nearby signal for the fact that this run had just corrected in `+layout.svelte` for `navigator.serviceWorker.ready`. `docs/seams.md` now names the runnable probe and dates it 2026-09-06 with its evidence path.
- Self-critique: the plan's anti-goals were wrong twice in the same run, in the same way — `vercel.json` (which cost the prerendered pages their security headers) and `probes/` (which cost the change its reality capture). Both were listed to keep the diff narrow, and narrowness is not a property worth a frameable page or an unrun probe. An anti-goal is a prediction about what the change will not need; when the prediction is wrong the plan is what gives way.
- Revisit criteria: If `CacheSeam` gains an operation, or the worker begins caching anything not produced by the build, the full workflow applies to the contract and its fixtures as well, and this entry does not cover it.

- Cipher Gate:
  - Date: 2026-09-06
  - Seams: CacheSeam
  - Evidence: docs/evidence/2026-09-06/probe-cache-seam.txt (12/12); docs/evidence/2026-09-06/rewind-CacheSeam.txt (14 passed); docs/evidence/2026-09-06/verify-outer.txt; docs/evidence/2026-09-06/test.txt; probes/cache-seam.probe.mjs; src/lib/seams/cache-seam/probe.ts; docs/seams.md; tests/unit/offline-cache.test.ts; tests/unit/security-headers.test.ts
  - Summary: Automated the CacheSeam probe against a real browser for the first time, and fixed the three defects it found - a worker that cached everything and controlled nothing, a navigation fallback served under the wrong URL, and a probe that read the cache before it was filled. The seam's contract, mock, fixtures, adapter and contract tests are unchanged; `probe.ts` and the `docs/seams.md` row now describe a probe that has actually been run.
  - Risks: The probe runs against `vite preview` on localhost rather than a deployment, because this container's egress policy blocks the Vercel preview URL (`CONNECT tunnel failed, 403`). It therefore cannot observe PWA installation or cache eviction across a real deploy; those two steps remain manual and are listed in `probe.ts`. It also uses Playwright's offline emulation, which was checked to apply to service-worker fetches and to navigations - a route that exists on the server but is not precached returns the offline page while offline - rather than assumed.

## 2026-09-06 - Read `self.location.origin` directly in the service worker rather than through AppOriginSeam

- Date: 2026-09-06
- Decision: `src/service-worker.ts` reads `self.location.origin` directly and passes it into `chooseStrategy`, instead of calling `createAppOriginSeam().getOrigin()`. This is a deliberate, single exception to the rule stated in that adapter's own header: "this is the single place in the application permitted to read `location.origin`".
- Context: Found by re-reading `src/lib/seams/CLAUDE.md` during Run 10's review rounds; no reviewer or checker raised it. The seam does work in a worker — its adapter reads `globalThis.location`, which in a service worker is the worker's own `WorkerLocation` — so the exception is a choice rather than a limitation, and it was measured both ways before being taken.
- Alternatives: **(a) Use the seam.** Rejected on two grounds, one measured and one about failure modes. Measured: the built service worker goes from **7,670 bytes to 60,991 bytes**, because `app-origin-seam/validators.ts` validates with zod, and a service worker's script is parsed and executed before it can install — 53 KB of dependency shipped to every visitor to read one string the browser has already handed us. Failure mode: `toSafeOrigin` degrades an unusable origin to `''`. In the page that is exactly right, because the value is compared against a *stored* URL that an attacker may have influenced, and `''` makes the comparison refuse everything. In the worker the comparison is against `new URL(event.request.url).origin` — a value the browser produced, not one anybody stored — and `''` would make every request appear cross-origin, silently bypassing the worker and switching the entire offline layer off. A safety default that disables the feature it guards is the wrong default for this caller. **(b) Re-implement the validation inline without zod.** Rejected: a second copy of the seam's logic is worse than an explicit exception to it.
- Consequences: One direct `location` read exists outside the seam, in the one file whose whole job is to be the browser-integration boundary for the offline layer. It is annotated at the call site with this reasoning and the byte measurement, so the next reader meets the exception and its evidence together rather than assuming the rule was overlooked. `chooseStrategy` itself is unchanged and still takes the origin as an input, so the *policy* remains pure and testable with any origin.
- Revisit criteria: If `app-origin-seam` ever validates without a third-party dependency, or gains a variant whose failure mode is "throw" rather than "return ''", this exception should be removed and the seam used. Equally, if any second place in the worker needs an origin, that is the point at which one direct read becomes a pattern and the trade should be re-argued rather than repeated.
