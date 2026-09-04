<!--
Purpose: Append-only log of every scheduled "worst feature -> best feature" run.
Why: A future run must be able to see which feature each prior run picked, why it was judged the
     worst, what shipped, and what was deliberately left alone — so no run re-derives that
     reasoning or re-picks a feature that has already been rebuilt.
Info flow: Run picks a feature -> records the case against it here -> ships the rebuild -> records
           the PR, the evidence, and the deferred items in the same entry.
-->
# Worst Feature -> Best Feature Log

A recurring scheduled task with no live human watching. Each run picks the single worst feature in
the app, rebuilds it into the best one, opens a pull request, drives it through review to merge,
and records the whole thing here.

## How to use this file

- **Append only.** Never edit or delete a prior entry; add a new one at the bottom.
- **Read it in full before starting.** It records every feature already rebuilt, every candidate
  considered and passed over with the reasoning, and anything a future run should pick up.
- **One feature per run.** "Worst" means the feature whose gap between what it promises and what
  it does costs the user the most — not the ugliest code.
- **Scope rule.** Prefer changes in `src/lib/core/*`, `src/routes/**`, and
  `src/lib/components/**`. A rebuild that has to change `contracts/`, `probes/`, `fixtures/`,
  `src/lib/mocks/`, `src/lib/adapters/`, or `src/lib/seams/*` needs the full Seam-Driven
  Development workflow in `AGENTS.md` (contract -> probe -> fixtures -> mock -> test -> adapter,
  plus a Cipher Gate entry in `DECISIONS.md`). Either do that workflow properly or pick a rebuild
  that does not need it — never half-do it.
- **Verification.** `npm run check`, `npm run lint`, `npm test`, `npm run build` before every push,
  plus the full `npm run verify` chain with refreshed `docs/evidence/YYYY-MM-DD/`.

---

## Run 1 — 2026-09-04 — The Quote Vault (saved coloring pages)

**Branch:** `claude/great-bell-vsyt6c`

### The feature, and why it was the worst

The Quote Vault is the app's memory: the list of coloring pages you saved. It sits on the home
page under the heading "Saved Pages". Every other feature in the app is a one-shot — you type
evidence, Meechie rules on it, you generate a page. The vault is the only thing that is supposed
to still be there tomorrow.

It was the worst feature because it was the one place in the app that took something the user had
already paid a generation for and then lost it, in four separate ways, all of them silent.

Concretely, on `main` at `4f68400`:

1. **It hid most of your work.** `VerdictRow.svelte` rendered `creations.slice(0, 4)`. The store
   (`creation-store.adapter.ts`) keeps `MAX_CREATIONS = 50`. Saving a fifth page made the first one
   unreachable from the UI forever, while it went on occupying one of the fifty slots.
2. **It gave the picture back only as words.** `loadCreation` in `studio-state.svelte.ts` called
   `resetGeneratedPage()` and then restored the spec and the text — never `images`. The record
   stores the page's bytes in `images[].b64`. So reopening a saved page showed the empty demo
   sheet, and the only way to see your own page again was to pay for another generation.
3. **Delete was one unconfirmed click with no undo.** `onclick={() => onDeleteCreation(creation.id)}`
   fired straight into `creationStoreAdapter.deleteCreation`. One mis-tap on a phone destroyed a
   generated page permanently.
4. **Every failure was silent.** `refreshCreations`, `deleteCreation`, and `toggleFavorite` all
   read `if (result.ok) { ... }` with no else. Unreadable storage rendered as an empty vault with
   no explanation; a failed delete left the row on screen as if nothing had happened; a failed pin
   did nothing at all.

And what it *did* show was almost nothing: one bare `<button>` per row containing
`creation.intent.title`. No thumbnail, though the image was in the record. No date, though
`createdAtISO` was in the record. No quote. No search. Two pages saved from the same mode were
indistinguishable.

