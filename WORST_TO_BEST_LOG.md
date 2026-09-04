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

- Pull request: see the entry appended at merge time below.