"Pin" deserves its own line. `favorite` was persisted and then never read by anything. It did not
sort, filter, or mark the row. Its only observable effect came from a side effect: `toggleFavorite`
calls `saveCreation`, and `upsertRecord` moves a re-saved record to the front of the list — so
pinning bumped the row to the top and **unpinning bumped it to the top too**. The control was
decorative and its one visible behaviour was identical in both directions.

Runners-up considered and passed over: the wig try-on (works, and was already repaired in the
v1.1 recovery plan), and `DEFAULT_IMAGE_SIZE` being parsed into `AppConfig` and never wired into
generation (real, but a one-line config defect, not a feature).

### Plan (per `AGENTS.md` "Plan + Self-Critique")

- **Goal:** every saved page reachable, recognisable, restorable in full, and impossible to lose
  by accident.
- **Seams touched:** none. All data needed was already inside `CreationRecord`.
- **Files:**
  - `src/lib/core/vault-gallery.ts` (new) — pure transforms: sort, filter, save-date label, byte
    -signature detection of a stored image, and rebuilding `GeneratedImage[]` from a record.
  - `src/routes/studio-state.svelte.ts` — vault query/expand/error state, two-step delete with
    undo, image restore on load, error surfacing on every vault read and write.
  - `src/lib/components/studio/VerdictRow.svelte` — the vault card, rebuilt.
  - `src/routes/+page.svelte` — prop wiring and the vault styles (the page owns
    `:global(.studio …)` styles for its components, matching the existing convention).
  - `tests/unit/vault-gallery.test.ts` (new), `tests/unit/studio-state.test.ts`,
    `tests/e2e/smoke.spec.ts`.
- **Commands:** `npm run check`, `npm run lint`, `npm test`, `npm run build`, `npm run verify`,
  `npx playwright test`.

### Self-critique, and what it changed

- *Riskiest assumption:* that a stored image can be faithfully rebuilt. It cannot be taken on
  trust — `saveToVault` writes `{ b64 }` only, discarding the format and encoding the generator
  reported. Proven by reading the bytes instead: `detectVaultImageKind` sniffs the real signature
  (reusing the existing `detectRasterMimeTypeFromBytes`) and is tested against real PNG, JPEG,
  WebP and base64-SVG payloads. An SVG must come back as **utf8 markup**, not base64 — the
  packaging adapter's `svgToPngBase64` takes raw markup — which is exactly the bug that reading
  the adapter first, rather than assuming, caught.
- *What could be wrong:* re-packaging a reopened page into a PDF needs a browser canvas for some
  formats. It is therefore best-effort and silent on failure: a page that cannot be re-packaged
  still previews and still exports as an image. Tested both ways.
- *Tradeoff:* save-date labels count calendar days in **UTC** so the label is a pure function of
  the stored instant and never depends on the runner's timezone. Recorded in `DECISIONS.md`.

### What shipped

- Every saved page is reachable: four shown, `Show all N` reveals the rest.
- Search across title, quote, verdict, dedication, and every printed line; a no-matches state that
  does not lie and claim the vault is empty.
- Each row shows the actual saved page as a thumbnail, its title, its quote, and when it was saved.
- Pin now genuinely pins — pinned pages sort to the top and the row is marked.
- Direct download of a saved page straight from its row.
- Reopening a page restores the image, the assembled prompt, the revised prompt and the
  violations, and rebuilds the printable PDF so Download PDF works on it.
- Delete is armed first (`Delete for real` / `Keep it`) and reversible after the fact
  (`Put it back`).
- Every vault read and write failure is now shown instead of swallowed.

### Deliberately not done (for a future run)

- **`creationStoreAdapter.deleteCreation` ignores `owner`.** It deletes by `id` across every
  owner's records, unlike `listCreations` which filters correctly. Real defect, but the fix is in
  `src/lib/adapters/` and needs the full Seam-Driven Development workflow — out of scope for a
  run that deliberately touched no seam. Worth its own run or a seam-scoped PR.
- **`parseRecords`' `skippedIndices` is computed and never surfaced.** Corrupt stored entries are
  dropped silently. Surfacing it properly means a contract change so the count can cross the seam.
- **The vault holds base64 images in `localStorage`.** Fifty full-size pages will hit the ~5 MB
  quota. `writeJson` already returns `STORAGE_WRITE_FAILED`, which this run made visible, so the
  failure is at least no longer silent — but the real fix is a different storage seam.

### Evidence

- `npm run check`: 0 errors, 0 warnings.
- `npm run lint`: clean.
- `npm test`: 898 passed, 1 skipped (baseline before this change: 845 passed, 1 skipped).
- `npm run build`: green.
- `npx playwright test`: 8 passed, including two vault tests (save/reopen/pin/two-step
  delete/undo, and search + reveal-the-rest).
- `npm run verify`: full chain green — audit gate found 0 vulnerabilities, check 0 errors,
  898 passed / 1 skipped, evidence refreshed in `docs/evidence/2026-09-04/`.
- The rebuilt vault was also driven in a real browser at desktop and phone widths to check the
  four states it can be in (list, delete armed, undo offered, search with no matches).

### Outcome

- Pull request: [#286](https://github.com/Phazzie/meechiescoloringbook/pull/286), opened and merged
  2026-09-04.
- **Review rounds.**
  - *CodeQL, 2 high alerts* — `js/clear-text-storage-of-sensitive-data`, both tracing to this run's
    own new vault test helper, which hand-wrote a JSON blob containing `owner.sessionId` straight
    into `localStorage`. CodeQL was green on the previously merged PR (#284), so the alert was this
    PR's, not standing noise, and was fixed rather than stood down: the helper now seeds through
    `creationStoreAdapter.saveCreation` with `sessionAdapter.getSession` stubbed. The same commit
    hardened `vaultImageSource` to refuse a stored `url` that is not http(s) or a same-origin path,
    because this run newly fed that value to an `<a href download>`.
  - *Rosentic, 20 findings* — all cross-branch comparisons against other unmerged branches; two of
    the six groups named files this PR does not touch. Answered in one comment with the `git diff`
    evidence; the Rosentic check itself was green throughout. This is the noise `AGENTS.md` already
    records.
  - *Vercel* — first head hit the documented `api-deployments-free-per-day` free-tier limit and
    cleared itself on the next head.
  - *SonarCloud* — quality gate passed. It reported 5 non-blocking new issues that could not be
    read from this environment (`sonarcloud.io` is blocked by the egress proxy); said so on the PR
    rather than implying they were reviewed. **A future run with network access should read them.**
  - *CodeRabbit* skipped (repo under 10 stars); *Codex* completed with no findings.

### Two things a future run should know

1. **`docs/evidence/YYYY-MM-DD/` conflicts constantly.** Main took two other agents' PRs (#285,
   #287) during this run, roughly ten minutes apart, and each one re-conflicted the whole evidence
   directory — never a source file. Resolve it the same way every time: `git checkout --theirs
   docs/evidence/<date>/`, then re-run `npm run verify` to regenerate the directory. Never
   hand-merge generated output. Commit and push immediately; the window between resolving and
   pushing is when the next conflict lands.
2. **`.github/workflows/verify.yml` is `on: [push, pull_request]`, so every push starts two
   identical `verify` runs seconds apart on one shared npm cache key — and whichever loses the race
   hangs.** It happened on all three heads of this PR, once on the push-triggered job and twice on
   the pull_request-triggered one, hanging on `Install dependencies` twice and on `Verify` once.
   Cancelling and re-running does not help (the re-run hung too). It did **not** reproduce on PR
   #287, so it is intermittent contention rather than deterministic. **The real fix is scoping
   `on: push` to `branches: [main]`** so `pull_request` alone covers branch pushes — a
   `.github/workflows/` change, deliberately out of scope for a run that touched no CI config, and
   a good candidate for its own small PR. Budget extra wall-clock for this until it is fixed.

---

## Run 1, close-out — 2026-09-04 — corrections to the entry above

Every correction below is appended here rather than written into Run 1. One exception is visible in
this run's own diff and is stated plainly rather than glossed: PR #289 **does** modify a line inside
the Run 1 entry, restoring its outcome line to the text that merged with PR #286. PR #288 had
overwritten that line in place, so the choice was between a file that keeps a falsified entry and a
file whose history shows one deliberate, disclosed revert. Restoring won, because the point of
"append only" is that the record stays true, and a silently rewritten outcome defeats that more
thoroughly than a documented undo of the rewrite does. Nothing else in Run 1 is touched, and from
here on nothing in it is edited for any reason.

**Outcome of PR #286.** Merged as `04f1922`; the log close-out that followed it merged as
`2e488b8` (PR #288).

**Correction 1 — the Vercel stand-down cited evidence that does not hold.** The close-out first
argued Vercel's red status was not this PR's because "it also failed on this PR's very first head,
before any of its content could matter." That is wrong: the first head was `c8c660d`, which already
contained the entire feature rebuild, so its failure proves nothing about whether the PR caused it.
The conclusion was still right but for a different reason, and this is the reason a future run
should copy: `api-deployments-free-per-day` ("more than 100") is an **account-wide daily deployment
quota**. It is a property of the Vercel account and the calendar day, not of any diff — no change
to this repository can cause or avoid it — and `AGENTS.md` already records it as standing noise.

This does **not** lower the bar for standing a failure down. The merge gate in `AGENTS.md` is
unconditional: a red status may be stood down only after its actual failure signature has been
matched against the base commit or an unrelated head, and that comparison written into a PR
comment. "Vercel is usually the quota" is a hypothesis, not the evidence — a deployment failure
caused by a real change can look superficially identical, and an unattended run that skips the
comparison will merge straight through one. Read the status description, confirm it names
`api-deployments-free-per-day` rather than a build or runtime error, show the same signature
elsewhere, and record that before merging. Every red status earns the same check.

**Correction 2 — the close-out edited Run 1 in place.** PR #288 rewrote text inside the Run 1
entry instead of appending. That is exactly what the "Append only" rule at the top of this file
forbids, broken on the first run by the run that wrote the rule. Run 1's outcome line has been
restored to what it said when it merged, and everything new lives here.

**Correction 3 — thirteen review findings were merged unaddressed.** Codex reviewed PR #286 four
times (`c8c660d`, `4204e99`, `3004e1a`, `6b8ea95`) and PR #288 once. Its first review landed at
00:52, two minutes after the run's only check for review comments, and the run merged both PRs
without looking again. Eleven of the findings were real defects in code this run wrote. They are
fixed in the follow-up PR recorded below. **The process lesson: read review comments immediately
before merging, not once early on.** Bots review each pushed head asynchronously, and on this repo
Codex takes four to six minutes — longer than the gap between a push and a merge.

### What the follow-up fixed

| Severity | Finding | Fix |
|---|---|---|
| P1 | `undoDelete` at capacity silently evicted a different saved page — the store caps at 50 and drops the oldest, so restoring into a refilled vault destroyed someone else's page while reporting only a successful restore. The exact failure this feature exists to prevent. | Refuse the undo and say why, rather than trading one lost page for another. |
| P1 | A late `package()` result from a previously opened page overwrote `packagedFiles`, so Download PDF could hand back a different page than the one displayed. | A load token bumped in `resetGeneratedPage()`; stale completions discard themselves. |
| P1 | `Date.now()` inside `src/lib/core/vault-gallery.ts` — `AGENTS.md` classifies clock access as a seam. | Removed the fallback; `nowMs` is now a required argument, so core is pure and the caller owns the clock. |
| P1 | `docs/evidence/2026-09-04/verify-chain.txt` reported 847 tests while `test.txt` reported 905, so the chain looked undemonstrated for the reviewed change. | Regenerated every file `npm run verify` owns from one clean run (916). See the note below on the three files it does not own. |
| P2 | An external `url` was preferred over stored bytes, but `svelte.config.js` sets `img-src 'self' data: blob:`, so it could only ever render broken with a dead download beside it. | Bytes win; only same-origin paths are accepted as a url. |
| P2 | Entry selection took the first *non-empty* image, so a leading unreadable entry hid a perfectly good later one. | Take the first image that actually resolves. |
| P2 | Collapsing the list left an armed delete primed off-screen, unlike search which disarms. | Collapse disarms too. |
| P2 | Legacy records without `studioText` searched and displayed as though they had no quote, though `buildStudioTextFromCreationRecord` reconstructs one. | Both display and search go through the reconstruction. |
| P2 | The empty state rendered directly beneath a storage error, telling readers their pages did not exist when the app simply could not read them. | The two states are now mutually exclusive. |
| P2 | "Saved today" never advanced across UTC midnight without a vault read. | The clock is re-read when the tab returns to the foreground. |

`VAULT_CAPACITY` in core mirrors the adapter's private `MAX_CREATIONS`; a test drives the real
store past it so the mirror cannot silently drift.

**A note on `docs/evidence/<date>/` for future runs.** The directory is shared by every routine
that runs on a given date, and `npm run verify` only writes some of what ends up in it:
`assumption-alarm.json`, `chamber-lock.json`, `clan-chain.{json,md}`, `proof-tape.{json,md}`,
`seam-ledger.{json,md}`, `shaolin-lint.json`, `test.txt`, `verify.txt`. The others present on
2026-09-04 — `build.txt`, `lint.txt`, `verify-chain.txt` — come from a **different** routine and
were **not** produced by this run. That is why `verify-chain.txt` reports a different test count:
it is another run's transcript, not a stale copy of this one's. Resolving an evidence conflict
with `git checkout --theirs` and then re-running `verify` therefore leaves those three files
untouched, which is correct — deleting them would destroy another run's evidence. Do not delete
them; just do not read them as this run's.

### Still deferred

- `creationStoreAdapter.deleteCreation` ignores `owner` (needs the seam workflow).
- `parseRecords`' `skippedIndices` is computed and never surfaced (needs a contract change).
- `localStorage` quota for fifty full-size pages (needs a different storage seam).
- `.github/workflows/verify.yml` runs twice per push and one of the pair hangs; scope `on: push`
  to `branches: [main]`. Worth its own PR.

---

## Run 1, second close-out — 2026-09-04 — the review round on PR #289

Appended, not edited. PR #289 was the follow-up that fixed the thirteen findings merged unaddressed
on #286/#288. It was itself reviewed, and Codex returned **seven more findings on `e941fed`**. This
section records them because the pattern is the point: a fix PR is not exempt from review, and the
run that waited for the review this time caught real defects it had just written.

| Severity | Finding | What it actually was | Fix |
|---|---|---|---|
| P1 | `undoDelete`'s capacity guard reads `this.creations`, which is owner-filtered, while the adapter caps the whole stored array. | Real. Records orphaned under a previous `cb_session_id_v1` occupy slots the guard cannot see, so it can pass and still evict. | The guard stays — it is a correct lower bound and covers every case reachable while the session id survives — but it no longer claims to be a store-wide guarantee. The sound fix needs `CreationStoreSeam` to own the decision, a contract change and so the full Seam-Driven Development workflow; deferred below rather than widened into a fix PR. |
| P1 | `Date.now()` in `startSavedLabelRefresh` reads the clock outside a seam. | Half real. `AGENTS.md` does classify clock/time as a seam, but this repository has **no** clock seam, and the same file already read `Date.now()` three times before this feature existed (creation ids, `createdAtISO`). | Rather than invent a seam for a date label, every vault clock read now goes through one injectable `readNow`. The UTC-midnight rollover became a real test instead of a path that depended on when the suite ran. |
| P1 | Restoring Run 1's outcome line is itself an edit to an append-only file, so the appended claim "Appended, not edited into Run 1" was false for that diff. | Real, and worth conceding precisely. | The restore stays, because the point of "append only" is that the record stays true and a silently rewritten outcome defeats that harder than a disclosed undo does. The claim above it is now accurate about its own diff. |
| P1 | The Vercel guidance told future runs a quota failure needs no per-PR reproduction, contradicting the merge gate. | Real, and the more dangerous of the two log findings: it was advice aimed straight at unattended successors. | Rewritten. Every red status earns the same check — match the actual failure signature, write the comparison down, then merge. |
| P2 | `vaultQuote` fell back to `buildStudioTextFromCreationRecord`, which falls back to `assembledPrompt` — the full image-generation prompt on any generated page. | Real, and the previous close-out had recorded this fallback as a *fix*. It rendered multiline rendering instructions inside quotation marks and fed their boilerplate to search. | Legacy records show no quote. `VerdictRow.svelte` already omits the line when it is empty. |
| P2 | `isSafeStoredUrl` rejected same-origin absolute URLs, which `img-src 'self'` permits and `CreationImageSchema` accepts. | Real regression introduced by the previous round's own CodeQL hardening. | Same-origin absolute URLs are accepted by comparing parsed origins; the app origin is passed into core rather than read there. |
| P2 | `proof-tape.json` omitted `build.txt`, `lint.txt`, and `verify-chain.txt`, hiding that `verify-chain.txt` still reported 847 tests. | Real: the tape ran *before* those shared files were restored, so its inventory disagreed with its own directory. | Re-ran the chain with the shared files present. They now appear under `filesPredatingRun`, which states the ownership split instead of concealing it. |

**The lesson that generalises.** Two of these seven were defects *introduced by the previous round
of fixes* — the quote fallback and the same-origin rejection were both written as corrections and
both made something worse. A fix PR earns a full review, not a lighter one.

### Still deferred after this round

- Store-wide capacity belongs inside `CreationStoreSeam`; the guard in `undoDelete` is a lower
  bound until then.
- The four items listed at the end of the previous close-out, unchanged.

---

## Run 1, third close-out — 2026-09-04 — the review round on PR #289's second head

Appended, not edited. `3b21b76` — the commit that fixed the seven findings above — drew **five
more**. Three of them were defects in that very commit. This is now the pattern of the run: each
round of fixes has introduced roughly two new defects, and only reviewing every head has caught
them.

| Severity | Finding | Fix |
|---|---|---|
| P1 | The clock finding, returned. The previous round replaced `Date.now()` with an injectable that still *defaulted* to `Date.now()`, so the production path read the host clock outside any boundary. A test-overridable default is not a seam. | Conceded and done properly: `ClockSeam` now exists — contract, mock, fixtures, probe note, contract tests, adapter, `docs/seams.md` row, Cipher Gate entry in `DECISIONS.md`. It covers reading the instant *and* scheduling at one, because a timer is a clock read in disguise. |
| P2 | Labels still would not roll over for a tab left in the **foreground** across UTC midnight — no `visibilitychange` fires, so nothing advanced the clock. The previous round's test only covered the background-and-return case. | A day-boundary timer through the seam, re-arming itself after each rollover. Both paths are kept and both are tested: a foregrounded tab needs the timer, and a backgrounded tab cannot trust a throttled timer, so it also refreshes on return. |
| P1 | The vault-full undo message said "Delete a page you do not want, then undo" — but `deleteCreation` overwrites `undoableDeletion`, so obeying that instruction discards the page the reader is trying to rescue and leaves Undo holding the one just deleted. | The message no longer scripts a move that destroys its own subject. It states the situation, warns that Undo holds only the most recent deletion, and points at Download as the way to keep the page. |
| P2 | The "your pages could not be read — they are not gone" state was keyed on `vaultError && totalSavedCount === 0`. A failed *write* into an emptied vault hits both conditions, and there the page really is gone. | A separate `vaultReadFailed` flag, set only by a failed read and cleared by a successful one. |
| P1 | `WORST_TO_BEST_LOG.md` used the acronym "SDD", which `AGENTS.md` line 55 explicitly forbids in prose. | Spelled out. |

**Why the clock seam got built after being argued against once.** The first answer — no clock seam
exists, three pre-existing reads sit in the same file, building one widens a fix pull request — was
all true and still the wrong call. `AGENTS.md` does not have an exemption for "the violation is
already common here", and a repeated finding at P1 is a signal to fix the root cause rather than
restate the objection. What *was* right in the original objection is preserved: the three
pre-existing reads were left alone, because converting them really would be unrelated widening.

### Still deferred after the third round

- Convert the three pre-existing `Date.now()`/`new Date()` reads in `studio-state.svelte.ts`
  (creation ids, `createdAtISO` on drafts and saves) to `ClockSeam`. Now that the seam exists this
  is small and mechanical, but it is untouched by this pull request.
- Everything listed above, unchanged.

---

## Run 1, fourth close-out — 2026-09-04 — the review round on `2e9edd2`

Appended, not edited. The commit that built `ClockSeam` drew **six more findings**, four of them
about that seam. Three were governance requirements the seam genuinely failed, and reading them is
the fastest way for a future run to learn what "the full workflow" actually means here.

| Severity | Finding | Fix |
|---|---|---|
| P1 | `validators.ts` missing. `src/lib/seams/AGENTS.md` lists it as a mandatory artifact, and a repo-wide check confirmed ClockSeam was the **only** seam of seventeen without one — alongside no fault fixture, so nothing proved failure behaviour before the adapter. | Both added, and the exercise found a real hazard rather than ticking a box: `setTimeout(fn, NaN)` fires *immediately*, so an unchecked bad instant turns a midnight timer into an instant one and a self-re-arming timer into a spin. `validateEpochMs` now rejects non-finite and fractional instants in both the mock and the adapter, with fault fixtures and table-driven tests. |
| P1 | The Cipher Gate entry was a general decision record, not the `- Cipher Gate:` block with Date / Seams / Evidence / Summary / Risks that `AGENTS.md` specifies. | Written in the required format, and `npm run cipher:gate` now exits 0 — which it did not before. Two formatting facts worth knowing: the parser stops at the first line that does not begin with `  - `, so every field must be a **single line**; and `Evidence` is split on commas and each entry must be a path that exists, so it cannot contain prose. |
| P1 | `plan.md` untouched. `AGENTS.md` requires a plan with exact seam names, file paths and commands *before* a seam refactor, not a decision record after it. | A plan section added, honest about its own lateness: it was written after the finding, and says so. |
| P1 | `location.origin` read directly in `studio-state.svelte.ts` — the same class of unseamed host read as the clock, introduced by the round-two fix for same-origin URLs. | `AppOriginSeam`, built the same way. Its validator earns its place: it degrades anything that is not exactly an http(s) origin to '' — an origin carrying a path or a trailing slash would otherwise widen the same-origin comparison from "same origin" to "starts with this text". |
| P2 | The mock queued an already-due callback until the next `advanceTo`, while the adapter fires it on the next turn. A test could hang waiting for a callback the real seam would already have run. | The mock fires an at-or-past instant on a microtask, re-checking the cancelled flag at fire time so cancelling first still wins. |
| P2 | `vaultImageSource` preferred stored bytes on an 18-byte signature match alone, so a truncated blob with a valid PNG header produced a broken data URL and never fell back to a working same-origin url in the same record. | The whole payload is checked for base64 validity before bytes win. Checked by syntax rather than by decoding, so a megabyte page costs a regex rather than a megabyte of allocation on every render. |

**What this round is really about.** Four of the six were the cost of doing a seam properly. The
lesson is not "seams are expensive" — it is that a seam done to three-quarters is worse than
useless, because it is recorded in `docs/seams.md` as complete while lacking the artifacts that
make it trustworthy. If a future run adds a seam, run `npm run cipher:gate` and check
`src/lib/seams/AGENTS.md`'s artifact list **before** claiming the workflow is done.

### Still deferred after the fourth round

- Everything listed above, unchanged.
