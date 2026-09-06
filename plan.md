<!--
Purpose: Define the autonomous execution plan for UI redesign and technical debt refactors.
Why: Keep scope, seams, files, and validation explicit before implementation.
Info flow: User request -> execution specs -> implementation -> review evidence.
-->

# Autonomous Plan

Current active plan is listed first. Older dated entries remain below as historical context and are not active unless explicitly reselected.

## Run 10 close-out (2026-09-06) — micro plan, PR #312

Required by `AGENTS.md` L108: a governance-only documentation change still needs a plan that lists
the seams, files, commands and how behaviour stays unchanged. This PR opened without one, inheriting
Run 10's pre-merge plan below, which describes work that had already merged as `1b67d30`. Review
caught it.

**Goal:** record the Run 10 close-out in the append-only log, and correct the claims in it that
review has since disproved.

**Seams touched:** none. No contract, mock, adapter, fixture or probe is read or written by this
change. `CacheSeam` is discussed and not touched.

**Files:**

| Action | File | Exact touch |
|---|---|---|
| `[MODIFY]` | `WORST_TO_BEST_LOG.md` | append the Run 10 close-out section and correct claims within it; no other section edited |
| `[MODIFY]` | `DECISIONS.md` | the 2026-09-03 Assumption only — its `Seams`, `Statement` and `Validation` fields, plus added scope notes |
| `[MODIFY]` | `plan.md` | this micro plan section, prepended above the Run 10 entry |
| `[MODIFY]` | `docs/evidence/2026-09-06/lint.txt` | rewritten whole — `npm run lint` captured by redirect |
| `[MODIFY]` | `docs/evidence/2026-09-06/build.txt` | rewritten whole — `npm run build` captured by redirect |
| `[MODIFY]` | `docs/evidence/2026-09-06/verify-outer.txt` | rewritten whole — the full chain transcript and its exit. Per `docs/evidence/README.md`: move the previous copy **out** of the directory first, capture to a scratch path, and move the new copy in after the chain returns. **`verify-outer.txt` is therefore absent from that chain's own `proof-tape` inventory, by design.** Two wrong ways were tried first: redirecting the chain straight into the file makes the tape record a byte count 14 short — the missing `verify exit=0` — and leaving the previous copy in place makes the tape inventory a different file than the one committed |
| `[MODIFY]` | `docs/evidence/2026-09-06/verify.txt` | rewritten whole by `scripts/verify-runner.mjs` (inner check/test stage) |
| `[MODIFY]` | `docs/evidence/2026-09-06/test.txt` | rewritten whole by `scripts/verify-runner.mjs` |
| `[MODIFY]` | `docs/evidence/2026-09-06/chamber-lock.json` | rewritten whole by `scripts/chamber-lock.mjs` |
| `[MODIFY]` | `docs/evidence/2026-09-06/shaolin-lint.json` | rewritten whole by `scripts/shaolin-lint.mjs` |
| `[MODIFY]` | `docs/evidence/2026-09-06/assumption-alarm.json` | rewritten whole by `scripts/assumption-alarm.mjs` |
| `[MODIFY]` | `docs/evidence/2026-09-06/seam-ledger.json` | rewritten whole by `scripts/seam-ledger.mjs` |
| `[MODIFY]` | `docs/evidence/2026-09-06/seam-ledger.md` | rewritten whole by `scripts/seam-ledger.mjs` |
| `[MODIFY]` | `docs/evidence/2026-09-06/clan-chain.json` | rewritten whole by `scripts/clan-chain.mjs` |
| `[MODIFY]` | `docs/evidence/2026-09-06/clan-chain.md` | rewritten whole by `scripts/clan-chain.mjs` |
| `[MODIFY]` | `docs/evidence/2026-09-06/proof-tape.json` | rewritten whole by `scripts/proof-tape.mjs` |
| `[MODIFY]` | `docs/evidence/2026-09-06/proof-tape.md` | rewritten whole by `scripts/proof-tape.mjs` |

No file under `docs/evidence/` is hand-edited. An earlier version of this table gave that directory
as one wildcard row, which review rejected: a wildcard cannot be checked against a diff, and it
silently includes or omits whatever the diff happens to contain. `e2e.txt`,
`probe-cache-seam.txt` and the two `rewind-*.txt` files are **not** touched by this PR — they belong
to #311's run and no command here rewrites them.

**Commands:** `npm run lint`, `npm run build`, `npm run verify`. All three, every push — `verify`
alone is not the checklist, which is a lesson this PR learned as a P1 finding rather than by
reading. Latest: lint 0, build 0, verify 0, 1559 passed / 1 skipped across 97 files.

**How behaviour stays unchanged:** nothing under `src/` is modified, so no route, seam, worker or
response header changes. The only non-Markdown files touched are regenerated evidence artifacts,
which nothing imports. The one code-level defect this PR found — `vercel.json` listing HSTS on the
document rules while `src/hooks.server.ts` documents it as omitted — is **recorded, not fixed**,
precisely so that this stays a documentation change; the recommended patch is written down for a
separate PR.

**Do not touch:** anything under `src/`, `tests/`, `contracts/`, `scripts/` or `vercel.json`. Two
code-level defects were found while writing this close-out — `vercel.json` listing HSTS on the
document rules against its own documented rationale, and those rules not covering the emitted
`.html` filenames — and both are **recorded with a proposed patch, not fixed here**, because fixing
either turns this into a change that needs code review and its own test work. Do not edit
`e2e.txt`, `probe-cache-seam.txt` or the `rewind-*.txt` evidence: they belong to #311's run and no
command in this plan regenerates them.

**Definition of Done:**

```sh
npm run lint && npm run build && npm run verify
```

Exits 0, with `verify` reporting 1559 passed / 1 skipped across 97 test files. The outer transcript
is captured separately, to a scratch path and moved in after the chain returns, per
`docs/evidence/README.md`:

```sh
mv docs/evidence/2026-09-06/verify-outer.txt "$SCRATCH/previous.txt"
{ npm run verify 2>&1; status=$?; echo "verify exit=$status"; } > "$SCRATCH/verify-outer.txt"
mv "$SCRATCH/verify-outer.txt" docs/evidence/2026-09-06/verify-outer.txt
exit "$status"
```

`status` is captured before the `echo`, because `echo` succeeds unconditionally: writing
`echo "verify exit=$?"` as the last command in the group makes the group's own status `0` whatever
`verify` did, so a `&& mv` after it installs a failed transcript and the whole thing exits clean.
An earlier version of this block had exactly that bug. The transcript would have read
`verify exit=1` while the command reported success — evidence contradicting its own exit code, which
is the failure mode this file is supposed to make impossible.

**Self-critique:** the risk here is not to the codebase, it is that a wrong close-out is copied
forward by a future unattended run that treats this log as its source of prior results. That risk
was realised: the first version of this entry misreported the open Assumption, the merge-gate
evidence, two defect classifications and four counts. The mitigation is not care, which had already
failed — it is that every claim now names the file, line or command a reader can check it against,
and that the findings ledger is per pass and append-only so a later correction cannot quietly
displace an earlier one. What remains unmitigated: this entry is long, and length is itself a way
for a wrong sentence to survive, since each review pass has more surface to cover than the last.

## Run 10 (2026-09-06) — the installable app: manifest, service worker, and offline

**Goal:** Make the feature the operating system advertises on this app's behalf actually exist. The
manifest declares `display: standalone` and a service worker registers on every page load, but the
worker pre-cached 63 URLs / 3,462,111 bytes containing **zero HTML**, so an installed app launched
with no network showed the browser's error page — and, since there is no address bar in standalone
mode, that error page was the app. Measured on `main` at `ad3bfe7` by parsing
`.svelte-kit/output/client/service-worker.js`, not inferred from source.

**Seam: `CacheSeam`** (existing, in `docs/seams.md`). Its contract, mock, fixtures, validators,
adapter and contract tests are unchanged, and `npm run rewind -- --seam CacheSeam` is 14 passed.
Its **probe is not**: `src/lib/seams/cache-seam/probe.ts` and the registry row now describe
`probes/cache-seam.probe.mjs`, which is automated and has actually been run. This line first read
"none modified", which was true when written and stopped being true the moment a review pointed
out that the probe had never been executed. Cipher Gate entry in `DECISIONS.md`.

**Exact file inventory.** Regenerated from `git diff --name-status origin/main..HEAD` rather than
written by hand, because a hand-kept inventory is a second copy of the truth and goes stale
silently — which is exactly what happened to the version of this section a review replaced: it
carried a blanket "`CHANGELOG.md`, `DECISIONS.md`, …" line with no action markers, and omitted
`CLAUDE.md` and every file under `docs/evidence/2026-09-06/`. 46 files.

| File | Action |
|---|---|
| `CHANGELOG.md` | [MODIFY] |
| `CLAUDE.md` | [MODIFY] |
| `DECISIONS.md` | [MODIFY] |
| `LESSONS_LEARNED.md` | [MODIFY] |
| `WORST_TO_BEST_LOG.md` | [MODIFY] |
| `docs/evidence/2026-09-06/assumption-alarm.json` | [MODIFY] |
| `docs/evidence/2026-09-06/build.txt` | [MODIFY] |
| `docs/evidence/2026-09-06/chamber-lock.json` | [MODIFY] |
| `docs/evidence/2026-09-06/clan-chain.json` | [MODIFY] |
| `docs/evidence/2026-09-06/clan-chain.md` | [MODIFY] |
| `docs/evidence/2026-09-06/e2e.txt` | [MODIFY] |
| `docs/evidence/2026-09-06/lint.txt` | [MODIFY] |
| `docs/evidence/2026-09-06/probe-cache-seam.txt` | **[NEW]** |
| `docs/evidence/2026-09-06/proof-tape.json` | [MODIFY] |
| `docs/evidence/2026-09-06/proof-tape.md` | [MODIFY] |
| `docs/evidence/2026-09-06/rewind-CacheSeam.txt` | **[NEW]** |
| `docs/evidence/2026-09-06/seam-ledger.json` | [MODIFY] |
| `docs/evidence/2026-09-06/seam-ledger.md` | [MODIFY] |
| `docs/evidence/2026-09-06/shaolin-lint.json` | [MODIFY] |
| `docs/evidence/2026-09-06/test.txt` | [MODIFY] |
| `docs/evidence/2026-09-06/verify-outer.txt` | [MODIFY] |
| `docs/evidence/2026-09-06/verify.txt` | [MODIFY] |
| `docs/seams.md` | [MODIFY] |
| `eslint.config.js` | [MODIFY] |
| `plan.md` | [MODIFY] |
| `probes/cache-seam.probe.mjs` | **[NEW]** |
| `src/app.html` | [MODIFY] |
| `src/hooks.server.ts` | [MODIFY] |
| `src/lib/core/offline-cache.ts` | **[NEW]** |
| `src/lib/seams/cache-seam/probe.ts` | [MODIFY] |
| `src/routes/+layout.svelte` | [MODIFY] |
| `src/routes/+page.ts` | [MODIFY] |
| `src/routes/m/[mode]/+page.ts` | [MODIFY] |
| `src/routes/meechie/+page.ts` | **[NEW]** |
| `src/routes/offline/+page.svelte` | **[NEW]** |
| `src/routes/offline/+page.ts` | **[NEW]** |
| `src/routes/random/+page.ts` | **[NEW]** |
| `src/routes/rate-his-excuse/+page.ts` | **[NEW]** |
| `src/routes/who-fucked-up/+page.ts` | **[NEW]** |
| `src/service-worker.ts` | [MODIFY] |
| `static/manifest.webmanifest` | [MODIFY] |
| `tests/e2e/smoke.spec.ts` | [MODIFY] |
| `tests/unit/install-metadata.test.ts` | **[NEW]** |
| `tests/unit/offline-cache.test.ts` | **[NEW]** |
| `tests/unit/security-headers.test.ts` | **[NEW]** |
| `vercel.json` | [MODIFY] |

What each non-obvious one is for:
- `src/lib/core/offline-cache.ts` — the whole policy: `planPrecache`, `primePrecache`,
  `chooseStrategy`, `cacheKeyFor`, `handleFetch`, `offlineCopyIsReady`, `offlineNotice`.
- `src/service-worker.ts` — reduced to event wiring; no `caches.*` call and no decision left in it.
- `src/routes/**/+page.ts` — `export const prerender`, `true` everywhere except `'auto'` on
  `m/[mode]`, which also gains `entries` over the canonical slugs.
- `src/routes/+layout.svelte` — connection banner, registration measured through `CacheSeam`
  instead of `navigator.serviceWorker.ready`, `<meta name="description">`, `apple-touch-icon`.
- `src/hooks.server.ts` — its scope comment only; `SECURITY_HEADERS` and `handle` are unchanged.
- `vercel.json` — document-route headers for the paths prerendering moved off the function.
- `eslint.config.js` — `caches` added to the probes block's globals, for `page.evaluate` bodies.
- `probes/cache-seam.probe.mjs`, `src/lib/seams/cache-seam/probe.ts`, `docs/seams.md` — the
  automated CacheSeam probe, what it establishes, and the registry row that now dates it.
- `docs/evidence/2026-09-06/**` — outputs of the commands below. Listed because they are in the
  diff, and a plan that cannot be checked against the diff mechanically is not doing its job.

**Anti-goals (do not touch):** `contracts/`, `fixtures/`, `src/lib/mocks/`, `src/lib/adapters/`,
`tests/contract/`, `playwright.config.ts`, `svelte.config.js`. Do not add an operation to
`CacheSeam`. Do not change any localStorage key or `ColoringPageSpec` field. All of these held.

**Anti-goal corrections — this list was wrong twice, in the same way both times.** Written to keep
the diff narrow, and narrowness is not a property worth either of the things it cost. An anti-goal
is a prediction about what a change will not need; when the prediction is wrong, the plan gives way,
not the change.

**`probes/` and `src/lib/seams/` were on this list and should not have been.** Declaring them
untouchable is what let the plan ship a rewrite of the service worker's entire caching behaviour
with no reality capture — while `src/lib/seams/cache-seam/probe.ts` had said since 2026-05-15 that
its verification was manual, and nobody had performed it. A review said so; it was right. The probe
that resulted found three defects every unit and end-to-end test had passed over. See `DECISIONS.md`.

**`vercel.json` was on this list and should not have been.** Prerendering
moves every document from the SvelteKit function to the filesystem layer, and `src/hooks.server.ts`
— which attaches `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy` and `Strict-Transport-Security` — only sees what the function renders. Its own
file header says so, and says "`vercel.json` carries the headers for those paths; the two must be
changed together". Declaring `vercel.json` untouchable therefore did not protect the change; it
required shipping every page frameable. A plan's anti-goals can be wrong, and this one was: the
correct move is to widen the plan and say why, not to keep the promise and lose the header.

**Commands:** `npm run check`, `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`,
`npm run verify`, `npm run rewind -- --seam CacheSeam`, and `node probes/cache-seam.probe.mjs`
(after `npm run build`; `PROBE_CHROMIUM_PATH=<chromium>` where Playwright's browser is not installed).

**Self-critique:**
- *Riskiest assumption:* that prerendering is behaviour-neutral. It is the one change that alters
  how every page is served in production. Two things had to hold and both were checked rather than
  reasoned about: no `load` depends on the request (`/` calls `WigCatalogSeam.listWigs()`, a bundled
  JSON import; `/m/[mode]` calls `resolveModeSlug`), and CSP survives — `csp.mode: 'auto'` hashes
  prerendered pages, and the built `offline.html` carries `script-src 'self' 'sha256-…'`.
- *What must be proven:* that an alias still resolves. Proven against
  `.vercel/output/config.json`, which still carries
  `{"src":"^/m/([^/]+?)/?(?:/__data.json)?$","dest":"/m/[mode]"}` after the `filesystem` handle.
- *What could be wrong:* the choice not to add `putResponse` to `CacheSeam`. It is the textbook
  rebuild. The argument against it is in `DECISIONS.md` and rests on a measurement rather than a
  preference: prerendering puts a page in the cache before the reader's *first* offline launch,
  where runtime caching only helps after a prior online visit to that same route.
- *What could still be wrong after this run:* nothing here makes a coloring page available offline
  to a reader who has never generated one, because making one is a provider call. The offline page
  says that in those words rather than implying otherwise.

---

## Run 9 — The quality report: close the drift fail-open and rebuild all three reporting surfaces (2026-09-06)

**Superseded by Run 10 above, and merged as PR #309 on 2026-09-06.** It is kept here as history.
When it was written it read "the sole active implementation plan", which was true then; a later
entry appended below it would have been marked inactive by this file's own convention while being
the plan actually in force — so the active plan moves to the top and the retired one says so.

### Goal

The app's quality report — `System Trace` on the home studio, the drift block in
`VerdictPageStudio` (shared by the mode routes), and a third private copy in `MeechieTools.svelte` —
reports a page as having nothing wrong with it when the drift check could not grade it at all. Make
an ungradable check visible, surface the remedies already being computed, keep severity, and stop
the panel claiming a clean page it has never checked.

### Seams touched

**None.** `DriftDetectionSeam (self-contained)` and `SpecValidationSeam (self-contained)` are read
and unchanged: no contract, probe, fixture, mock, adapter or registry entry under
`src/lib/seams/` or `src/lib/adapters/` is modified.

One **route contract** changes: `contracts/generate.contract.ts` gains an optional
`driftCheckFailure`. `/api/generate` is a route, not a seam — it appears in no row of
`docs/seams.md` and has no probe, fixtures, mock, contract test or adapter — so the workflow steps
that apply are contract, consumers, tests, and a Cipher Gate entry in `DECISIONS.md`.

### Exact file inventory

Every path in `git diff --name-status origin/main..HEAD`, listed separately so the plan can be
checked mechanically against the final diff. Regenerated from that command rather than written by
hand, because a hand-kept inventory is a second copy of the truth and goes stale silently.

**Source — contract**

| File | Action | Exact edit |
|---|---|---|
| `contracts/generate.contract.ts` | `[MODIFY]` | rename the object to `GenerateResponseValueBaseSchema`; add optional `driftCheckFailure: { code, message }`; export `GenerateResponseValueSchema` as a `.refine()` rejecting a failure alongside non-empty `violations`/`recommendedFixes` |

**Source — core**

| File | Action | Exact edit |
|---|---|---|
| `src/lib/core/quality-report.ts` | `[NEW]` | `buildQualityReport`, `describeQualityReport`, `QualityFinding`, `QualityReport` (four states), `DriftCheckFailure`, `CHECK_RESULT_UNRECORDED_CODE` |
| `src/lib/core/generate-pipeline.ts` | `[MODIFY]` | populate `driftCheckFailure` from `detectDrift`'s error instead of erasing it; remove the `DRIFT_CHECK_FAILED_CODE` import and helper |

**Source — components**

| File | Action | Exact edit |
|---|---|---|
| `src/lib/components/QualityFindings.svelte` | `[NEW]` | the findings list, the one `tagFor` rule, and the unpaired fixes list |
| `src/lib/components/QualityReportPanel.svelte` | `[NEW]` | the clean line / boxed findings wrapper and its CSS, shared by the two mode surfaces |
| `src/lib/components/studio/SystemTrace.svelte` | `[MODIFY]` | render the report; add the `promptWasSent` prop; `not-applicable` branch; drop raw codes and the orphaned CSS |
| `src/lib/components/VerdictPageStudio.svelte` | `[MODIFY]` | replace the private drift block with `QualityReportPanel`; delete `.drift*` CSS |
| `src/lib/components/MeechieTools.svelte` | `[MODIFY]` | same replacement; add `driftReported`, `driftCheckFailure`, the `$:` report; delete `.drift*` CSS; `handleDedicationInput` also clears a pageless request's findings |
| `src/lib/components/verdict-page-state.svelte.ts` | `[MODIFY]` | `driftReported`, `driftCheckFailure`, derived `qualityReport`; `setDedication` also clears a pageless request's findings |

**Source — routes**

| File | Action | Exact edit |
|---|---|---|
| `src/routes/studio-state.svelte.ts` | `[MODIFY]` | `driftReported`, `driftCheckFailure`, `checkResultUnrecorded`, `promptWasSent`, `pageIsTryOnPortrait` getter, derived `qualityReport`; `tryOnPageOnScreen` becomes `$state`; reopen path reads stored findings by length; `clearPagelessRequestDiagnostics` on `rebuildSpecFromCurrentText` and `handleDedicationInput` |
| `src/routes/+page.svelte` | `[MODIFY]` | pass `report` and `promptWasSent`; delete the orphaned `.diagnostics-grid` rules |

**Tests**

| File | Action | Exact edit |
|---|---|---|
| `tests/unit/quality-report.test.ts` | `[NEW]` | states, severity, ordering, fixes non-pairing, the two page/check directions, try-on, unrecorded |
| `tests/unit/pipeline-edge-cases.test.ts` | `[MODIFY]` | replace the test asserting the fail-open; add the absent-key assertion |
| `tests/unit/api-generate.test.ts` | `[MODIFY]` | three route-level contract tests, one driving the real `driftDetectionAdapter` |
| `tests/unit/verdict-page-state.test.ts` | `[MODIFY]` | both directions of the no-page findings guard; the pageless report retired on a dedication edit |
| `tests/unit/studio-state.test.ts` | `[MODIFY]` | the pageless report retired on a control change and on a dedication edit, and the mirror: a page on screen keeps its report |
| `tests/e2e/smoke.spec.ts` | `[MODIFY]` | unchecked state on the home studio; severity, ordering, tag and fixes on the tools hub; clean line on a mode route |

**Docs**

| File | Action | Exact edit |
|---|---|---|
| `plan.md` | `[MODIFY]` | this plan; mark Seam Migration v2.0 complete |
| `DECISIONS.md` | `[MODIFY]` | the `driftCheckFailure` decision and its Cipher Gate; mark the reserved-code entry superseded |
| `CHANGELOG.md` | `[MODIFY]` | the user-visible lines for this change |
| `CLAUDE.md` | `[MODIFY]` | file-map rows for `quality-report.ts`, `QualityFindings.svelte`, `QualityReportPanel.svelte` |
| `WORST_TO_BEST_LOG.md` | `[MODIFY]` | the Run 9 entry and its close-outs |

**Evidence** — `[NEW]`, all under `docs/evidence/2026-09-06/`, written by the verify chain and the
capture commands rather than by hand: `assumption-alarm.json`, `build.txt`, `chamber-lock.json`,
`clan-chain.json`, `clan-chain.md`, `e2e.txt`, `lint.txt`, `proof-tape.json`, `proof-tape.md`,
`rewind-DriftDetectionSeam(self-contained).txt`, `rewind-DriftDetectionSeam-self-contained.txt`,
`seam-ledger.json`, `seam-ledger.md`, `shaolin-lint.json`, `test.txt`, `verify-outer.txt`,
`verify.txt`.

### Anti-goals — do not touch

- Anything under `probes/`, `fixtures/`, `src/lib/mocks/`, `src/lib/adapters/`, `src/lib/seams/`.
- `DriftDetectionOutputSchema` itself, and the drift adapter's grading rules.
- `playwright.config.ts` — the container's Chromium build mismatch is an environment fact.
- `confidenceScore`: computed by the seam and dropped at the pipeline. Surfacing it is a second
  contract change with no consumer waiting for it; deferred deliberately, recorded in `DECISIONS.md`.
- Do not pair `violations` to `recommendedFixes` by index or by code.

### Self-checks

1. **Riskiest assumption: that violations and fixes correspond.** The seam pushes them in lockstep,
   so index pairing looks right. Disproof: `DriftDetectionOutputSchema` promises no ordering, equal
   length or shared key, and two branches append one violation per offending line. Pinned by a test
   with two violations and one fix asserting no pairing is claimed.
2. **That one flag can carry both "there is a page" and "the check reported".** It cannot — proven
   by two tests: a generation returning `images: []` with no violations must not read `clean`, and a
   reopened record with a page and no stored findings must not read "nothing on the paper yet".
3. **That an absent `driftCheckFailure` is distinguishable from a present one.** Pinned by a test
   asserting the key is absent, not `undefined`-valued, on a successful check.
4. **Definition of done:** `npm run check` 0/0, `npm run lint` exit 0, `npm test` all green,
   `npm run build` exit 0, `npm run test:e2e` all green, `npm run verify` exit 0, and
   `npm run rewind -- --seam "DriftDetectionSeam (self-contained)"` exit 0.

---

## Seam Migration v2.0 — Modularization of 7 Flat Seams, Anti-Fragile Hardening, and CI Auto-Merge (2026-09-05)

Complete and merged. Retained below as historical context; superseded by the Run 9 plan above.

### Base, Ownership, and Dependency Lock
- **Base:** `main` at commit `9663a04c9db9a011a9fb22a06e0c9d1e92ceade8`. Baseline `npm test` passed 843/844 tests (1 skipped), `npm run check` reported 0 errors, `npm run lint` exited 0.
- **Integrator:** Antigravity (operating under Seam-Driven Development and the Zero-Trust Adversarial Operating Rule).
- **Execution Branches:**
  - Branch 1: `feat/seam-migration-identity-storage` (Batch 1: SessionSeam, AuthContextSeam, CreationStoreSeam)
  - Branch 2: `feat/seam-migration-generation-transport` (Batch 2: OutputPackagingSeam, ChatInterpretationSeam, MeechieStudioTextSeam, ProviderAdapterSeam)
  - Branch 3: `feat/retire-legacy-seam-stubs` (Batch 3: Import Re-routing, Stub Deprecation, Proof Tape)
- **Dependency Graph:**
  `TICK-MIG-01 -> TICK-MIG-02 -> TICK-MIG-03 -> PR-1 -> TICK-MIG-04 -> TICK-MIG-05 -> TICK-MIG-06 -> TICK-MIG-07 -> PR-2 -> TICK-MIG-08 -> TICK-MIG-09a -> TICK-MIG-09b -> TICK-MIG-09c -> TICK-MIG-10 -> PR-3 -> Merge to main`.

---

### Master Execution Checklist Gate

- [x] **Batch 1: Identity & Storage (`feat/seam-migration-identity-storage`)**
  - [x] `TICK-MIG-01a`: `SessionSeam` Contract, Schemas & `docs/seams.md` Registration
  - [x] `TICK-MIG-01b`: `SessionSeam` Fixtures Module, Mock & Contract Test
  - [x] `TICK-MIG-01c`: `SessionSeam` Canonical Adapter & Re-export Wrapper
  - [x] `TICK-MIG-02a`: `AuthContextSeam` Contract, Validators & Refinement Hardening
  - [x] `TICK-MIG-02b`: `AuthContextSeam` Fixtures Module, Mock & Contract Test
  - [x] `TICK-MIG-02c`: `AuthContextSeam` Canonical Adapter & Re-export Wrapper
  - [x] `TICK-MIG-03a`: `CreationStoreSeam` Contract & Record Schemas
  - [x] `TICK-MIG-03b`: `CreationStoreSeam` Fixtures Module, Mock & Vault Isolation Test
  - [x] `TICK-MIG-03c`: `CreationStoreSeam` Canonical Adapter with Optimistic ID Merge & Malformed Skip
  - [x] `PR-BATCH-1`: Open PR, verify CI checks (`gh pr checks`), address feedback, auto-merge to `main`
- [ ] **Batch 2: Generation & Transport (`feat/seam-migration-generation-transport`)**
  - [x] `TICK-MIG-04a`: `OutputPackagingSeam` Contract & Safe SVG ViewBox Fallback
  - [x] `TICK-MIG-04b`: `OutputPackagingSeam` Fixtures Module, Mock & Contract Test
  - [x] `TICK-MIG-04c`: `OutputPackagingSeam` Canonical Adapter with 8KB Chunked Base64 & Canvas Browser Guard
  - [x] `TICK-MIG-05a`: `ChatInterpretationSeam` Contract & Strict Output Schemas
  - [x] `TICK-MIG-05b`: `ChatInterpretationSeam` Fixtures Module, Mock & Corrupt-JSON Canary Test
  - [x] `TICK-MIG-05c`: `ChatInterpretationSeam` Canonical Adapter & Re-export Wrapper
  - [x] `TICK-MIG-06a`: `MeechieStudioTextSeam` Contract & Studio Text Schemas
  - [x] `TICK-MIG-06b`: `MeechieStudioTextSeam` Fixtures Module, Mock & Pre-Charged Quota Test
  - [x] `TICK-MIG-06c`: `MeechieStudioTextSeam` Canonical Adapter & Re-export Wrapper
  - [x] `TICK-MIG-07a`: `ProviderAdapterSeam` Contract with Injected `AbortSignal` Support
  - [x] `TICK-MIG-07b`: `ProviderAdapterSeam` Fixtures Module, Mock & Secret Redaction Canary Test
  - [x] `TICK-MIG-07c`: `ProviderAdapterSeam` Canonical Adapter with Socket Cancellation & Stream Redaction
  - [x] `PR-BATCH-2`: Open PR, verify CI checks (`gh pr checks`), address feedback, auto-merge to `main`
- [x] **Batch 3: Stub Synchronization & Clean Consumer Imports (`feat/retire-legacy-seam-stubs`)**
  - [x] `TICK-MIG-08a`: Re-route Consumer Imports in API Route & Test Mock (`src/routes/api/meechie-studio-text/+server.ts`, `tests/unit/api-meechie-studio-text-endpoint.test.ts`)
  - [x] `TICK-MIG-08b`: Re-route Consumer Imports in Core Pipelines & Domain (`chat-interpretation-pipeline.ts`, `meechie-studio.ts`, `meechie-studio-text-pipeline.ts`)
  - [x] `TICK-MIG-08c`: Re-route Consumer Imports in Studio State & Components (`studio-state.svelte.ts`, `StudioPreviewPanel.svelte`, `VerdictRow.svelte`)
  - [x] `TICK-MIG-08d`: Re-route Consumer Imports in Mode Pages (`who-fucked-up/+page.svelte`, `random/+page.svelte`, `rate-his-excuse/+page.svelte`)
  - [x] `TICK-MIG-09a`: Re-export Synchronization for Legacy Mocks (Identity & Storage: `session`, `auth-context`, `creation-store`)
  - [x] `TICK-MIG-09b`: Re-export Synchronization for Legacy Mocks (Generation: `output-packaging`, `chat-interpretation`)
  - [x] `TICK-MIG-09c`: Re-export Synchronization for Legacy Mocks (Transport & Studio: `meechie-studio-text`, `provider-adapter`)
  - [x] `TICK-MIG-10`: Final Full Verification Chain, Chamber Lock, Seam Ledger & Proof Tape
  - [x] `PR-BATCH-3`: Open PR, verify CI checks, auto-merge to `main`

---

### Universal Ticket Gate
1. Every ticket touches at most 1–3 closely coupled files (`[NEW]`, `[MODIFY]`, `[DELETE]`).
2. Every code file created or edited must preserve or include top-level comments (`Purpose`, `Why`, `Info flow`, `Invariants`).
3. Contract changes must update `docs/seams.md` with the canonical `(self-contained)` row.
4. Adapters must live at `src/lib/adapters/<name>-seam/index.ts` with legacy flat re-exports at `src/lib/adapters/<name>.adapter.ts`.
5. Every ticket must close with active runtime verification exiting code 0 (including `npm run rewind -- --seam <SeamName>`).

---

### Atomic Ticket Specifications

#### TICK-MIG-01a: SessionSeam Contract, Schemas & Registry
- **Role Title:** Seam Contract Architect
- **Files Allowed:**
  - `[NEW] src/lib/seams/session-seam/contract.ts`
  - `[MODIFY] contracts/session.contract.ts`
  - `[MODIFY] docs/seams.md`
- **What NOT To Touch:** `src/lib/adapters/`, UI routes, `sessionId` property name.
- **Touch Blueprint:**
  - `contract.ts`: Export `SessionContextSchema`, `SessionResultSchema`, `SessionSeam`, `type SessionContext`, `type SessionResult`. Import `Result` from `../../../../contracts/shared.contract`.
  - `contracts/session.contract.ts`: Replace definitions with universal relative export `export * from '../src/lib/seams/session-seam/contract';`.
  - `docs/seams.md`: Verify registration of canonical `SessionSeam (self-contained)` row (already present on disk).
- **Failure Modes:** Circular import back to `contracts/shared.contract.ts`; missing row in `docs/seams.md`.
- **Negative Tests:** Empty string `""` and whitespace-only `"   "` must fail `SessionContextSchema.safeParse`.
- **DoD CLI:** `npx vitest run tests/contract/session.test.ts ; npm run rewind -- --seam SessionSeam`

#### TICK-MIG-01b: SessionSeam Fixtures Module, Mock & Contract Test
- **Role Title:** Seam Verification Engineer
- **Files Allowed:**
  - `[NEW] src/lib/seams/session-seam/fixtures.ts`
  - `[NEW] src/lib/seams/session-seam/mock.ts`
  - `[NEW] src/lib/seams/session-seam/test.ts`
- **What NOT To Touch:** `contracts/`, `src/lib/adapters/`.
- **Touch Blueprint:**
  - `fixtures.ts`: Export typed sample (`{ sessionId: 'session-123' }`) and fault objects (`{ code: 'BROWSER_REQUIRED', message: 'Session access requires a browser environment.' }`).
  - `mock.ts`: Export `createSessionMock(scenario)` implementing `SessionSeam`.
  - `test.ts`: Vitest suite asserting mock compliance and schema validation.
- **Failure Modes:** Mock returning untyped object; test relying on node `fs` to read fixtures.
- **Negative Tests:** Mock in `'fault'` scenario returns `{ ok: false, error: { code: 'BROWSER_REQUIRED', message: 'Session access requires a browser environment.' } }`.
- **DoD CLI:** `npx vitest run src/lib/seams/session-seam/test.ts ; npm run rewind -- --seam "SessionSeam (self-contained)"`

#### TICK-MIG-01c: SessionSeam Canonical Adapter & Re-export Wrapper
- **Role Title:** Browser Session Specialist
- **Files Allowed:**
  - `[NEW] src/lib/adapters/session-seam/index.ts`
  - `[NEW] src/lib/seams/session-seam/probe.ts`
  - `[MODIFY] src/lib/adapters/session.adapter.ts`
- **What NOT To Touch:** `contracts/session.contract.ts`, `src/routes/`.
- **Touch Blueprint:**
  - `index.ts`: Export `sessionAdapter: SessionSeam`. Enforce `browserGuard()` so SSR safely rejects storage access without throwing.
  - `probe.ts`: Export pure probe stub (`// N/A (pure): SessionSeam is probed via browser-seams.probe.mjs; export {};`).
  - `session.adapter.ts`: Re-export `export { sessionAdapter } from './session-seam';` preserving exact downstream symbol.
- **Failure Modes:** SSR `ReferenceError: sessionStorage is not defined`; downstream import mismatch (`sessionAdapter` missing).
- **Negative Tests:** Invoking adapter under Node/SSR environment safely returns `{ ok: false, error: { code: 'BROWSER_REQUIRED' } }`.
- **DoD CLI:** `npx vitest run tests/contract/session.test.ts src/lib/seams/session-seam/test.ts ; npm run rewind -- --seam SessionSeam ; npm run rewind -- --seam "SessionSeam (self-contained)"`

#### TICK-MIG-02a: AuthContextSeam Contract, Validators & Refinement Hardening
- **Role Title:** Authentication Security Specialist
- **Files Allowed:**
  - `[NEW] src/lib/seams/auth-context-seam/contract.ts`
  - `[MODIFY] contracts/auth-context.contract.ts`
  - `[MODIFY] docs/seams.md`
- **What NOT To Touch:** `src/lib/adapters/`, existing role/capability strings.
- **Touch Blueprint:**
  - `contract.ts`: Port `AuthContextSchema`, `AuthContextInputSchema`, `AuthContextResultSchema`, `AuthContextSeam`, and types `AuthContext`, `AuthContextInput`, `AuthContextResult`. Enforce refinement: `kind === 'authenticated'` strictly requires non-empty `userId`.
  - `contracts/auth-context.contract.ts`: Re-export all via `export * from '../src/lib/seams/auth-context-seam/contract';`.
  - `docs/seams.md`: Register canonical `| AuthContextSeam (self-contained) | src/lib/seams/auth-context-seam/contract.ts | src/lib/seams/auth-context-seam/probe.ts | N/A (fixture module: src/lib/seams/auth-context-seam/fixtures.ts) | src/lib/seams/auth-context-seam/mock.ts | src/lib/seams/auth-context-seam/test.ts | src/lib/adapters/auth-context-seam/index.ts | hbpheonix | N/A | self-contained layout |`.
- **Failure Modes:** Refinement bypass allowing authenticated session with undefined `userId`.
- **Negative Tests:** `{ kind: 'authenticated' }` without `userId` must fail Zod validation.
- **DoD CLI:** `npx vitest run tests/contract/auth-context.test.ts ; npm run rewind -- --seam AuthContextSeam`

#### TICK-MIG-02b: AuthContextSeam Fixtures Module, Mock & Contract Test
- **Role Title:** Seam Verification Engineer
- **Files Allowed:**
  - `[NEW] src/lib/seams/auth-context-seam/fixtures.ts`
  - `[NEW] src/lib/seams/auth-context-seam/mock.ts`
  - `[NEW] src/lib/seams/auth-context-seam/test.ts`
- **What NOT To Touch:** Adapters, routes.
- **Touch Blueprint:**
  - `fixtures.ts`: Parse and export sample fixture (`sampleJson`) and fault fixture (`faultJson`, `{ code: 'SESSION_ID_INVALID', message: 'Session ID contains invalid characters.' }`). Do not add fictional scenario fixtures outside `ScenarioSchema`.
  - `mock.ts`: Export `createAuthContextMock(scenario: Scenario): AuthContextSeam`.
  - `test.ts`: Vitest suite covering anonymous, authenticated schema validation, and fault scenario flow.
- **Failure Modes:** Mock diverging from real schema types.
- **Negative Tests:** Fault scenario returns error code `SESSION_ID_INVALID`.
- **DoD CLI:** `npx vitest run src/lib/seams/auth-context-seam/test.ts ; npm run rewind -- --seam "AuthContextSeam (self-contained)"`

#### TICK-MIG-02c: AuthContextSeam Canonical Adapter & Re-export Wrapper
- **Role Title:** Identity Transport Specialist
- **Files Allowed:**
  - `[NEW] src/lib/adapters/auth-context-seam/index.ts`
  - `[NEW] src/lib/seams/auth-context-seam/probe.ts`
  - `[MODIFY] src/lib/adapters/auth-context.adapter.ts`
- **What NOT To Touch:** `contracts/`, `src/lib/core/`.
- **Touch Blueprint:**
  - `index.ts`: Port `authContextAdapter: AuthContextSeam` to consume `./contract` schemas and validate `sessionId` regex.
  - `probe.ts`: Export pure probe stub.
  - `auth-context.adapter.ts`: Re-export `export { authContextAdapter } from './auth-context-seam';`.
- **Failure Modes:** Missing session mapping; exporting non-existent factory instead of `authContextAdapter`.
- **Negative Tests:** Invalid sessionId with illegal characters returns `{ ok: false, error: { code: 'SESSION_ID_INVALID' } }`.
- **DoD CLI:** `npx vitest run tests/contract/auth-context.test.ts src/lib/seams/auth-context-seam/test.ts ; npm run rewind -- --seam AuthContextSeam ; npm run rewind -- --seam "AuthContextSeam (self-contained)"`

#### TICK-MIG-03a: CreationStoreSeam Contract & Record Schemas
- **Role Title:** Data Storage Architect
- **Files Allowed:**
  - `[NEW] src/lib/seams/creation-store-seam/contract.ts`
  - `[MODIFY] contracts/creation-store.contract.ts`
  - `[MODIFY] docs/seams.md`
- **What NOT To Touch:** Key constants (`cb_creations_v1`), `src/lib/adapters/`.
- **Touch Blueprint:**
  - `contract.ts`: Define `CreationOwnerSchema`, `CreationImageSchema`, `CreationRecordSchema`, `DraftRecordSchema`, `SaveCreationInputSchema`, `ListCreationsInputSchema`, `GetCreationInputSchema`, `DeleteCreationInputSchema`, `SaveDraftInputSchema`, `GetDraftInputSchema`, `ClearDraftInputSchema`, `CreationRecordResultSchema`, `CreationListResultSchema`, `DeleteResultSchema`, `DraftSaveResultSchema`, `DraftResultSchema`, `DraftDeleteResultSchema`, `CreationStoreSeam`, and corresponding types. Define `MAX_CREATIONS = 50`. Import `MeechieStudioTextOutputSchema` from `../../../../contracts/meechie-studio-text.contract`.
  - `contracts/creation-store.contract.ts`: Re-export via `export * from '../src/lib/seams/creation-store-seam/contract';`.
  - `docs/seams.md`: Register canonical `| CreationStoreSeam (self-contained) | src/lib/seams/creation-store-seam/contract.ts | src/lib/seams/creation-store-seam/probe.ts | N/A (fixture module: src/lib/seams/creation-store-seam/fixtures.ts) | src/lib/seams/creation-store-seam/mock.ts | src/lib/seams/creation-store-seam/test.ts | src/lib/adapters/creation-store-seam/index.ts | hbpheonix | N/A | self-contained layout |`.
- **Failure Modes:** Dropping `studioText` snapshot types; schema field renames breaking saved records.
- **Negative Tests:** Creation record with non-integer timestamp or missing ID fails validation.
- **DoD CLI:** `npx vitest run tests/contract/creation-store.test.ts ; npm run rewind -- --seam CreationStoreSeam`

#### TICK-MIG-03b: CreationStoreSeam Fixtures Module, Mock & Vault Isolation Test
- **Role Title:** Storage Verification Engineer
- **Files Allowed:**
  - `[NEW] src/lib/seams/creation-store-seam/fixtures.ts`
  - `[NEW] src/lib/seams/creation-store-seam/mock.ts`
  - `[NEW] src/lib/seams/creation-store-seam/test.ts`
- **What NOT To Touch:** Adapter implementation, UI components.
- **Touch Blueprint:**
  - `fixtures.ts`: Parse and export sample fixture (`sampleJson`) and storage fault fixture (`faultJson`, `{ code: 'BROWSER_REQUIRED', message: 'Creation store requires a browser environment.' }`).
  - `mock.ts`: Export in-memory `createCreationStoreMock(scenario)`.
  - `test.ts`: Vitest suite asserting mock scenario fidelity and schema validation.
- **Failure Modes:** Mock swallowing corrupt records without logging skip count.
- **Negative Tests:** Fault scenario returns `BROWSER_REQUIRED` across all operations.
- **DoD CLI:** `npx vitest run src/lib/seams/creation-store-seam/test.ts ; npm run rewind -- --seam "CreationStoreSeam (self-contained)"`

#### TICK-MIG-03c: CreationStoreSeam Canonical Adapter with Optimistic ID Merge & Malformed Skip
- **Role Title:** Browser Storage Specialist
- **Files Allowed:**
  - `[NEW] src/lib/adapters/creation-store-seam/index.ts`
  - `[NEW] src/lib/seams/creation-store-seam/probe.ts`
  - `[MODIFY] src/lib/adapters/creation-store.adapter.ts`
- **What NOT To Touch:** `CREATIONS_KEY` ('cb_creations_v1'), `DRAFT_KEY` ('cb_drafts_v1'), UI routes.
- **Touch Blueprint:**
  - `index.ts`: Implement `creationStoreAdapter: CreationStoreSeam`, `parseRecords`, and `type ParsedRecords` with `browserGuard()`, `readJson()`, `writeJson()`. Enforce `parseRecords` skip logging. Add optimistic ID merge on write to prevent concurrent tab overwrite data loss.
  - `probe.ts`: Export pure probe stub.
  - `creation-store.adapter.ts`: Re-export `export { creationStoreAdapter, parseRecords, type ParsedRecords } from './creation-store-seam';`.
- **Failure Modes:** DOMException 22 (QuotaExceededError) throwing uncaught exception; exporting factory instead of `creationStoreAdapter`.
- **Negative Tests:** Non-array JSON payload (`"{}"`) stored in localStorage safely returns empty array without crash.
- **DoD CLI:** `npx vitest run tests/contract/creation-store.test.ts tests/unit/creation-store-helpers.test.ts src/lib/seams/creation-store-seam/test.ts ; npm run rewind -- --seam CreationStoreSeam ; npm run rewind -- --seam "CreationStoreSeam (self-contained)"`

#### TICK-MIG-04a: OutputPackagingSeam Contract & Safe SVG ViewBox Fallback
- **Role Title:** Document Generation Architect
- **Files Allowed:**
  - `[NEW] src/lib/seams/output-packaging-seam/contract.ts`
  - `[MODIFY] contracts/output-packaging.contract.ts`
  - `[MODIFY] docs/seams.md`
- **What NOT To Touch:** `src/lib/adapters/`, output MIME type constants.
- **Touch Blueprint:**
  - `contract.ts`: Import `OutputFormatSchema`, `PageSizeSchema` from `$lib/seams/spec-validation-seam/contract`. Import `GeneratedImageSchema` from `$lib/seams/image-generation-seam/contract`. Define `OutputVariantSchema`, `PackagedFileSchema`, `OutputPackagingInputSchema`, `OutputPackagingOutputSchema`, `OutputPackagingResultSchema`, `OutputPackagingSeam`, and types `OutputVariant`, `PackagedFile`, `OutputPackagingInput`, `OutputPackagingOutput`.
  - `contracts/output-packaging.contract.ts`: Re-export via `export * from '../src/lib/seams/output-packaging-seam/contract';`.
  - `docs/seams.md`: Register canonical `| OutputPackagingSeam (self-contained) | src/lib/seams/output-packaging-seam/contract.ts | src/lib/seams/output-packaging-seam/probe.ts | N/A (fixture module: src/lib/seams/output-packaging-seam/fixtures.ts) | src/lib/seams/output-packaging-seam/mock.ts | src/lib/seams/output-packaging-seam/test.ts | src/lib/adapters/output-packaging-seam/index.ts | hbpheonix | N/A | self-contained layout |`.
- **Failure Modes:** Relative back-edge imports to `contracts/`; schema mismatch with `spec-validation-seam`.
- **Negative Tests:** Missing `fileBaseName` fails schema validation; empty `images` array is schema-valid but returns `{ code: 'NO_IMAGES' }` error envelope from adapter/mock.
- **DoD CLI:** `npx vitest run tests/contract/output-packaging.test.ts ; npm run rewind -- --seam OutputPackagingSeam`

#### TICK-MIG-04b: OutputPackagingSeam Fixtures Module, Mock & Contract Test
- **Role Title:** Seam Verification Engineer
- **Files Allowed:**
  - `[NEW] src/lib/seams/output-packaging-seam/fixtures.ts`
  - `[NEW] src/lib/seams/output-packaging-seam/mock.ts`
  - `[NEW] src/lib/seams/output-packaging-seam/test.ts`
- **What NOT To Touch:** `output-packaging.adapter.ts`, UI download triggers.
- **Touch Blueprint:**
  - `fixtures.ts`: Parse and export sample fixture (`sampleJson`) and fault fixture (`faultJson`, `{ code: 'NO_IMAGES', message: 'No images provided for packaging.' }`).
  - `mock.ts`: Export `createOutputPackagingMock(scenario)`.
  - `test.ts`: Vitest suite validating contract output shapes without requiring real Canvas/DOM binaries.
- **Failure Modes:** Test throwing `HTMLCanvasElement.getContext() is not implemented` under Node.
- **Negative Tests:** Mock in fault scenario returns `{ ok: false, error: { code: 'NO_IMAGES', message: 'No images provided for packaging.' } }`.
- **DoD CLI:** `npx vitest run src/lib/seams/output-packaging-seam/test.ts ; npm run rewind -- --seam "OutputPackagingSeam (self-contained)"`

#### TICK-MIG-04c: OutputPackagingSeam Canonical Adapter with 8KB Chunked Base64 & Canvas Guard
- **Role Title:** Client-side Asset Pipeline Engineer
- **Files Allowed:**
  - `[NEW] src/lib/adapters/output-packaging-seam/index.ts`
  - `[NEW] src/lib/seams/output-packaging-seam/probe.ts`
  - `[MODIFY] src/lib/adapters/output-packaging.adapter.ts`
- **What NOT To Touch:** `pdf-lib` core logic, page size definitions.
- **Touch Blueprint:**
  - `index.ts`: Implement `outputPackagingAdapter: OutputPackagingSeam`. Replace naive 4-million-iteration string concatenation with 8KB slice chunking in `toBase64()`. Guard Canvas operations with `browserGuard()`. Parse SVG `viewBox` when explicit `width`/`height` are missing.
  - `probe.ts`: Export pure probe stub.
  - `output-packaging.adapter.ts`: Re-export `export { outputPackagingAdapter } from './output-packaging-seam';`.
- **Failure Modes:** V8 heap allocation exhaustion on 300DPI images; exporting factory instead of `outputPackagingAdapter`.
- **Negative Tests:** SVG with only `viewBox="0 0 1000 500"` correctly computes 2:1 aspect ratio canvas bounds.
- **DoD CLI:** `npx vitest run tests/contract/output-packaging.test.ts tests/unit/output-packaging-helpers.test.ts src/lib/seams/output-packaging-seam/test.ts ; npm run rewind -- --seam OutputPackagingSeam ; npm run rewind -- --seam "OutputPackagingSeam (self-contained)"`

#### TICK-MIG-05a: ChatInterpretationSeam Contract & Strict Output Schemas
- **Role Title:** Conversational Intent Architect
- **Files Allowed:**
  - `[NEW] src/lib/seams/chat-interpretation-seam/contract.ts`
  - `[MODIFY] contracts/chat-interpretation.contract.ts`
  - `[MODIFY] docs/seams.md`
- **What NOT To Touch:** Prompt schema structures, UI chat panels.
- **Touch Blueprint:**
  - `contract.ts`: Define `ChatInterpretationInputSchema`, `ChatInterpretationOutputSchema`, `ChatInterpretationResultSchema`, `ChatInterpretationSeam`, and types `ChatInterpretationInput`, `ChatInterpretationOutput`.
  - `contracts/chat-interpretation.contract.ts`: Re-export via `export * from '../src/lib/seams/chat-interpretation-seam/contract';`.
  - `docs/seams.md`: Register canonical `| ChatInterpretationSeam (self-contained) | src/lib/seams/chat-interpretation-seam/contract.ts | src/lib/seams/chat-interpretation-seam/probe.ts | N/A (fixture module: src/lib/seams/chat-interpretation-seam/fixtures.ts) | src/lib/seams/chat-interpretation-seam/mock.ts | src/lib/seams/chat-interpretation-seam/test.ts | src/lib/adapters/chat-interpretation-seam/index.ts | hbpheonix | N/A | self-contained layout |`.
- **Failure Modes:** Relaxed schemas accepting empty response text.
- **Negative Tests:** Empty user input message fails `ChatInterpretationInputSchema.safeParse`.
- **DoD CLI:** `npx vitest run tests/contract/chat-interpretation.test.ts ; npm run rewind -- --seam ChatInterpretationSeam`

#### TICK-MIG-05b: ChatInterpretationSeam Fixtures Module, Mock & Corrupt-JSON Canary Test
- **Role Title:** Seam Verification Engineer
- **Files Allowed:**
  - `[NEW] src/lib/seams/chat-interpretation-seam/fixtures.ts`
  - `[NEW] src/lib/seams/chat-interpretation-seam/mock.ts`
  - `[NEW] src/lib/seams/chat-interpretation-seam/test.ts`
- **What NOT To Touch:** Adapter code, `src/lib/core/`.
- **Touch Blueprint:**
  - `fixtures.ts`: Parse and export sample fixture (`sampleJson`) and fault fixture (`faultJson`, `{ code: 'CHAT_RESPONSE_INVALID', message: 'Chat interpretation response did not match contract.' }`).
  - `mock.ts`: Export `createChatInterpretationMock(scenario)`.
  - `test.ts`: Vitest suite asserting error handling when model emits invalid JSON.
- **Failure Modes:** Mock silently masking parse errors into empty objects `{}`.
- **Negative Tests:** Fault scenario returns error code `CHAT_RESPONSE_INVALID`.
- **DoD CLI:** `npx vitest run src/lib/seams/chat-interpretation-seam/test.ts ; npm run rewind -- --seam "ChatInterpretationSeam (self-contained)"`

#### TICK-MIG-05c: ChatInterpretationSeam Canonical Adapter & Re-export Wrapper
- **Role Title:** Intent Pipeline Specialist
- **Files Allowed:**
  - `[NEW] src/lib/adapters/chat-interpretation-seam/index.ts`
  - `[NEW] src/lib/seams/chat-interpretation-seam/probe.ts`
  - `[MODIFY] src/lib/adapters/chat-interpretation.adapter.ts`
- **What NOT To Touch:** Route status serialization, rate limiting.
- **Touch Blueprint:**
  - `index.ts`: Port `chatInterpretationAdapter: ChatInterpretationSeam` to call `fetch('/api/chat-interpretation')` with JSON body and validate response against `ChatInterpretationResultSchema`. Return strict `Result<ChatInterpretationOutput>`.
  - `probe.ts`: Export pure probe stub (or wrap probe).
  - `chat-interpretation.adapter.ts`: Re-export `export { chatInterpretationAdapter } from './chat-interpretation-seam';`.
- **Failure Modes:** Network error throwing unhandled exception; exporting factory instead of `chatInterpretationAdapter`.
- **Negative Tests:** Non-2xx response without structured error payload returns `CHAT_HTTP_ERROR`; malformed JSON returns `CHAT_RESPONSE_INVALID`.
- **DoD CLI:** `npx vitest run tests/contract/chat-interpretation.test.ts tests/unit/api-chat-interpretation.test.ts src/lib/seams/chat-interpretation-seam/test.ts ; npm run rewind -- --seam ChatInterpretationSeam ; npm run rewind -- --seam "ChatInterpretationSeam (self-contained)"`

#### TICK-MIG-06a: MeechieStudioTextSeam Contract & Studio Text Schemas
- **Role Title:** Voice Synthesis Architect
- **Files Allowed:**
  - `[NEW] src/lib/seams/meechie-studio-text-seam/contract.ts`
  - `[MODIFY] contracts/meechie-studio-text.contract.ts`
  - `[MODIFY] docs/seams.md`
- **What NOT To Touch:** Landlord seed text, voice pack lines.
- **Touch Blueprint:**
  - `contract.ts`: Export `MeechieStudioTextActionSchema`, `MeechieStudioVoiceSettingsSchema`, `MeechieStudioCurrentTextSchema`, `MeechieStudioTextInputSchema`, `MeechieStudioQualityStateSchema`, `MeechieStudioPageItemSchema`, `MeechieStudioTextOutputSchema`, `MeechieStudioTextResultSchema`, `MeechieStudioTextSeam`, and types `MeechieStudioTextAction`, `MeechieStudioVoiceSettings`, `MeechieStudioCurrentText`, `MeechieStudioTextInput`, `MeechieStudioTextOutput`.
  - `contracts/meechie-studio-text.contract.ts`: Re-export via `export * from '../src/lib/seams/meechie-studio-text-seam/contract';`.
  - `docs/seams.md`: Register canonical `| MeechieStudioTextSeam (self-contained) | src/lib/seams/meechie-studio-text-seam/contract.ts | src/lib/seams/meechie-studio-text-seam/probe.ts | N/A (fixture module: src/lib/seams/meechie-studio-text-seam/fixtures.ts) | src/lib/seams/meechie-studio-text-seam/mock.ts | src/lib/seams/meechie-studio-text-seam/test.ts | src/lib/adapters/meechie-studio-text-seam/index.ts | hbpheonix | N/A | self-contained layout |`.
- **Failure Modes:** Mismatched title or item length limits against `SpecValidationSeam`.
- **Negative Tests:** `pageItems` array with fewer than 2 or more than 6 items fails schema validation.
- **DoD CLI:** `npx vitest run tests/contract/meechie-studio-text.test.ts ; npm run rewind -- --seam MeechieStudioTextSeam`

#### TICK-MIG-06b: MeechieStudioTextSeam Fixtures Module, Mock & Pre-Charged Quota Test
- **Role Title:** Seam Verification Engineer
- **Files Allowed:**
  - `[NEW] src/lib/seams/meechie-studio-text-seam/fixtures.ts`
  - `[NEW] src/lib/seams/meechie-studio-text-seam/mock.ts`
  - `[NEW] src/lib/seams/meechie-studio-text-seam/test.ts`
- **What NOT To Touch:** `meechie-studio-text-pipeline.ts`.
- **Touch Blueprint:**
  - `fixtures.ts`: Parse and export sample fixture (`sampleJson`) and fault fixture (`faultJson`, `{ code: 'MEECHIE_STUDIO_TEXT_PROVIDER_INVALID', message: 'Provider text response did not match contract.' }`).
  - `mock.ts`: Export `createMeechieStudioTextMock(scenario)`.
  - `test.ts`: Vitest suite asserting single-attempt bounded correction retry.
- **Failure Modes:** Infinite retry loop on invalid spec outputs.
- **Negative Tests:** Second invalid attempt immediately halts and returns `MEECHIE_STUDIO_TEXT_PROVIDER_INVALID`.
- **DoD CLI:** `npx vitest run src/lib/seams/meechie-studio-text-seam/test.ts ; npm run rewind -- --seam "MeechieStudioTextSeam (self-contained)"`

#### TICK-MIG-06c: MeechieStudioTextSeam Canonical Adapter & Re-export Wrapper
- **Role Title:** Studio Generation Engineer
- **Files Allowed:**
  - `[NEW] src/lib/adapters/meechie-studio-text-seam/index.ts`
  - `[NEW] src/lib/seams/meechie-studio-text-seam/probe.ts`
  - `[MODIFY] src/lib/adapters/meechie-studio-text.adapter.ts`
- **What NOT To Touch:** `RateLimitGuard` shared secret, route files.
- **Touch Blueprint:**
  - `index.ts`: Implement `createMeechieStudioTextAdapter(deps)` consuming `$lib/seams/meechie-studio-text-seam/contract`. Consume pre-charged rate limit quota context.
  - `probe.ts`: Export pure probe stub.
  - `meechie-studio-text.adapter.ts`: Re-export `export { createMeechieStudioTextAdapter } from './meechie-studio-text-seam';`.
- **Failure Modes:** Double-charging 2 units when a studio correction retry occurs.
- **Negative Tests:** Verifies rate limit quota is consumed up front once for the 2-unit studio budget.
- **DoD CLI:** `npx vitest run tests/contract/meechie-studio-text.test.ts tests/unit/meechie-studio-text-pipeline.test.ts src/lib/seams/meechie-studio-text-seam/test.ts ; npm run rewind -- --seam MeechieStudioTextSeam ; npm run rewind -- --seam "MeechieStudioTextSeam (self-contained)"`

#### TICK-MIG-07a: ProviderAdapterSeam Contract with Injected AbortSignal Support
- **Role Title:** AI Transport Architect
- **Files Allowed:**
  - `[NEW] src/lib/seams/provider-adapter-seam/contract.ts`
  - `[MODIFY] contracts/provider-adapter.contract.ts`
  - `[MODIFY] docs/seams.md`
- **What NOT To Touch:** Pinned model IDs (`grok-imagine-image`, `grok-imagine-image-2.0`).
- **Touch Blueprint:**
  - `contract.ts`: Export `ProviderChatMessageSchema`, `ProviderChatInputSchema`, `ProviderChatOutputSchema`, `ProviderImageInputSchema`, `ProviderImageSchema`, `ProviderImageOutputSchema`, `ProviderChatResultSchema`, `ProviderImageResultSchema`, `ProviderAdapterSeam`, and types `ProviderChatMessage`, `ProviderChatInput`, `ProviderChatOutput`, `ProviderImageInput`, `ProviderImageOutput`. Add optional `signal?: AbortSignal` to input schemas for HTTP cancellation.
  - `contracts/provider-adapter.contract.ts`: Re-export via `export * from '../src/lib/seams/provider-adapter-seam/contract';`.
  - `docs/seams.md`: Register canonical `| ProviderAdapterSeam (self-contained) | src/lib/seams/provider-adapter-seam/contract.ts | src/lib/seams/provider-adapter-seam/probe.ts | N/A (fixture module: src/lib/seams/provider-adapter-seam/fixtures.ts) | src/lib/seams/provider-adapter-seam/mock.ts | src/lib/seams/provider-adapter-seam/test.ts | src/lib/adapters/provider-adapter-seam/index.ts | hbpheonix | N/A | self-contained layout |`.
- **Failure Modes:** Dropping `b64_json` support for image outputs.
- **Negative Tests:** Invalid `responseFormat` (e.g. `'xml'`) fails validation.
- **DoD CLI:** `npx vitest run tests/contract/provider-adapter.test.ts ; npm run rewind -- --seam ProviderAdapterSeam`

#### TICK-MIG-07b: ProviderAdapterSeam Fixtures Module, Mock & Secret Redaction Canary Test
- **Role Title:** Seam Verification Engineer
- **Files Allowed:**
  - `[NEW] src/lib/seams/provider-adapter-seam/fixtures.ts`
  - `[NEW] src/lib/seams/provider-adapter-seam/mock.ts`
  - `[NEW] src/lib/seams/provider-adapter-seam/test.ts`
- **What NOT To Touch:** Live credentials (`.env`).
- **Touch Blueprint:**
  - `fixtures.ts`: Parse and export sample fixture (`sampleJson`) and fault fixture (`faultJson`, `{ code: 'PROVIDER_HTTP_ERROR', message: 'Model not found: grok-4.6-bad', details: { status: '400' } }`).
  - `mock.ts`: Export `createProviderAdapterMock(scenario)`.
  - `test.ts`: Vitest suite verifying mock fidelity and credential canary redaction.
- **Failure Modes:** Mock failing to simulate 110s timeout abort.
- **Negative Tests:** Fault scenario returns `PROVIDER_HTTP_ERROR` for chat and image operations.
- **DoD CLI:** `npx vitest run src/lib/seams/provider-adapter-seam/test.ts ; npm run rewind -- --seam "ProviderAdapterSeam (self-contained)"`

#### TICK-MIG-07c: ProviderAdapterSeam Canonical Adapter with Socket Cancellation & Stream Redaction
- **Role Title:** External Provider Network Specialist
- **Files Allowed:**
  - `[NEW] src/lib/adapters/provider-adapter-seam/index.ts`
  - `[NEW] src/lib/seams/provider-adapter-seam/probe.ts`
  - `[MODIFY] src/lib/adapters/provider-adapter.adapter.ts`
- **What NOT To Touch:** `CHAT_TIMEOUT_MS = 110_000`, `CHAT_RETRY_OPTIONS` single-attempt policy.
- **Touch Blueprint:**
  - `index.ts`: Port xAI chat and image transport. Export `createProviderAdapter(config)`, `providerAdapter`, and `type ProviderAdapterConfig`. Forward `signal` directly to `fetchWithTimeout` to abort hanging sockets immediately upon client disconnect. Apply `redactProviderMessage()` to all upstream error envelopes.
  - `probe.ts`: Export probe stub.
  - `provider-adapter.adapter.ts`: Re-export `export { createProviderAdapter, providerAdapter, type ProviderAdapterConfig } from './provider-adapter-seam';`.
- **Failure Modes:** Socket hanging open for 110s after caller abort; leaking bearer key in error details; missing `providerAdapter` default instance export.
- **Negative Tests:** Immediate abort signal triggers `ABORT_ERROR` within 50ms, closing the underlying connection.
- **DoD CLI:** `npx vitest run tests/contract/provider-adapter.test.ts tests/unit/provider-adapter-helpers.test.ts src/lib/seams/provider-adapter-seam/test.ts ; npm run rewind -- --seam ProviderAdapterSeam ; npm run rewind -- --seam "ProviderAdapterSeam (self-contained)"`

#### TICK-MIG-08a: Re-route Consumer Imports in API Route & Test Mock
- **Role Title:** Route Integration Specialist
- **Files Allowed:**
  - `[MODIFY] src/routes/api/meechie-studio-text/+server.ts`
  - `[MODIFY] tests/unit/api-meechie-studio-text-endpoint.test.ts`
- **What NOT To Touch:** Route response status mapping, rate limit checks.
- **Touch Blueprint:**
  - `src/routes/api/meechie-studio-text/+server.ts`: Update provider import from `$lib/adapters/provider-adapter.adapter` to `$lib/adapters/provider-adapter-seam`.
  - `tests/unit/api-meechie-studio-text-endpoint.test.ts`: Update `vi.mock('$lib/adapters/provider-adapter.adapter')` and import to target `$lib/adapters/provider-adapter-seam` to preserve test mock isolation.
- **Failure Modes:** Breaking runtime request handler type bindings; unmocked provider network calls in unit tests.
- **Negative Tests:** Malformed POST body to endpoints returns 400 with unchanged error schema.
- **DoD CLI:** `npm run check; npx vitest run tests/unit/api-meechie-studio-text-endpoint.test.ts`

#### TICK-MIG-08b: Re-route Consumer Imports in Core Pipelines & Domain
- **Role Title:** Core Pipeline Specialist
- **Files Allowed:**
  - `[MODIFY] src/lib/core/chat-interpretation-pipeline.ts`
  - `[MODIFY] src/lib/core/meechie-studio.ts`
  - `[MODIFY] src/lib/core/meechie-studio-text-pipeline.ts`
- **What NOT To Touch:** Pipeline business logic, error sanitization.
- **Touch Blueprint:**
  - `chat-interpretation-pipeline.ts`: Update imports from `contracts/chat-interpretation.contract` to `$lib/seams/chat-interpretation-seam/contract` and provider adapter to `$lib/adapters/provider-adapter-seam`.
  - `meechie-studio.ts`: Update imports from `contracts/creation-store.contract` to `$lib/seams/creation-store-seam/contract` and `contracts/meechie-studio-text.contract` to `$lib/seams/meechie-studio-text-seam/contract`.
  - `meechie-studio-text-pipeline.ts`: Update imports from `contracts/meechie-studio-text.contract` to `$lib/seams/meechie-studio-text-seam/contract` and `contracts/provider-adapter.contract` to `$lib/seams/provider-adapter-seam/contract`.
- **Failure Modes:** Cycle between core pipelines and seam contracts.
- **Negative Tests:** Pipelines continue validating specs and returning Result types cleanly.
- **DoD CLI:** `npm run check; npx vitest run tests/unit/pipeline-edge-cases.test.ts tests/unit/meechie-studio.test.ts`

#### TICK-MIG-08c: Re-route Consumer Imports in Studio State & Components
- **Role Title:** UI Integration Specialist
- **Files Allowed:**
  - `[MODIFY] src/routes/studio-state.svelte.ts`
  - `[MODIFY] src/lib/components/studio/StudioPreviewPanel.svelte`
  - `[MODIFY] src/lib/components/studio/VerdictRow.svelte`
- **What NOT To Touch:** Component markup, reactive state management.
- **Touch Blueprint:**
  - `studio-state.svelte.ts`: Re-route imports from legacy flat adapters (`auth-context`, `creation-store`, `output-packaging`, `session`) to canonical paths `$lib/adapters/<name>-seam`, and contract schemas (`creation-store`, `output-packaging`, `meechie-studio-text`) to `$lib/seams/<name>-seam/contract`.
  - `StudioPreviewPanel.svelte`: Re-route `MeechieStudioTextOutput` and `PackagedFile` imports to `$lib/seams/meechie-studio-text-seam/contract` and `$lib/seams/output-packaging-seam/contract`.
  - `VerdictRow.svelte`: Re-route `MeechieStudioTextOutput` and `CreationRecord` imports to `$lib/seams/meechie-studio-text-seam/contract` and `$lib/seams/creation-store-seam/contract`.
- **Failure Modes:** Type mismatch in state store bindings.
- **Negative Tests:** `studio-state.svelte.ts` initializes cleanly without type errors.
- **DoD CLI:** `npm run check; npx vitest run tests/unit/studio-state.test.ts`

#### TICK-MIG-08d: Re-route Consumer Imports in Mode Pages
- **Role Title:** Mode Page Integration Specialist
- **Files Allowed:**
  - `[MODIFY] src/routes/who-fucked-up/+page.svelte`
  - `[MODIFY] src/routes/random/+page.svelte`
  - `[MODIFY] src/routes/rate-his-excuse/+page.svelte`
- **What NOT To Touch:** Page styles, interactive elements.
- **Touch Blueprint:**
  - `who-fucked-up/+page.svelte`: Re-route `PackagedFile` to `$lib/seams/output-packaging-seam/contract` and `outputPackagingAdapter` to `$lib/adapters/output-packaging-seam`.
  - `random/+page.svelte`: Re-route `PackagedFile` to `$lib/seams/output-packaging-seam/contract` and `outputPackagingAdapter` to `$lib/adapters/output-packaging-seam`.
  - `rate-his-excuse/+page.svelte`: Re-route `PackagedFile` to `$lib/seams/output-packaging-seam/contract` and `outputPackagingAdapter` to `$lib/adapters/output-packaging-seam`.
- **Failure Modes:** Broken import paths in SvelteKit page bundles.
- **Negative Tests:** All three mode pages compile with 0 Svelte diagnostics.
- **DoD CLI:** `npm run check`

#### TICK-MIG-09a: Re-export Synchronization for Legacy Mocks (Identity & Storage)
- **Role Title:** Test Infrastructure Specialist
- **Files Allowed:**
  - `[MODIFY] src/lib/mocks/session.mock.ts`
  - `[MODIFY] src/lib/mocks/auth-context.mock.ts`
  - `[MODIFY] src/lib/mocks/creation-store.mock.ts`
- **What NOT To Touch:** Legacy mock export names (`createSessionMock`, `createAuthContextMock`, `createCreationStoreMock`).
- **Touch Blueprint:**
  - `src/lib/mocks/session.mock.ts`: Replace implementation with `export { createSessionMock } from '$lib/seams/session-seam/mock';`.
  - `src/lib/mocks/auth-context.mock.ts`: Replace implementation with `export { createAuthContextMock } from '$lib/seams/auth-context-seam/mock';`.
  - `src/lib/mocks/creation-store.mock.ts`: Replace implementation with `export { createCreationStoreMock } from '$lib/seams/creation-store-seam/mock';`.
- **Failure Modes:** Export name mismatch breaking contract test imports.
- **Negative Tests:** `tests/contract/{session,auth-context,creation-store}.test.ts` pass with 100% fixture parity.
- **DoD CLI:** `npx vitest run tests/contract/session.test.ts tests/contract/auth-context.test.ts tests/contract/creation-store.test.ts`

#### TICK-MIG-09b: Re-export Synchronization for Legacy Mocks (Generation)
- **Role Title:** Test Infrastructure Specialist
- **Files Allowed:**
  - `[MODIFY] src/lib/mocks/output-packaging.mock.ts`
  - `[MODIFY] src/lib/mocks/chat-interpretation.mock.ts`
- **What NOT To Touch:** Existing mock export signatures.
- **Touch Blueprint:**
  - `src/lib/mocks/output-packaging.mock.ts`: Replace implementation with `export { createOutputPackagingMock } from '$lib/seams/output-packaging-seam/mock';`.
  - `src/lib/mocks/chat-interpretation.mock.ts`: Replace implementation with `export { createChatInterpretationMock } from '$lib/seams/chat-interpretation-seam/mock';`.
- **Failure Modes:** Divergent mock behaviors between legacy path and canonical path.
- **Negative Tests:** All legacy contract tests pass using canonical mock logic.
- **DoD CLI:** `npx vitest run tests/contract/output-packaging.test.ts tests/contract/chat-interpretation.test.ts`

#### TICK-MIG-09c: Re-export Synchronization for Legacy Mocks (Transport & Studio)
- **Role Title:** Test Infrastructure Specialist
- **Files Allowed:**
  - `[MODIFY] src/lib/mocks/meechie-studio-text.mock.ts`
  - `[MODIFY] src/lib/mocks/provider-adapter.mock.ts`
- **What NOT To Touch:** Existing mock export signatures (`createMeechieStudioTextMock`, `createProviderAdapterMock`).
- **Touch Blueprint:**
  - `src/lib/mocks/meechie-studio-text.mock.ts`: Replace implementation with `export { createMeechieStudioTextMock } from '$lib/seams/meechie-studio-text-seam/mock';`.
  - `src/lib/mocks/provider-adapter.mock.ts`: Replace implementation with `export { createProviderAdapterMock } from '$lib/seams/provider-adapter-seam/mock';`.
- **Failure Modes:** Divergent mock behaviors between legacy path and canonical path.
- **Negative Tests:** Both legacy contract tests pass using canonical mock logic.
- **DoD CLI:** `npx vitest run tests/contract/meechie-studio-text.test.ts tests/contract/provider-adapter.test.ts`

#### TICK-MIG-10: Final Full Verification Chain, Chamber Lock & Proof Tape
- **Role Title:** Principal Quality Assurance Auditor
- **Files Allowed:**
  - `[MODIFY] docs/seams.md`
  - `[MODIFY] CHANGELOG.md`
  - `[NEW] docs/evidence/2026-09-05/` (Generated evidence suite: `verify.txt`, `test.txt`, `chamber-lock.json`, `shaolin-lint.json`, `assumption-alarm.json`, `seam-ledger.json`, `seam-ledger.md`, `clan-chain.json`, `proof-tape.json`, `proof-tape.md`)
- **What NOT To Touch:** Source code, contracts, adapters.
- **Touch Blueprint:**
  - Update `docs/seams.md` notes column for all 7 legacy rows documenting canonical self-contained migration and confirming backwards-compatibility wrappers.
  - Update `CHANGELOG.md` with dated entry for Seam Migration v2.0 completion.
  - Execute `npm run verify` to generate fresh, synchronized evidence across all verification stages without shaolin-lint mtime invalidation.
- **Failure Modes:** Chamber lock failure due to missing artifact; Shaolin lint evidence freshness rejection.
- **Negative Tests:** Any missing seam fixture or test causes `npm run verify` to halt with non-zero code.
- **DoD CLI:** `npm run verify`

---

### Final Definition of Done & Merge Gate
The autonomous pull requests (`feat/seam-migration-identity-storage`, `feat/seam-migration-generation-transport`, `feat/retire-legacy-seam-stubs`) may be auto-merged into `main` without asking ONLY when every condition below is satisfied:
1. `npm run check` exits code 0 (0 Svelte/TypeScript compiler diagnostics).
2. `npm run lint` exits code 0 (0 ESLint errors/warnings).
3. `npm test` exits code 0 (all unit/contract tests pass with 0 failures, 0 errors).
4. `npm run verify` exits code 0 (Chamber lock, Shaolin lint, Seam ledger, Clan chain, Proof tape green).
5. GitHub CLI CI checks pass on current head (`gh pr checks` reports success).
6. 0 unaddressed bot or human review threads.
7. Working tree clean, branch pushed, zero merge conflicts against `origin/main`.

---

### Self-Critique
- **What could be wrong:** Canvas conversion in `OutputPackagingSeam` might require an isolated Web Worker or fake JSDOM context during server tests; optimistic write deduplication in `CreationStoreSeam` could encounter storage quota limits if users exceed 50 creations; import re-routing across routes could expose latent typing mismatches in endpoint inputs.
- **What must be proven:** All 7 seams operate self-contained under `src/lib/seams/<name>-seam/` with zero back-edges to `contracts/`; `npm run verify` and `npm test` pass with code 0 on each batch; no data loss on corrupted vault JSON; no unhandled promise rejections on provider socket timeout.
- **Riskiest assumption:** That all callers of legacy flat contracts in `src/routes/` and `src/lib/core/` can be re-routed to `$lib/seams/` without circular dependency deadlock.
- **Evidence that disproves the plan:** A single failing test in `npm test`, a non-zero exit from `npm run verify`, any lingering reference to deleted stubs found by `git grep`, or a CI failure reported by `gh pr checks`.

---
## The Wig Try-On becomes a shop you can browse and a try-on you can keep (2026-09-05)

Run 5 of the scheduled worst-feature routine. The case against the feature is recorded in
`WORST_TO_BEST_LOG.md`; this is the execution spec.

**Goal:** the wig catalog loads through the seam it already owns and says so when it cannot; it can
be searched, filtered and sorted on the metadata every wig already carries; trying on a second wig
stops destroying the first; and a coloring page made from a try-on portrait reaches the Quote Vault
like every other page in the app.

**Seams touched: none.** `WigCatalogSeam` is *consumed* through its existing adapter
(`src/lib/adapters/wig-catalog-seam/index.ts`) exactly as `/api/wig-try-on` already consumes it, and
`CreationStoreSeam`, `SpecValidationSeam` and `OutputPackagingSeam` through the adapters
`studio-state.svelte.ts` already calls. No file under `contracts/`, `probes/`, `fixtures/`,
`src/lib/mocks/`, `tests/contract/`, `src/lib/adapters/` or `src/lib/seams/` is in the diff, no
contract shape changes, and nothing crosses a seam boundary differently than it does today — so the
full Seam-Driven Development workflow is not triggered and no Cipher Gate entry is required. The
change moves the UI *onto* a seam it was bypassing; it does not alter the seam.

**Files:**
- `src/lib/core/wig-catalog-gallery.ts` (new) — pure, dependency-free transforms: searchable text,
  facet construction with cross-filtered counts, query application, sorting, labels.
- `src/routes/+page.ts` (new) — read the catalog through `createWigCatalogSeam().listWigs()` in
  `load`, so it runs on the server as well as the client and the cards and their affiliate links are
  in the server-rendered HTML. (Revised during the run: the first version read the seam from a
  component `$effect`, which does not run during SSR and removed the catalog from the initial HTML.)
- `src/lib/components/WigCarousel.svelte` — presentational, taking `wigs` and `loadError` as props;
  surface `WIG_CATALOG_EMPTY` / `WIG_CATALOG_LOAD_FAILED`, render the search box, facet chips, sort
  control, result count, empty state, and the metadata the cards were hiding.
- `src/lib/components/studio/WigTryOnStudio.svelte` — the compare strip over portraits already made.
- `src/routes/studio-state.svelte.ts` — portraits keyed by wig id instead of one string; a new
  selfie clears them all; the try-on page gets a real title, a real assembled prompt, and can be
  saved.
- `src/routes/+page.svelte` — prop wiring and the styles for the new rows.
- `tests/unit/wig-catalog-gallery.test.ts` (new), `tests/unit/studio-state.test.ts`,
  `tests/e2e/smoke.spec.ts`.
- `CHANGELOG.md`, `CLAUDE.md`, `DECISIONS.md`, `LESSONS_LEARNED.md`, `WORST_TO_BEST_LOG.md`.

**Commands:** `npm run check`, `npm run lint`, `npm test`, `npm run build`, `npm run verify`,
`npx playwright test`.

**Self-critique:**
- *Riskiest assumption:* that facet counts can be shown at all without lying. Counting each value
  against the whole catalog is the easy version and is wrong in exactly the way this run exists to
  fix — a chip reading "Blonde (1)" that yields nothing because another facet excludes it is a
  control that lies about itself. So each count is computed against the search and every *other*
  dimension, and a value that would add nothing is disabled rather than shown as a dead end. This
  is more code and it is the whole point.
- *What must be proven, and how:* that switching wigs no longer destroys the previous portrait, and
  that changing the selfie *does* destroy all of them — the second is the correctness half, because
  a kept portrait of the old face relabelled under a new one is worse than losing it. Both get
  tests, and both are confirmed by deleting the guard and watching the test fail.
- *What could be wrong:* relaxing `saveToVault` to accept a page with no studio text. The record
  schema already makes `studioText` optional and `loadCreation` already handles records without it,
  but `assembledPrompt` is `NonEmptyStringSchema`, so the try-on path must supply one. It supplies a
  description of the page rather than a machine prompt, because `loadCreation` puts the record's own
  words in the evidence box and a prompt there gets shipped to the provider as user facts — the
  defect the comment at that call site already records.

## `/m/[mode]` becomes a real mode page (2026-09-04)

Active plan for run 4 of the scheduled "worst feature -> best feature" task recorded in
`WORST_TO_BEST_LOG.md`. Supersedes the plans below as the current active plan.

### Plan

- **Goal:** `/m/[mode]` — the only page five of the eight modes have, and the destination of every
  focused-mode link on the home page — stops dead-ending at a verdict and becomes a full
  coloring-page factory equal to the three standalone routes.
- **Exact seam names: none changed.** `VerdictPageState` already consumes `CreationStoreSeam`,
  `OutputPackagingSeam`, `SessionSeam` and `ClockSeam` through adapters that already exist, exactly
  as `/who-fucked-up`, `/rate-his-excuse` and `/random` do. `buildToolPageRecipe` already covers all
  eleven tool ids, so every mode has a recipe waiting for it. No contract, mock, fixture, probe or
  adapter is touched.

**Files:**
- `src/lib/core/mode-catalog.ts` (new) — the pure mode catalog: field definitions and tool-input
  builders keyed by `toolId`, the catalog derived from `studioModes`, alias slugs, and
  `resolveModeSlug`.
- `src/lib/components/meechie-mode-config.ts` — deleted; its two types move into the catalog.
- `src/lib/components/MeechieModePage.svelte` — rebuilt on runes, `VerdictPageState` and
  `VerdictPageStudio`.
- `src/routes/m/[mode]/+page.svelte`, `src/routes/m/[mode]/+page.ts` — resolve the slug in `load`,
  404 on an unknown one, and key the component on the slug.
- `src/routes/+error.svelte` (new) — a styled error page, so the 404 is not SvelteKit's default.
- `tests/unit/mode-catalog.test.ts` (new), `tests/e2e/smoke.spec.ts`.
- `CHANGELOG.md`, `CLAUDE.md`, `DECISIONS.md`, `LESSONS_LEARNED.md`, `WORST_TO_BEST_LOG.md`.

**Commands:** `npm run check`, `npm run lint`, `npm test`, `npm run build`, `npm run verify`,
`npx playwright test`.

### Self-critique

- *Riskiest assumption:* that one generic component can serve all eight modes without the
  per-mode character the standalone routes have. It cannot be taken on trust, and the answer is to
  stop hand-writing the character twice: `studioModes` already holds a label, help line, call to
  action and placeholder for every mode, and the route map was a second hand-maintained copy of the
  same strings. Deriving the catalog from `studioModes` makes the two agree by construction. This is
  not cosmetic — the two lists must already agree for the home page's links to work, and nothing
  checked that they did. A test asserts every `studioModes` id resolves.
- *What must be proven, not assumed:* that navigating from `/m/a` to `/m/b` does not carry mode a's
  verdict into mode b. SvelteKit reuses one component instance across parameter changes on the same
  route, so `new VerdictPageState({ fileBaseSlug })` would keep the first mode's slug and its
  verdict. This is the one defect the rebuild would *introduce* that the old page could not have,
  because the old page had nothing worth carrying. Keyed on the slug, and covered by an end-to-end
  test that walks between two modes.
- *What could be wrong:* the 404. Today every unknown slug silently renders Random Meechie, so
  `/m/typo` answers 200 with the wrong mode. Returning 404 is honest but is a behaviour change, so
  every alias currently in the route map is kept in the catalog and asserted by test — the change
  must reach typos only, never a link that works today.
- *A hole I am not leaving open:* removing the pre-filled inputs is what makes the submit guard
  matter. Today every field ships with fabricated drama already typed in, so validation never fails
  and the button always returns a verdict about somebody else's fiction. Placeholders replace them,
  and the button is disabled until the user has actually written something.

## Meechie's Tools becomes a page factory (2026-09-04)

Active plan for run 2 of the scheduled "worst feature -> best feature" task recorded in
`WORST_TO_BEST_LOG.md`. Supersedes the Quote Vault seam plan below as the current active plan.

### Plan

- Goal: every one of the eleven tools in `/meechie` produces a coloring page that can be previewed,
  downloaded and kept — and the page reflects the structure the verdict actually came back in.
- Exact seam names: **none changed.** `MeechieToolSeam`, `CreationStoreSeam`, `SessionSeam` and
  `OutputPackagingSeam` are consumed through their existing adapters, exactly as
  `src/routes/+page.svelte` already consumes them. No file under `contracts/`, `probes/`,
  `fixtures/`, `src/lib/mocks/`, `src/lib/adapters/` or `src/lib/seams/` is modified, so the full
  Seam-Driven Development workflow is not triggered and no Cipher Gate entry is required.
- Exact files:
  - `src/lib/core/tool-page-recipe.ts` (new) — pure verdict -> `ColoringPageSpec` + style hint.
  - `src/lib/components/MeechieTools.svelte` — page factory UI, download, vault save, copy.
  - `tests/unit/tool-page-recipe.test.ts` (new), `tests/unit/meechie-tools-parity.test.ts`,
    `tests/e2e/smoke.spec.ts`.
  - `CHANGELOG.md`, `CLAUDE.md`, `DECISIONS.md`, `plan.md`, `WORST_TO_BEST_LOG.md`.
- Exact commands: `npm run check`, `npm run lint`, `npm test`, `npm run build`, `npm run verify`,
  `npx playwright test`.

### Self-critique

- *Riskiest assumption:* that a tool verdict can be parsed into printable structure at all. It is
  not taken on trust — the tool prompts in `src/lib/adapters/meechie-tool-seam/index.ts` were read
  first, and they explicitly instruct `red_flag_or_run` and `wwmd` to answer with `Fault:` /
  `Consequence:` / `Move:` prefixes and `lineup` to answer as `Nth place:` entries. The parser reads
  a documented shape rather than guessing at prose, and falls back to a full-quote page whenever the
  shape is absent.
- *What must be proven:* that every recipe produces a spec the real contract accepts. Asserted
  against `ColoringPageSpecSchema` itself for all eleven tools, not against a hand-written
  expectation of it, because a spec rejected at `/api/generate` would fail after the user had
  already paid for a generation.
- *What could be wrong:* label truncation. The contract caps a list label at 40 characters, and a
  cut that lands mid-phrase reads as a bug on a printed page. This was found by driving the rebuilt
  hub in a real browser rather than by reasoning about it, and fixed with `trimDanglingTail` plus
  tests for the cases that actually occurred.
- *Tradeoff, and the correction that replaced it:* the first implementation saved a toolkit page
  with **no** `studioText`, reasoning that the schema demands a quote and two to six page items a
  tool verdict does not have. **That was wrong, and this plan must not be read as endorsing it** —
  removing the field would reintroduce a live defect. `loadCreation` runs a record without
  `studioText` through `buildStudioTextFromCreationRecord`, which falls back to `assembledPrompt`
  for the quote (the image-generation prompt on a generated page) and to
  `DEFAULT_STUDIO_TEXT_OUTPUT.pageItems` when the saved spec has no items, so reopening printed
  rendering instructions as Meechie's words with the default landlord lines attached.
  `buildToolStudioText` now supplies every field from text she actually produced: the headline as
  the verdict, the response as the quote, the page's own title, and — for a full-quote page, which
  prints no items — the response's own sentences rather than anything invented. Two constraints go
  with it: `MeechieStudioTextOutputSchema` requires at least two `pageItems`, so a response too
  short to yield two leads with the headline; and `buildColoringPageSpecFromMeechieText` now takes
  the layout to rebuild in, because it otherwise hardcodes `listMode: 'list'` and would silently
  reprint a reopened quote page as a numbered list. Full reasoning in `DECISIONS.md` under
  "Correction: a toolkit vault save must store `studioText`".

### Follow-up scope: PR #292 review corrections (2026-09-04)

Written after a review finding that the follow-up work on PR #292 had gone outside the file list
above without amending this plan first. `AGENTS.md` requires the plan to carry every exact path
before the change, and the correction commits on that pull request did not. That is the defect this
subsection fixes, and the remaining item below is planned here before it is implemented.

- Exact seam names: **none changed.** Same standing as the parent plan — `MeechieToolSeam`,
  `CreationStoreSeam`, `SessionSeam`, `OutputPackagingSeam` and `MeechieStudioTextSeam` are consumed
  through existing adapters. No file under `contracts/`, `probes/`, `fixtures/`,
  `src/lib/mocks/`, `tests/contract/`, `src/lib/adapters/` or `src/lib/seams/` is modified, so the
  full Seam-Driven Development workflow is not triggered.
- Exact files, including every path the corrections have already touched:
  - `src/lib/components/MeechieTools.svelte` — request lifetimes (`pageToken`/`verdictToken`),
    install-before-packaging, per-variant packaging isolation, image-usability guard.
  - `src/lib/components/studio/StudioSettingsPanel.svelte` — passes the setting-change source.
  - `src/routes/studio-state.svelte.ts` — restored-page presentation, decoration provenance.
  - `src/lib/core/meechie-studio.ts` — optional `presentation` input on the pure builder.
  - `src/lib/core/tool-page-recipe.ts` — sentence boundary, quoted prefix, abbreviation guards.
  - `src/lib/core/raster-image-format.ts` — `isRenderableGeneratedImage`, browser-safe decode.
  - `tests/unit/studio-state.test.ts`, `tests/unit/meechie-studio.test.ts`,
    `tests/unit/tool-page-recipe.test.ts`, `tests/unit/raster-image-format.test.ts`,
    `tests/e2e/smoke.spec.ts`.
  - `plan.md`, `WORST_TO_BEST_LOG.md`, `docs/evidence/2026-09-04/*`.
- Exact commands: `npm run check`, `npm run lint`, `npm test`, `npm run build`,
  `npm run test:e2e`, `npm run verify`, `npm run cipher:gate`, `npm run proof:tape`.

**Remaining item, planned before implementation.** Decoration density is derived from
`styleHint.includes('receipt')` in `buildColoringPageSpecFromMeechieText`, and
`currentStyleHint()` concatenates the theme's hint *with* `voice.intensity` — where `receipts_out`
matches. So on a reopened page, changing Intensity to or from Receipts Out changes the derivation's
input while leaving the theme untouched, and the density does not follow. Recomputing only on an
explicit theme selection does not cover it.

The fix recomputes when **either** fact holds: the reader made an explicit theme selection (passed
from the settings panel), or the style hint itself differs from the one the last rebuild ran under
(compared directly). Two facts, each measured where it is actually knowable.

### Self-critique for the follow-up

1. *What could be wrong:* the style-hint comparison could recompute on a change that does not
   affect density — a rawness or wig change alters the hint string without altering whether it
   contains `receipt`. Recomputing there yields the same value it preserved, so the extra work is
   invisible; the failure mode is wasted derivation, not wrong output.
2. *Why the comparison is not the same mistake as before:* the previous three attempts compared
   *theme IDs*, a proxy for the derivation input. The style hint **is** the derivation input. The
   explicit source is still needed alongside it for the one case the comparison cannot see — a
   click on the already-active theme chip, which leaves the hint unchanged but is a real selection.
3. *Riskiest assumption:* that seeding the recorded hint at restore time is right. If it were
   seeded empty, the first unrelated setting change on a reopened page would read as a change and
   recompute — the exact regression this whole sequence has been circling. Proven by a test that
   changes page size on a restored dense page and asserts it stays dense.
4. *Evidence:* red-proof each branch by reverting it and showing the specific assertion fail, then
   `npm run verify`, `npm run test:e2e`, and committed evidence under `docs/evidence/2026-09-04/`.

## Quote Vault host-environment seams — ClockSeam, AppOriginSeam, PageVisibilitySeam (2026-09-04)

This section is the active plan for the scheduled "worst feature -> best feature" run recorded in
`WORST_TO_BEST_LOG.md`. It supersedes the 2026-08-26 recovery plan as the current active plan; that
section remains below as historical context.

**Why this plan exists at all.** The Quote Vault rebuild (PR #286) was scoped to touch no seam, and
that was correct for the feature itself — every value it needed was already in `CreationRecord`.
Review of the follow-up pull request (#289) established that two *host-environment reads* had come
along with it anyway: the current instant, and the origin the app is served from. Both are seams
under `AGENTS.md`. This plan is written after the finding and before the seam work, and it is
recorded here because `AGENTS.md` requires a plan for a seam refactor rather than a decision record
written afterwards.

### Plan

- Goal: no unseamed host-environment read in the Quote Vault path, and both behaviours drivable
  from a test — the UTC-midnight label rollover, and the same-origin image-URL decision.
- Exact seam names (now present in `docs/seams.md`): `ClockSeam`, `AppOriginSeam`,
  `PageVisibilitySeam`.
- Exact files:
  - `src/lib/seams/clock-seam/{contract,validators,fixtures,mock,probe,test}.ts`
  - `src/lib/adapters/clock-seam/index.ts`
  - `src/lib/seams/app-origin-seam/{contract,validators,fixtures,mock,probe,test}.ts`
  - `src/lib/adapters/app-origin-seam/index.ts`
  - `src/lib/seams/page-visibility-seam/{contract,validators,fixtures,mock,probe,test}.ts`
  - `src/lib/adapters/page-visibility-seam/index.ts`
  - `src/routes/studio-state.svelte.ts` (inject all three; day-boundary refresh)
  - `src/lib/core/vault-gallery.ts` (accept the origin as an argument; stay pure)
  - `src/routes/+page.svelte`, `src/lib/components/studio/VerdictRow.svelte` (render the vault
    entry the seams now feed)
  - `scripts/run-probe.mjs` (new — repository-owned probe runner), `package.json` (register the
    `probe` script)
  - `tests/unit/studio-state.test.ts`, `tests/unit/vault-gallery.test.ts`,
    `tests/e2e/smoke.spec.ts`
  - `docs/seams.md`, `DECISIONS.md`, `plan.md`, `CHANGELOG.md`, `CLAUDE.md`, `AGENTS.md`,
    `src/lib/seams/CLAUDE.md`, `WORST_TO_BEST_LOG.md`
  - `docs/evidence/2026-09-04/*` — written by `npm run verify`, not edited by hand
- Exact commands: `npm run check`, `npm run lint`, `npm test`, `npm run build`,
  `npm run cipher:gate`, `npm run verify`.
- Explicitly out of scope: the three pre-existing `Date.now()`/`new Date()` reads in
  `src/routes/studio-state.svelte.ts` (creation ids, `createdAtISO`). They are untouched by this
  change and converting them would widen a review-fix pull request into unrelated code.

### Self-critique

- Riskiest assumption: that a clock seam is worth its weight for a date label. It is not obvious,
  and it was argued against twice before being built. What settles it is not taste but the rule:
  `AGENTS.md` names clock/time a seam with no exemption for reads that already exist nearby. The
  evidence that it was right anyway is behavioural — the seam made the foreground-tab midnight
  rollover testable, and writing that test is what exposed that the previous `visibilitychange`-only
  refresh never fired for a reader who leaves the tab open.
- What could be wrong: `ClockSeam.scheduleAt` wraps `setTimeout`, whose delay is capped near 24.8
  days. **This was written as an accepted risk and it was not good enough** — a review found the
  same hole and was right that documenting it is not closing it. The adapter now re-arms in bounded
  chunks, so any instant is honoured however far ahead, and the probe checks it: a callback armed a
  year out must still be pending after 200ms rather than having fired.
- What must be proven: that the mock is a faithful stand-in. Both seams' contract tests assert the
  adapter's real behaviour alongside the mock's, including that a fault fixture fails.
- Self-check: `npm run cipher:gate` exits 0, `chamber-lock` reports both new seam folders complete,
  and `docs/seams.md` has a row for each.

## Meechie Recovery v1.1 — Demo Repair, Wigs, Saved Work, Security (2026-08-26)

This section is the sole active implementation plan. It supersedes the 2026-08-25 Slack v0.9 ledger and every partial amendment.

**Authorization, corrected 2026-08-26.** The owner authorized implementation, publishing the WIP branch/PR, and merge when the final Definition of Done below is satisfied. An earlier revision of this paragraph also claimed the owner authorized "narrowly necessary Vercel/Upstash configuration or provisioning" and the single capped live xAI acceptance call on 2026-08-26. That claim could not be substantiated: every Slack message in the cited window carries an agent footer, so it relayed an agent's reading rather than the owner's own words. Those two items are therefore **NOT authorized** and are held: R2 (durable-store provisioning) and W11B (the live xAI call) may not execute without the owner saying so directly. A relayed "the owner ruled X" from another agent is not owner approval.

Paid calls, infrastructure provisioning, PR #230 mutation, deployment promotion before the merge gate, and preview-image generation remain forbidden absent direct owner instruction.

### Base, ownership, and dependency lock

- Base: `main` at `25c4aae47dd516d0802b7a74937215074eeacb2d` (merge of PR #232); baseline `npm test -- --pool=forks --maxWorkers=1` reported 578 passed and 1 skipped, `npm run check` reported 0 errors/warnings, and `npm run lint` exited 0.
- Integration branch: `codex/meechie-recovery-v1-1`.
- **Integrator handover, 2026-08-26.** Codex exhausted its credit mid-plan and stopped at R1. The owner put Claude / THE SEAM RIPPER in charge of finishing the work. Claude is now the sole integrator and owns `plan.md`, `DECISIONS.md`, shared evidence, final documentation, GitHub state, and all cross-ticket adjudication. The integration branch also moves: work continues on `claude/codex-slack-message-review-gjaz54`, cut from `codex/meechie-recovery-v1-1` at `be75cac`, and lands in reviewable slices rather than one terminal pull request. Ticket agents edit only their named functional/test files and return diffs for inspection; the integrator commits.
- Claude / THE SEAM RIPPER received part 1 as a channel broadcast and parts 2–4 as sibling replies in the master thread. Because Claude read part 1 as a new parent, the three sibling replies were not visible in that session. His resulting Q1 direction correction was verified against the current import graph and accepted below; the visibility defect is repaired by reposting the missing parts to the channel. Later feedback is ordinary diff review, not authority to assign another writer or add scope.
- Dependency order: `A0 -> (Q1 || H1 || D1 || D2 || V1 || W1 || W3 || R0)`; `W1 -> W2 -> W7`; `W3 -> W4 -> W5 -> W6 -> W8 -> W9 -> W10`; `H1 + M1 -> E1`; `R0 + E1 + M1 -> R1`; `R1 -> R2`; `W1..W10 + R1 -> W11A -> W11B`; `(R2 + W11B) -> W12 -> DOC1 -> I1`. P1/P2 stay held.

### Execution checklist

- [x] A0, Q1, H1, M1 — plan lock, canonical contracts/adapters, credentialless production wiring.
- [x] W1–W9 — safe catalog paths, truthful JPEG assets, xAI edit path, byte validation, safe failures, correct downloads.
- [x] W10 — credentialless browser demo regression authored and statically verified; Chromium execution remains an I1/CI merge gate because this runtime's browser approval service disconnected.
- [x] D1, D2, V1 — saved-draft signature, title preservation, malformed-vault isolation. Corrected 2026-08-26: this line was marked complete while two defects were still live in the tree — `DRAFT_SEED_TEXT_SIGNATURES` carried only two of the three historical seeds, and `parseRecords` skipped malformed records with no signal, so the next save erased them. Both are repaired under the slice plan below.
- [x] E1 — six-route public provider-error boundary; stale neighboring assertion corrected and independently approved.
- [x] R0 — durable rate-limit foundation integrated; mapped-IPv4 and durable-expiry review findings corrected and independently approved.
- [ ] R1 — wire one cost guard across all six billable flows (in progress from the corrected, reviewed foundation).
- [ ] R2 — close the real durable-store/configuration assumption with a bounded acceptance check (held until R1 is green).
- [ ] W11A — build and test the one-shot, redacting xAI acceptance runner (held until R1 is green).
- [ ] W11B — execute exactly one capped live xAI acceptance call with no retry (held until W11A is reviewed and green).
- [ ] W12, DOC1 — provider/governance truth and active handoff (blocked on actual R2/W11B outcomes).
- [ ] I1 — exact-head full gates, Claude review, GitHub review resolution, merge, and post-merge verification.
- [ ] P1/P2 — held and excluded; no preview generation or rotation in this change.

### Execution slices (2026-08-26 handover)

Work lands in reviewable slices instead of one terminal pull request, so each slice is small enough to review honestly and nothing waits on a blocked ticket.

- **Slice 1 — open code findings.** Third draft-seed signature; `parseRecords` skip signal; remove the last two `placehold.co` fixture URLs; this correction pass. Gate, push, review, merge.
- **Slice 2 — demo truth.** Execute the credentialless browser regression that W10 only authored, boot the built application, and record what actually works without provider credentials. Gate, push, review, merge.
- **Slice 3 — R1.** One required cost guard across all six billable flows, wired through SvelteKit's `event.getClientAddress`, split one ticket per route. Gate, push, review, merge.
- **Slice 4 — documentation truth and evidence.** DOC1, W12, the full verify chain, and the final Definition of Done pass.

Held pending direct owner instruction: R2 (durable-store provisioning) and W11B (the live xAI call). Neither blocks a slice; each is recorded as an open Assumption instead.


### Universal ticket gate

1. Recheck base SHA, clean status, ticket file list, and forbidden scope before the first edit.
2. Preserve or add each file's Purpose/Why/Info-flow header.
3. For seam behavior, follow contract -> probe -> fixture -> mock -> test -> captured red -> adapter -> integration; fixture-backed behavior cannot be replaced by an invented mock.
4. Capture a real focused failure before the implementation fix and retain the command/output in the handoff; Codex owns checked-in evidence integration.
5. Run ticket-focused tests and affected rewinds, then run `npm run check`, `npm run lint`, `npm test`, `npm run build`, literal `npm run verify`, `npm run cipher:gate`, `npm run assumption:alarm`, and `git diff --check` on the integrated final revision.
6. Stop on base movement, an unplanned file, a failing mandatory gate, an uncapped paid call, missing provider/store capability, secrets in output, or new scope.
7. Do not promote a deployment, enable paid public traffic, mutate infrastructure outside R2, edit/close PR #230, remove a feature, rebuild the application, or start P1/P2 under this plan. Merge only after the final Definition of Done is satisfied on the exact PR head.

### A0 — Plan and base lock

- Problem: prevent several sessions from working from contradictory ledgers.
- Files: `plan.md` only.
- Work: record this exact base, ownership model, dependency graph, tickets, files, commands, constraints, and self-critique before production edits.
- Proof: `git status --short --branch`; `git rev-parse HEAD`; `git diff --check`.
- Done: this section is first and explicitly sole-active; no other plan is treated as executable.

### Q1 — SpecValidation consolidation recut from current main

- Problem: remove duplicated SpecValidation implementation without changing behavior or making the non-runtime legacy twin authoritative.
- Files: `contracts/spec-validation.contract.ts`; `src/lib/seams/spec-validation-seam/contract.ts`; `src/lib/adapters/spec-validation.adapter.ts`; `src/lib/adapters/spec-validation-seam/index.ts`; `tests/contract/spec-validation.test.ts`; `src/lib/seams/spec-validation-seam/test.ts`; `docs/seams.md`.
- Work: re-cut from `25c4aae`; do not rebase/cherry-pick conflicted PR #231. Keep `src/lib/seams/spec-validation-seam/contract.ts` canonical because production wiring and `docs/seams.md` already identify the self-contained seam as canonical. Inline its only legacy dependency as `z.string().min(1)` for the three issue fields, so the self-contained contract has no back-edge to `contracts/`. Convert `contracts/spec-validation.contract.ts` to a compatibility re-export. Keep the self-contained adapter canonical and make the flat adapter a typed alias.
- Red/green proof: prove both import paths initially contain duplicated behavior; after the change both suites exercise the same exported schemas/types with identical validation results, and all seven legacy `contracts/*.contract.ts` consumers still resolve.
- Commands: `npm test -- tests/contract/spec-validation.test.ts src/lib/seams/spec-validation-seam/test.ts tests/unit/api-generate.test.ts tests/unit/api-chat-interpretation.test.ts --pool=forks --maxWorkers=1`; `npm run rewind -- --seam SpecValidationSeam`; `npm run rewind -- --seam "SpecValidationSeam (self-contained)"`.
- Forbidden: schema/limit/validation behavior, fixtures, route/UI behavior, docs reversing the self-contained-canonical registry, or carrying #231's stale 570-test evidence.

### H1 — Credentialless production-wiring integration harness

- Problem: integration currently import-crashes or only skips, so it cannot prove production composition without provider spend.
- Files: `vitest.integration.config.ts`; new `tests/setup/env-dynamic-private.ts`; new `tests/integration/provider-wiring.fake.test.ts`; `tests/integration/image-generation-seam.test.ts`.
- Work: add URL-derived `$lib` and `$env/dynamic/private` aliases; expose a typed `process.env` shim; run real production config/adapter/pipeline composition through a strict fake fetch that rejects every unstubbed URL; use explicit conditional skips for optional paid tests and the narrow ImageProviderConfig seam.
- Red/green proof: capture current import failure; then run credentialless integration with at least one passed test and zero network calls.
- Command: `env -u XAI_API_KEY -u GEMINI_API_KEY FEATURE_INTEGRATION_TESTS=false npm run test:integration`.
- Forbidden: production source, credentials, live calls, deleting optional live probes, or calling a skip proof.

### M1 — MeechieTool canonical production/test target

- Problem: production uses the self-contained adapter while some tests exercise a drifted flat twin.
- Files: `src/lib/seams/meechie-tool-seam/contract.ts`; `src/lib/seams/meechie-tool-seam/fixtures.ts`; `src/lib/seams/meechie-tool-seam/mock.ts`; `src/lib/seams/meechie-tool-seam/test.ts`; `src/lib/adapters/meechie-tool-seam/index.ts`; `contracts/meechie-tool.contract.ts`; `src/lib/adapters/meechie-tool.adapter.ts`; `src/lib/mocks/meechie-tool.mock.ts`; `tests/contract/meechie-tool.test.ts`; `tests/unit/meechie-tool-adapter.test.ts`; `tests/unit/meechie-tool-adapter.responses.test.ts`; `tests/unit/meechie-tools-parity.test.ts`; `tests/unit/api-tools.test.ts`; `docs/seams.md`.
- Work: retain self-contained contract/adapter/fixtures/mock/test as canonical; turn legacy contract/adapter/mock into typed compatibility exports; make all unit/contract/API coverage resolve to the production adapter.
- Red/green proof: demonstrate a current production/flat mismatch; after the change prove object/behavior parity and all eleven live canonical tools (including `random_meechie`), error mapping, and ordinal behavior.
- Commands: `npm test -- tests/contract/meechie-tool.test.ts src/lib/seams/meechie-tool-seam/test.ts tests/unit/meechie-tool-adapter.test.ts tests/unit/meechie-tool-adapter.responses.test.ts tests/unit/meechie-tools-parity.test.ts tests/unit/api-tools.test.ts --pool=forks --maxWorkers=1`; both MeechieTool rewinds.
- Forbidden: prompt wording, voice pack, model, retry, public error, or UI changes.

### W1 — Safe same-origin wig-catalog URLs

- Problem: the catalog contract rejects packaged root-relative wig images.
- Files: `src/lib/seams/wig-catalog-seam/validators.ts`; `src/lib/seams/wig-catalog-seam/fixtures.ts`; `src/lib/seams/wig-catalog-seam/test.ts`.
- Work: accept absolute HTTP(S) URLs or exact safe `/wigs/<slug>.(jpg|jpeg|png|webp)` paths; keep affiliate URLs absolute; reject scheme-relative URLs, traversal, JavaScript URLs, and non-wig paths.
- Red/green proof: a fixture using `/wigs/...jpg` fails current `z.string().url()` before the validator repair; malicious paths remain red while the real catalog validates after W2.
- Commands: `npm test -- src/lib/seams/wig-catalog-seam/test.ts --pool=forks --maxWorkers=1`; `npm run rewind -- --seam WigCatalogSeam`.
- Forbidden: data, assets, adapter, UI, affiliate, name, or price changes.

### W2 — Truthful packaged wig assets

- Problem: eight `.png` files contain JPEG bytes and all eight catalog cards point to placeholders.
- Files: rename the eight existing `static/wigs/wig-001-*.png` through `wig-008-*.png` to matching `.jpg` paths; `src/lib/data/wigs.json`.
- Work: rename without re-encoding; point every `imageUrl` to its exact `/wigs/<matching>.jpg`; change no other catalog field.
- Red/green proof: `file static/wigs/*.png` reports JPEG and `rg 'placehold\.co'` finds eight before; after, JSON has eight unique paths, every file exists, and each has JPEG magic/type.
- Commands: `file static/wigs/*`; deterministic Node JSON/path/JPEG-magic assertion; W1 tests and rewind.
- Forbidden: product data, affiliate links, visual layout, regeneration, compression, or an unpaired merge before W1.

### W3 — Separate xAI edit model pin

- Problem: wig editing needs xAI's multi-image model without risking the working coloring-page model.
- Files: `src/lib/core/models.js`; `tests/unit/models.test.ts`.
- Work: export `IMAGE_EDIT_MODEL = 'grok-imagine-image-2.0'`; explicitly retain and test `IMAGE_MODEL = 'grok-imagine-image'` and current text model.
- Red/green proof: missing edit export/test fails first; both exact IDs pass after.
- Command: `npm test -- tests/unit/models.test.ts --pool=forks --maxWorkers=1`.
- Forbidden: any existing model value, endpoint, runtime override, or provider call.

### W4 — Provider-neutral, raster-valid WigTryOn contract

- Problem: the seam artifacts encode Gemini assumptions and accept an SVG mock that the product download path does not support.
- Files: `src/lib/seams/wig-try-on-seam/contract.ts`; `validators.ts`; `fixtures.ts`; `mock.ts`; `test.ts`; `probe.ts` in that folder.
- Work: make descriptions provider-neutral; constrain portrait output to JPEG/PNG/WebP; replace SVG fixture/mock output with valid raster base64; cover success, missing config, HTTP, malformed/empty response, network, caller abort, and timeout as explicit contract scenarios; describe the xAI edit probe without executing it.
- Red/green proof: new MIME/fixture assertions fail against the current SVG/Gemini artifacts, then all fixture-backed scenarios pass.
- Commands: `npm test -- src/lib/seams/wig-try-on-seam/test.ts --pool=forks --maxWorkers=1`; `npm run rewind -- --seam WigTryOnSeam`.
- Forbidden: adapter, route, UI, live network, and existing coloring-page seam.

### W5 — xAI multi-image edit transport

- Problem: the production adapter uses exhausted Gemini and puts its credential in a query URL.
- Files: `src/lib/adapters/wig-try-on-seam/index.ts`; `src/lib/seams/wig-try-on-seam/test.ts`.
- Work: consume ImageProviderConfig; bearer-auth JSON POST to `<xaiBaseUrl>/v1/images/edits`; use W3's edit model; order selfie then wig as data URLs; request one `b64_json` result; perform no automatic retry; preserve caller abort/120-second timeout; expose only stable messages.
- Red/green proof: fake transport asserts exact URL/header/body/order/model and that no URL contains a key; test success, missing config, 401/429/500, malformed/empty response, caller abort, timeout/body timeout, and a thrown secret-bearing error whose secret never reaches the result.
- Commands: W4 focused test and rewind.
- Forbidden: paid call, existing ImageGenerationSeam/model, retry expansion, AppConfig cleanup, or raw upstream output.

### W6 — Wire only the wig route to narrow xAI config

- Problem: `/api/wig-try-on` currently loads unrelated full AppConfig and Gemini fields.
- Files: `src/routes/api/wig-try-on/+server.ts`; `tests/unit/api-wig-try-on.test.ts`.
- Work: instantiate ImageProviderConfig and the W5 adapter; preserve malformed-JSON short circuit and request signal.
- Red/green proof: malformed JSON creates neither catalog/config/provider seam; a valid request creates narrow config and forwards signal.
- Command: `npm test -- tests/unit/api-wig-try-on.test.ts --pool=forks --maxWorkers=1`.
- Forbidden: deleting Gemini/AppConfig fields, other routes, UI, or provider calls.

### W7 — Detect truthful packaged wig MIME

- Problem: the pipeline trusts response Content-Type and can label JPEG bytes as PNG.
- Files: `src/lib/core/wig-try-on-pipeline.ts`; new `tests/unit/wig-try-on-pipeline.test.ts`.
- Work: require a successful nonempty wig fetch; sniff JPEG/PNG/WebP magic; pass detected MIME; reject missing/non-2xx/empty/unknown bytes before provider invocation.
- Red/green proof: a fake `image/png` response containing JPEG currently reaches the seam as PNG; after, it reaches as JPEG, and every invalid byte case makes zero provider calls.
- Command: `npm test -- tests/unit/wig-try-on-pipeline.test.ts --pool=forks --maxWorkers=1`.
- Forbidden: provider transport, catalog, UI, or broad error mapping.

### W8 — Exact user-safe wig error mapping

- Problem: configuration, cancellation, timeout, fetch, provider, and contract failures are not distinguished safely.
- Files: `src/lib/core/wig-try-on-pipeline.ts`; `tests/unit/wig-try-on-pipeline.test.ts`.
- Work: map input 400, missing wig 404, config 503, caller abort 499, timeout 504, wig-fetch/provider network/HTTP/parse/empty 502, and impossible output-contract failure 500; return only stable generic text.
- Red/green proof: current config/abort/timeout cases have wrong or indistinct statuses; table tests cover every code/status and prove secret/body/URL canaries absent.
- Forbidden: other routes, adapter diagnostics, rate limiting, or global status normalization.

### W9 — Correct saved portrait extension

- Problem: the client always downloads `.png` even when the generated bytes are JPEG or WebP.
- File: `src/lib/components/studio/WigTryOnStudio.svelte` only.
- Work: derive `.jpg`, `.png`, or `.webp` from the result data-URL MIME with a safe fallback.
- Proof: component behavior/browser assertion plus `npm run check` and `npm run build`.
- Forbidden: layout, copy, assets, provider, catalog, or state changes.

### W10 — Credentialless end-to-end wig demo regression

- Problem: unit contracts alone do not prove the eight cards, upload, result, download, and downstream coloring-page action work together.
- File: `tests/e2e/smoke.spec.ts` only.
- Work: assert eight `/wigs/` cards load; choose one; upload a committed JPEG; intercept `/api/wig-try-on` with a valid JPEG result; assert portrait and downstream action; assert JPEG download naming.
- Proof: focused Playwright smoke with zero external requests/credits.
- Forbidden: production/UI change, live provider, or unrelated smoke flows.

### D1 — Full-shape draft seed detection

- Problem: title-only fallback can hide genuine generated drafts or restore historical seed text as user work.
- Files: `src/routes/studio-state.svelte.ts`; `tests/unit/studio-state.test.ts`.
- Work: when `studioText` is absent, compare exact text signature (title, ordered page-item labels, optional footer) against current landlord seed and pre-#232 `I DON'T ACT` seed; explicit `studioText` always wins; evidence/settings alone do not convert a seed.
- Red/green proof: current seed, legacy seed, explicit text with seed title, same title/changed item, item order/footer changes, and evidence/settings-only cases.
- Command: `npm test -- tests/unit/studio-state.test.ts --pool=forks --maxWorkers=1`.
- Forbidden: storage contract/key/version, localStorage migration/clear, default text, vault, provider, or UI layout.

### D2 — Preserve 96-character titles

- Problem: contract-valid 41–96-character titles are silently truncated to the 40-character label limit during creation/restoration.
- Files: `src/lib/core/meechie-studio.ts`; `tests/unit/meechie-studio.test.ts`.
- Work: use `MAX_TITLE_LENGTH` for page titles in spec creation and legacy draft/vault fallback; keep item/footer labels at `MAX_LABEL_LENGTH`; correct stale seed-vs-idle comments.
- Red/green proof: 41–96 survives, 97+ caps at 96, item/footer stay <=40, and explicit `studioText` remains preferred.
- Commands: `npm test -- tests/unit/meechie-studio.test.ts tests/contract/spec-validation.test.ts --pool=forks --maxWorkers=1`; SpecValidation rewind.
- Forbidden: contracts, prompts, provider, UI, label/footer limit, or broader Unicode policy.

### V1 — Isolate malformed vault records

- Problem: one invalid entry in an otherwise valid saved array bricks all vault operations.
- Files: `src/lib/adapters/creation-store.adapter.ts`; `tests/unit/creation-store-helpers.test.ts`.
- Work: parse array entries independently; preserve valid records; skip record-level schema failures; subsequent save/delete rewrites valid records plus the requested operation; retain hard failures for malformed JSON/non-array roots and all write errors.
- Red/green proof: mixed valid/bad list, save, delete, all-bad empty list, malformed JSON, non-array, and write failure.
- Commands: `npm test -- tests/unit/creation-store-helpers.test.ts --pool=forks --maxWorkers=1`; `npm run rewind -- --seam CreationStoreSeam`.
- Forbidden: contract/schema/key/version, draft behavior, UI messaging, storage clear, or deletion of valid data.

### E1 — Six-route public provider-error boundary

- Problem: arbitrary upstream text can cross all six public provider-backed responses.
- Files: new `src/lib/core/public-provider-error.ts`; `src/lib/core/chat-interpretation-pipeline.ts`; `generate-pipeline.ts`; `image-generation-pipeline.ts`; `meechie-studio-text-pipeline.ts`; `tools-pipeline.ts`; `wig-try-on-pipeline.ts`; route files under `src/routes/api/{chat-interpretation,generate,image-generation,meechie-studio-text,tools,wig-try-on}/+server.ts` only if status serialization requires them; new `tests/unit/public-provider-error.test.ts`; `tests/unit/api-chat-interpretation.test.ts`; `api-generate.test.ts`; `api-image-generation.test.ts`; `api-meechie-studio-text-endpoint.test.ts`; `api-tools.test.ts`; `api-wig-try-on.test.ts`; `image-generation-pipeline.test.ts`; `meechie-studio-text-pipeline.test.ts`; and `tests/unit/pipeline-edge-cases.test.ts` only to replace its obsolete expectation that public JSON contains provider `details.status`.
- Work: preserve approved stable app code/status and safe validation detail; remove arbitrary provider/network/config message/body/content/details, URLs, keys, UUID/account/team IDs; change provider-failed `/api/tools` from 200 to a failure status.
- Red/green proof: inject raw-body, query-key URL, UUID, account/team, and secret canaries into every route; none may cross serialized JSON; safe schema-validation details remain.
- Focused command: run helper, the six endpoint tests, and affected pipeline tests in one Vitest invocation.
- Forbidden: five-route partial, adapter-internal diagnostics, retry/model, rate limiting, or wig-provider migration.

### R0 — Durable RateLimitSeam foundation

- Problem: no durable serverless-safe cost gate exists; the three closed attempts used unsafe scope or storage assumptions.
- Files: `package.json`; `package-lock.json`; `.env.example`; new `src/lib/seams/rate-limit-seam/{contract,validators,fixtures,mock,probe,test}.ts`; new `src/lib/adapters/rate-limit-seam/index.ts`; new `src/lib/server/rate-limit-identity.ts`; `rate-limit-config.ts`; `rate-limit-guard.ts`; new `tests/unit/rate-limit-identity.test.ts`; `rate-limit-guard.test.ts`; `docs/seams.md`.
- Work: implement async Upstash-backed atomic fixed-window behavior behind the seam; shared text budget 20/min for chat/studio/tools and image budget 8/min for generate/image/wig; normalize dotted and hexadecimal IPv4-mapped IPv6 forms back to their embedded IPv4 identity, then normalize true IPv6 to /64 before HMAC-SHA256; call identities pseudonymous; require secret; use one strict shared fallback bucket only when identity cannot be resolved; return 503 fail-closed for configuration/store/operation failure; derive retry/header values from reset.
- Red/green proof: fixture fault fails contract before adapter; exact boundary, concurrent calls, reset, weighted cost primitive, IPv4, equivalent dotted/hexadecimal mapped IPv4, distinct mapped IPv4 identities, equivalent/different IPv6 /64, fallback, thrown client-address lookup, timeout/throw/store/config failure, and raw-address/secret absence; the fake store models expiry and the reset test fails if `PEXPIREAT` is removed so durable keys cannot accumulate unnoticed.
- Commands: focused seam/identity/guard tests; `npm run rewind -- --seam RateLimitSeam`.
- Forbidden: production Map, raw IP keys/logs, claim of anonymity, active-bucket eviction, provisioning/config mutation, auth/UI/provider calls, or a `RATE_LIMIT_ENABLED`/equivalent fail-open switch that permits unmetered provider calls. A future maintenance switch may disable provider work fail-closed, but that is separate scope.

### R1 — One rate-limit guard across six billable flows

- Problem: every provider route must enforce the same durable policy without charging invalid work or double-charging nested generation.
- Files: `src/lib/core/{chat-interpretation,generate,image-generation,meechie-studio-text,tools,wig-try-on}-pipeline.ts`; `src/routes/api/{chat-interpretation,generate,image-generation,meechie-studio-text,tools,wig-try-on}/+server.ts`; `src/lib/adapters/meechie-studio-text.adapter.ts`; `tests/unit/api-{chat-interpretation,generate,image-generation,meechie-studio-text-endpoint,tools,wig-try-on}.test.ts`; `tests/unit/{pipeline-edge-cases,image-generation-pipeline,meechie-studio-text-pipeline,wig-try-on-pipeline}.test.ts`; `tests/contract/meechie-studio-text.test.ts`; and `tests/integration/provider-wiring.fake.test.ts`.
- Work: require an injected gate rather than retaining an optional production bypass; check cancellation and local parse/schema/safety first; consume quota immediately before the first billable call; charge chat/tools/wig one unit, studio two units up front for its bounded correction retry, and image/generate by requested variations; propagate the guard's exact headers through every post-charge response; 429 includes Retry-After, limit/remaining/reset, no-store; 503 on gate failure; `/generate` charges once and calls the image pipeline in an explicit required precharged mode rather than double-charging or using an optional skip boolean.
- Red/green proof: all six routes cover allow, exact exhaustion boundary, deny, store failure, identity fallback, invalid/safety rejection, abort, and zero billable provider fetch on every rejected path; the credentialless integration fake models Upstash and xAI, proves `EVAL` precedes provider work on allow, and proves no provider URL is touched on deny.
- Commands: six endpoint tests; credentialless fake integration; RateLimitSeam rewind.
- Forbidden: partial route coverage, an optional no-gate production path, an optional skip boolean, nested double charge, recalculated guard headers, route-specific policy forks, model/retry change, paid probe, or any infrastructure mutation (R1 is code-only; provisioning belongs to R2).

### R2 — Durable-store configuration and acceptance (held)

- Problem: R0/R1 can prove the adapter with fakes, but the showable application will fail closed unless the deployed runtime has a working, correctly scoped durable store and identity secret.
- Repository files: dated `docs/evidence/2026-08-26/` capture plus final plan/decision/handoff truth only; no production source or dependency file.
- External scope: inspect the existing Vercel project configuration without revealing values; reuse an already attached Upstash-compatible REST store if present, otherwise create only the smallest project-scoped store/configuration required by R0; set only the exact R0 variable names for the required environments; do not touch unrelated projects, domains, aliases, budgets, or provider settings.
- Work: after R1 is green, execute one non-billable atomic allow/deny/reset acceptance sequence against a dedicated probe key; prove expiry is present, delete only that dedicated key if the provider supports deletion, and record redacted status/timing/TTL evidence with no URL, token, HMAC secret, IP, or key material.
- Stop: no relevant Vercel/Upstash capability, ambiguous project/store ownership, an unexpected charge, secret-bearing output, a moved exact head, or any need to broaden infrastructure scope.
- Done: the exact preview/runtime configuration required by R1 exists, the bounded acceptance sequence passes, no unrelated setting changed, and the redacted evidence names the environment and result truthfully.

### W11A — Tested one-shot xAI acceptance runner (held)

- Problem: official request compatibility does not prove the configured account accepts the exact two-image edit payload.
- Files: `src/lib/seams/wig-try-on-seam/probe.ts`; `src/lib/seams/wig-try-on-seam/test.ts`.
- Work: add a manual runner that requires the official xAI base URL and production config/adapter; validates exact magic and SHA-256 for synthetic `static/meechie/meechie-chosen.png` (`e919152dd227246378e9d0aa122f56e2487820caf19c582b0b2fc2fc2902c340`) and packaged `static/wigs/wig-001-sleek-straight-goddess.jpg` (`1ae65092cc6809096a4e7335649f77cbecaeb510088e93d5eb1811f8c4d773fa`); exclusively creates the evidence path before network activity; wraps fetch with a counter that throws before a second request; returns/persists only status, elapsed milliseconds, detected MIME, and magic prefix; and suppresses all raw exception output.
- Red/green proof: credentialless tests fail before the runner exists, then prove hash/magic rejection, exclusive evidence creation, one-call enforcement, supported output validation, and absence of credentials, URLs, bodies, and base64 from output/evidence.
- Commands: focused WigTryOn seam test and rewind; type/lint/build.
- Forbidden: a live call, new fixture, adapter/contract change, personal image, automatic retry, console/raw-error logging, or edits outside the two named files.

### W11B — Exactly one live xAI acceptance call (held)

- Problem: W11A remains synthetic until the configured account accepts the production two-image request.
- Files: new exclusive `docs/evidence/2026-08-26/w11-xai-edit-acceptance.json`; final `DECISIONS.md`/plan truth are integrated under W12/I1, not during the call.
- Work: only after R1 and W11A are green on a clean reviewed head, invoke W11A once with the two exact synthetic assets; assert 200, nonempty supported raster output, elapsed time, and secret-free evidence.
- Stop permanently after any attempted provider call, including timeout, network error, 401, 429, 5xx, malformed response, or invalid magic; never retry. Stop before calling if the credential is absent, endpoint/model or asset hashes differ, the reviewed head moved, or the evidence file already exists.
- **Safety valve (restored).** If the capability is unavailable for any of those reasons, this ticket does not silently block the plan: record an open Assumption naming exactly what is unproven, and let the merge gate decide under item 5 of the Definition of Done. The old W11 carried this clause; splitting W11 into W11A/W11B dropped it, which left W11B able to stop the whole plan permanently on a missing credential.
- Forbidden: more than one attempted call, personal photos, output/base64 persistence, deployment, retry, or a live-success claim if not executed.

### W12 — Wig provider/governance truth

- Problem: active docs/config still say Gemini is the only path and the quota incident has no code fix.
- Files: `DECISIONS.md`; `docs/seams.md`; `.env.example`; `CHANGELOG.md`; `HANDOFF.md`; final updates to this `plan.md`; generated dated evidence.
- Work: record Gemini-to-xAI edit decision, official payload constraints, JPEG discovery, actual W11 status, Cipher Gate, risks, and unchanged coloring-page model; mark Gemini variables legacy/unused without broad AppConfig deletion.
- Proof: targeted `rg` for runtime Gemini endpoints/query keys; docs match actual test/probe results.
- Forbidden: rewriting historical decisions, AppConfig retirement, rebuild, preview rotation, or false live claims.

### DOC1 — Truthful active handoff

- Problem: the handoff still tells future sessions to redo merged #228/#232 work and misstates the idle PNG/provider remedy.
- Files: `HANDOFF.md`; `CHANGELOG.md` only.
- Work: state #228/#232 merged; ten-line voice pack and landlord seed are done; static idle PNG remains unchanged; remove hold/stale-count/stale-ruling text and the claim that Gemini quota has no code remedy now that the route is migrated.
- Proof: targeted `rg` for stale PR/count/provider/preview phrases; `git diff --check`.
- Forbidden: source/test/fixture/history rewrite or new product work.

### P1/P2 — Held preview assets and idle rotation

- P1 files if separately approved: replace `static/meechie/demo-coloring-page.png` and add `demo-coloring-page-02.png`, `-03.png`, `-04.png`; exact four owner-approved lines, 1024x1536, visual/text approval, paid generation authorization. No code.
- P2 files after P1: `src/lib/components/studio/StudioPreviewPanel.svelte`; `tests/e2e/smoke.spec.ts`; SSR-stable CSS crossfade, reduced-motion pins first, generated result replaces idle. No clock/random/provider/state change.
- Current status: HOLD; these files are excluded from implementation.

### I1 — Final integration, adversarial review, and PR disposition

- Files: shared `plan.md`, `DECISIONS.md`, `CHANGELOG.md`, `LESSONS_LEARNED.md`, `HANDOFF.md`, `docs/seams.md`, dated generated evidence, and the PR-resolution ledger only as required by the completed functional tickets.
- Work: re-fetch main and PR/review state; inspect every ticket commit and exact name-status diff; integrate serially; regenerate current-revision evidence; run full gates/rewinds/credentialless end-to-end proof; request Claude line review; answer review threads with exact commit/evidence only.
- Forbidden: #230 merge/edit/close, deployment, any infrastructure mutation outside the narrow R2 scope defined above (and only once R2 is itself authorized), provider spend beyond an authorized W11B, force push, or merge while an open Assumption or unresolved human change request applies.
- Done: satisfy the Final Definition of Done below, merge the reviewed PR without another permission round, then verify the merge commit/main checks and update the handoff with the actual merged SHA.

### Final Definition of Done and merge gate

The integrated pull request may be merged only when every item below is true on its exact current head:

1. **Scope is exact:** every changed file maps to a ticket above; no rebuild, held preview work, #230 content, unrelated cleanup, secret, generated junk, or accidental dependency change is present.
2. **Code is clean:** implementation is readable, typed, deduplicated where planned, uses the production seams, preserves file headers, passes `git diff --check`, and has no known material defect, unsafe fallback, credential leak, raw-provider leak, or paid-call bypass.
3. **Behavior works:** the eight real wigs load, the credentialless wig flow completes end to end, saved drafts/titles/vault records survive the repaired cases, all six public provider routes sanitize failures, and all six rate-limit paths block cost before provider calls.
4. **Tests prove the material:** each ticket has a relevant captured red failure and focused green test; every affected seam rewind passes; credentialless integration executes at least one real test rather than reporting skips only; the full test/check/lint/build/verify/Cipher Gate/Assumption Alarm chain is green.
5. **External assumptions are closed:** the single capped xAI probe proves the configured edit request, and the authorized Upstash probe/provisioning evidence closes the durable-store assumption; if either remains open, merge stops unless the owner explicitly waives that named risk after seeing it.
6. **Review is complete:** Claude reviews the final integrated diff adversarially; every bot/human review thread is either fixed and rechecked or answered with exact evidence and a defensible rejection; no unresolved human change request remains.
7. **Documentation is truthful:** `plan.md`, `DECISIONS.md`, `CHANGELOG.md`, `HANDOFF.md`, `LESSONS_LEARNED.md`, `docs/seams.md`, and current evidence describe the actual head, tests, provider, limits, known risks, and rollback without stale counts or false-green claims.
8. **GitHub is merge-ready:** CI and required checks are green on the current head, branch is conflict-free and fully pushed, working tree is clean, and the PR description lists exact files/tests/evidence. Then merge; do not wait from fear alone.

### Self-critique

- What could be wrong: xAI's documented edit request may still reject `b64_json` for the configured account; the local assets may be visually poor even after their transport is correct; a shared missing-identity bucket protects spend but can reduce availability; large security tickets can collide with wig pipeline work if integrated out of order.
- What must be proven: two-image edit payload order/auth/response without leaking upstream text; all eight assets are served with truthful MIME; the demo works under fake transport; draft/title/vault repairs preserve real saved work; every one of six provider routes sanitizes and rate-limits before a billable call; no nested charge; full gates run on the final head.
- Riskiest assumptions: current official xAI behavior matches this account; Upstash semantics and timeout behavior match the adapter; contract-direction Q1 still fits the repository's legacy-import graph after rebasing main.
- Evidence that disproves the plan: a provider contract mismatch, a corrupt/nonmatching image, any secret/body canary in public JSON, any billable fetch after denial, a valid saved record lost, a zero-test/skipped-only integration run, an unplanned diff, a failed final gate, or a Claude code-review finding with a concrete reproduction.

## PR #228 Concurrent-Head Reconciliation (2026-08-25)

### Shortcut Check

1. Shortcut a typical AI might take: overwrite the concurrently updated branch with the already-tested local commit, or accept its green CI without reviewing its unrelated governance changes.
2. Countermeasure: treat remote head `4c29e0f` as the new base, preserve its evidence-backed review repairs, remove the committed permission bypass and auto-merge instruction, and publish only after a compare-and-swap head check.
3. Lower-debt path: keep the prompt, timeout, redaction, and AppConfig repairs in their owning seams; keep repository authority unchanged; and honor the owner's explicit merge hold independently of CI state.

### Plan

- Goal: reconcile the current PR #228 head without losing concurrent work, close its remaining substantive review findings, remove unrelated repository-wide authority changes, and leave the branch verified but unmerged pending explicit owner approval.
- Exact seams: ProviderAdapterSeam, PromptAssemblySeam, SpecValidationSeam, AppConfigSeam, DriftDetectionSeam, ImageGenerationSeam.
- Exact production paths:

  - `contracts/spec-validation.contract.ts`
  - `src/lib/seams/spec-validation-seam/contract.ts`
  - `src/lib/adapters/spec-validation.adapter.ts`
  - `src/lib/adapters/spec-validation-seam/index.ts`
  - `src/lib/core/http-resilience.ts`
  - `src/lib/core/http-client.ts`
  - `src/lib/core/provider-message-redaction.js`
  - `src/lib/adapters/provider-adapter.adapter.ts`
  - `src/lib/adapters/prompt-assembly-seam/index.ts`
  - `src/lib/seams/app-config-seam/validators.ts`
  - `src/lib/seams/prompt-assembly-seam/validators.ts`
- Exact fixture, test, governance, and evidence paths:
  - `.env.example`, `.gitignore`, `AGENTS.md`, `HANDOFF.md`, `.claude/settings.local.json`
  - `fixtures/prompt-assembly/*.json`, `fixtures/provider-adapter/{fault.json,PROVENANCE.md}`, `fixtures/drift-detection/*.json`, `fixtures/image-generation/{sample,dense-scene}.json`
  - `probes/provider-adapter.probe.mjs`, `probes/image-generation.probe.mjs`
  - `scripts/verify-runner.mjs`
  - `docs/evidence/2026-08-25/prompt-boundary-live-*`
  - `tests/unit/{http-resilience,provider-adapter-helpers,app-config-seam,probe-entrypoints}.test.ts`
  - `tests/contract/{image-generation,prompt-assembly,spec-validation}.test.ts`, `src/lib/seams/{prompt-assembly-seam,spec-validation-seam}/test.ts`
  - `plan.md`, `DECISIONS.md`, and regenerated `docs/evidence/2026-08-25/*`
- Constraints:
  - Preserve the concurrent own-line prompt representation because it accepts embedded quotes without ambiguous quote delimiters and is backed by a traceable live prompt/result/image record whose missing original transport envelope is stated explicitly.
  - Apply a single-line printable-text boundary and the established 96-character route-title limit so newlines/control characters cannot split the prompt while embedded quotes, slashes, and compact tool titles remain valid.
  - Disable all automatic provider chat retries, including delayed `429`/`5xx` responses, because a second 110-second billable attempt cannot be guaranteed to finish inside the shortest 120-second browser budget; shared retry behavior remains available to other callers.
  - Share provider-message identifier redaction with the plain-Node fixture probe so refreshing evidence cannot recommit account identifiers; preserve the `defaultImageSize` schema default and do not restore the unrelated inactive `MAX_IMAGES_PER_REQUEST` example.
  - Delete and gitignore `.claude/settings.local.json`, remove the broad auto-merge rule, and change the handoff to record the explicit merge hold.
  - Do not merge. Do not force-push. Re-read the remote head immediately before updating it, and stop if it moved.
- Exact commands:
  1. `npm test -- tests/unit/http-resilience.test.ts tests/unit/provider-adapter-helpers.test.ts tests/unit/app-config-seam.test.ts tests/unit/probe-entrypoints.test.ts tests/contract/prompt-assembly.test.ts tests/contract/spec-validation.test.ts src/lib/seams/prompt-assembly-seam/test.ts src/lib/seams/spec-validation-seam/test.ts --pool=forks --maxWorkers=1`
  2. `npm run rewind -- --seam ProviderAdapterSeam`
  3. `npm run rewind -- --seam SpecValidationSeam`
  4. `npm run rewind -- --seam AppConfigSeam`
  5. `npm run rewind -- --seam PromptAssemblySeam`
  6. `npm run rewind -- --seam "PromptAssemblySeam (self-contained)"`
  7. `npm run rewind -- --seam ImageGenerationSeam`
  8. `npm run check`, `npm run lint`, `npm test`, `npm run build`, `npm run verify`, `npm run cipher:gate`, `npm run assumption:alarm`, `git diff --check`

### Self-Critique

- What could be wrong: a green concurrent commit can still contain high-impact repository policy changes outside the reviewed product seams, while reconstructing it locally risks omitting a file that CI exercised.
- What must be proven: the local code/fixture blobs match the current remote head before reconciliation; provider chat performs one fetch after either a timeout or retryable response; probe refreshes redact sensitive identifiers; newlines are rejected from titles while embedded quotes remain accepted; the copied environment example validates without `MAX_IMAGES_PER_REQUEST`; and all full gates pass after governance cleanup.
- Riskiest assumption: ten seconds between the single 110-second provider attempt and the shortest 120-second browser budget is enough route overhead. If measured production overhead disproves that, increase the client budget or introduce an end-to-end deadline in a separate change.
- Evidence that would disprove it: a remote-head race, a second provider-chat fetch, a fixture/adapter mismatch, an unredacted provider identifier after a probe refresh, a newline-bearing title reaching prompt assembly, a missing live-evidence artifact, any permission-bypass file in the final tree, or any failed focused/full verification command.

## PR #228 Review Repair and PR #227 Integration (2026-08-24)

### Shortcut Check

1. Shortcut a typical AI might take: resolve the outdated review threads because CI is green and merge the model-id change without checking the probes and fixture-backed mocks.
2. Countermeasure: treat the current review comments as evidence, merge the already-reviewed PR #227 foundation into this branch, and prove that every documented probe, fixture, mock, and production consumer names the same pinned models.
3. Lower-debt path: keep one production source of truth in the checked ESM module `src/lib/core/models.js`, import it from plain-Node-20-compatible probes, preserve PR #227's shared Meechie prompt builder, and mark the live-provider compatibility assumption open unless an authenticated probe actually closes it.

### Plan

- Goal: integrate merged PRs #227 and #229 into PR #228, fix all current review findings, and leave one truthful model configuration plus one canonical prompt implementation across production code, probes, fixtures, tests, governance, and release documentation.
- Exact seams: ProviderAdapterSeam, AppConfigSeam, ImageProviderConfigSeam, MeechieStudioTextSeam, MeechieToolSeam, ChatInterpretationSeam, MeechieVoiceSeam, PromptAssemblySeam, DriftDetectionSeam, ImageGenerationSeam.
- Exact production and probe paths:
  - `src/lib/core/models.js`, `src/lib/core/meechie-studio-text-pipeline.ts`
  - `src/lib/adapters/meechie-tool.adapter.ts`, `src/lib/adapters/meechie-tool-seam/index.ts`
  - `src/lib/adapters/app-config-seam/index.ts`, `src/lib/adapters/provider-adapter.adapter.ts`
  - `src/lib/adapters/prompt-assembly-seam/index.ts`, `src/lib/adapters/prompt-assembly.adapter.ts`
  - `probes/provider-adapter.probe.mjs`, `probes/chat-interpretation.probe.mjs`
- Exact fixture and test paths:
  - `fixtures/provider-adapter/sample.json`, `fixtures/provider-adapter/fault.json`, `fixtures/provider-adapter/PROVENANCE.md`
  - `fixtures/app-config/sample.json`, `fixtures/app-config/fault.json`
  - `fixtures/prompt-assembly/sample.json`, `fixtures/prompt-assembly/title-only.json`, `fixtures/prompt-assembly/title-only-marker-fault.json`
  - `src/lib/seams/prompt-assembly-seam/{contract,fixtures,mock,validators,test}.ts`
  - `tests/contract/prompt-assembly.test.ts`
  - `tests/unit/app-config-seam.test.ts`, `tests/unit/models.test.ts`, `tests/unit/provider-adapter-helpers.test.ts`, `tests/unit/probe-entrypoints.test.ts`, `tests/unit/api-generate.test.ts`
- Exact governance and evidence paths:
  - `plan.md`, `DECISIONS.md`, `LESSONS_LEARNED.md`, `README.md`, `docs/release-smoke-checklist-2026-05-05.md`
  - `docs/evidence/2026-08-25/` (UTC-dated output regenerated after integration; no fabricated live-provider capture)
  - `.claude/settings.json` (remove the unrelated command allowlist from this PR)
- Conflict rules:
  - Preserve PR #227's `buildMeechieSystemPrompt` and voice-pack-derived studio examples.
  - Preserve PR #228's `TEXT_MODEL` constant and optional dependency fallback; do not restore `selectTextModel` or runtime model env overrides.
  - Preserve PR #229's typed legacy re-export and fixture-backed execution validator; apply the broader quoted-text/terminator repair only in the canonical adapter and identify the combined template as `v4`.
  - Correct PR #227's decision narrative: the old tool prompt supplied 34 physical examples / 30 exact-distinct, including the eight filtered quotes through `tone.samples`; the owner-approved rewrite intentionally reduces that to 20 rather than merely restoring excluded lines.
- Exact commands:
  1. `npm test -- tests/unit/models.test.ts tests/unit/provider-adapter-helpers.test.ts tests/unit/probe-entrypoints.test.ts tests/unit/app-config-seam.test.ts tests/unit/meechie-studio-text-pipeline.test.ts tests/unit/meechie-tool-adapter.test.ts tests/unit/meechie-studio.test.ts tests/contract/provider-adapter.test.ts src/lib/seams/app-config-seam/test.ts src/lib/seams/meechie-tool-seam/test.ts src/lib/seams/meechie-voice-seam/test.ts --pool=forks --maxWorkers=1`
  2. `npm run rewind -- --seam ProviderAdapterSeam`
  3. `npm run rewind -- --seam AppConfigSeam`
  4. `npm run rewind -- --seam ImageProviderConfigSeam`
  5. `npm run rewind -- --seam MeechieStudioTextSeam`
  6. `npm run rewind -- --seam \"MeechieToolSeam (self-contained)\"`
  7. `npm run rewind -- --seam ChatInterpretationSeam`
  8. `npm run rewind -- --seam \"MeechieVoiceSeam (self-contained)\"`
  9. `npm run rewind -- --seam PromptAssemblySeam` and `npm run rewind -- --seam \"PromptAssemblySeam (self-contained)\"`
  10. `npm run check`, `npm run lint`, `npm test`, `npm run verify`, `npm run cipher:gate`, `npm run assumption:alarm`, `git diff --check`

### Self-Critique

- What could be wrong: pinning a provider id removes an unsafe deployment override but makes the next provider retirement require a deploy. That tradeoff is intentional and must be visible in release operations.
- Riskiest assumption: official model availability does not prove that `grok-4.6` accepts this app's exact `json_schema` payload with the configured account. No `XAI_API_KEY` is available in this workspace, so fixture files must not be presented as fresh live captures and the reachable-deployment smoke item must remain open.
- What must be proven here: the pinned constants reach all production consumers, executable probes cannot overwrite fixtures with retired ids, mocks match the adapter, xAI's bare-string error is preserved, the merged Meechie prompt behavior survives, and all local/CI gates are green.
- Evidence that would disprove it: a focused parity assertion showing a retired model, a probe diff that rewrites current fixtures, a non-hermetic generate-route test, a failed seam rewind/full verification, or an authenticated `/api/meechie-studio-text` response carrying `PROVIDER_HTTP_ERROR`.

## Prompt Text Boundary and Environment Example Repair (2026-08-24)

### Review correction addendum

- Review findings: prove the title-only boundary through a checked-in fault fixture and fixture-backed mock; remove the inactive `MAX_IMAGES_PER_REQUEST` example rather than widen this repair into route validation; replace duplicated legacy PromptAssemblySeam implementation with a typed re-export of the canonical adapter; and keep the inner check/test transcript distinct from the outer verify chain's separately generated artifacts.
- Additional exact file paths: `fixtures/prompt-assembly/title-only-marker-fault.json`, `src/lib/seams/prompt-assembly-seam/contract.ts`, `src/lib/seams/prompt-assembly-seam/fixtures.ts`, `src/lib/seams/prompt-assembly-seam/mock.ts`, `src/lib/seams/prompt-assembly-seam/validators.ts`, `src/lib/seams/prompt-assembly-seam/test.ts`, `src/lib/adapters/prompt-assembly.adapter.ts`, `.env.example`, `package.json`, `DECISIONS.md`, `docs/evidence/2026-08-24/prompt-assembly-fixture-red.txt`, `docs/evidence/2026-08-25/rewind-PromptAssemblySeam(self-contained).txt`, and refreshed `docs/evidence/2026-08-25/*`.
- Additional exact commands: run the new fault-mock assertion red before accepting the boundary validator; rerun focused Vitest, `node scripts/rewind.mjs --seam PromptAssemblySeam`, and `node scripts/rewind.mjs --seam "PromptAssemblySeam (self-contained)"`; run the literal outer `npm run verify`, retain its inner check/test output in `docs/evidence/2026-08-25/verify.txt`, and rely on the separately generated chamber/shaolin/assumption/ledger/clan/proof artifacts plus the command exit for the remaining stages; run lint/build/Cipher Gate; then confirm GitHub verify, SonarQube, security scan, Vercel, and all review threads are green/resolved.
- Addendum self-critique: a validator tested only against the adapter would repeat the original proof gap, while wiring request-limit behavior in this PR would be an unrelated production change. The fault fixture must remain deliberately contract-violating at the input/result relationship, be served by the mock, and be rejected by the boundary validator; the good title-only and footer-bearing fixtures must still pass it. The verify script may switch from nested npm aliases to their identical direct Node entrypoints only to make the outer command auditable; command order and failure short-circuiting must remain unchanged.

### Plan

- Goal: Stop title-only coloring-page prompts from presenting `TYPOGRAPHY:` as a secondary exact-text value, restore `.env.example` as directly copyable plain text, and distinguish the Gemini wig try-on quota incident from code-owned defects.
- Exact seams: `PromptAssemblySeam`. `WigTryOnSeam` is verification-only in this work: the reported 429 is an exhausted provider quota and requires billing/quota restoration outside the repository, so its contract and adapter will not be changed.
- Exact file paths to touch:
  - `plan.md`
  - `DECISIONS.md`
  - `CHANGELOG.md`
  - `.env.example`
  - `fixtures/prompt-assembly/sample.json`
  - `fixtures/prompt-assembly/title-only.json`
  - `src/lib/adapters/prompt-assembly.adapter.ts`
  - `src/lib/adapters/prompt-assembly-seam/index.ts`
  - `tests/contract/prompt-assembly.test.ts`
  - `src/lib/seams/prompt-assembly-seam/test.ts`
  - `docs/evidence/2026-08-24/prompt-assembly-red.txt`
  - `docs/evidence/2026-08-24/prompt-assembly-green.txt`
  - `docs/evidence/2026-08-24/env-example-check.txt`
  - `docs/evidence/2026-08-25/rewind-PromptAssemblySeam.txt`
  - `docs/evidence/2026-08-25/verify.txt`
  - `docs/evidence/2026-08-25/test.txt`
  - `docs/evidence/2026-08-25/chamber-lock.json`
  - `docs/evidence/2026-08-25/shaolin-lint.json`
  - `docs/evidence/2026-08-25/assumption-alarm.json`
  - `docs/evidence/2026-08-25/seam-ledger.json`
  - `docs/evidence/2026-08-25/seam-ledger.md`
  - `docs/evidence/2026-08-25/clan-chain.json`
  - `docs/evidence/2026-08-25/clan-chain.md`
  - `docs/evidence/2026-08-25/proof-tape.json`
  - `docs/evidence/2026-08-25/proof-tape.md`
  - `docs/evidence/2026-08-25/cipher-gate.json`
- Exact commands to run:
  1. `npm ci --cache /tmp/meechies-npm-cache` (the initial plain `npm ci` attempt could not create the sandboxed default `/root/.npm` cache, so the retry uses a task-local cache without changing dependency resolution).
  2. `npm test -- tests/contract/prompt-assembly.test.ts src/lib/seams/prompt-assembly-seam/test.ts --pool=forks --maxWorkers=1` after changing the fixture/tests but before changing either adapter, capturing the expected red failure. If the work runner cannot return an expected nonzero npm-script result, run the equivalent `./node_modules/.bin/vitest run tests/contract/prompt-assembly.test.ts src/lib/seams/prompt-assembly-seam/test.ts --pool=forks --maxWorkers=1` directly for the evidence capture.
  3. `npm test -- tests/contract/prompt-assembly.test.ts src/lib/seams/prompt-assembly-seam/test.ts --pool=forks --maxWorkers=1` after changing both adapters, capturing the green result. Use the equivalent direct Vitest command from step 2 if the npm-script wrapper cannot return through the work runner.
  4. `npm run rewind -- --seam PromptAssemblySeam`; if the npm-script wrapper cannot return through the work runner, invoke the same repository script directly with `node scripts/rewind.mjs --seam PromptAssemblySeam`.
  5. `node --input-type=module -e "import { readFile } from 'node:fs/promises'; const value = await readFile('.env.example', 'utf8'); if (!value.startsWith('# Purpose:') || !value.includes('XAI_API_KEY=') || !value.includes('GEMINI_API_KEY=')) process.exit(1); console.log('plain-text .env.example verified');"`.
  6. `npm run lint`.
  7. `npm run build`. If a repeat build reports an `EEXIST` symlink under generated `.vercel/output`, move only that derived directory to `/tmp/meechies-vercel-output-stale-20260824-1719` and rerun the build.
  8. `npm run verify`. If the work runner drops the long-lived npm shell after `shaolin:lint`, confirm `verify.txt`, `test.txt`, and `shaolin-lint.json` are green, then complete the unchanged remaining chain with `node scripts/assumption-alarm.mjs`, `node scripts/seam-ledger.mjs`, `node scripts/clan-chain.mjs`, and `node scripts/proof-tape.mjs`. If self-review changes a watched source/fixture afterward, refresh the full evidence with `node scripts/chamber-lock.mjs`, `node scripts/verify-runner.mjs`, `node scripts/shaolin-lint.mjs`, and the same remaining direct scripts.
  9. `npm run cipher:gate`; if the npm-script wrapper cannot return through the work runner, invoke the same repository script directly with `node scripts/cipher-gate.mjs`.
  10. `git diff --check origin/main...HEAD` after commits are created.

### Self-critique

1. What could be wrong: Removing the secondary-line instruction unconditionally would break pages that do have `footerItem`; changing only the canonical adapter would leave the legacy contract suite inconsistent.
2. What must be proven: Both adapters retain the instruction/value pair when a footer exists, both omit the entire pair when it does not, `TYPOGRAPHY:` immediately follows the title in title-only prompts, the changed prompt contract reports template `v3` in both fixtures, `.env.example` begins as readable configuration text, and all repository verification gates pass.
3. Riskiest assumption: The 429 is solely provider quota state; the existing typed fixture and adapter already preserve a 429 response, but only restoring Gemini billing/quota can prove a live try-on succeeds again.
4. Evidence to prove/disprove: Red/green legacy and self-contained PromptAssemblySeam tests, focused rewind output, a plain-text environment-file assertion, build/lint/full Seam-Driven Development verification, Cipher Gate output, CI, and post-PR review-thread inspection.
5. Evidence-date note: the repository evidence scripts use UTC folder dates, so commands run during the evening of local 2026-08-24 write generated evidence under `docs/evidence/2026-08-25/`; the manually captured red/green/setup evidence remains under the local-date folder.

## Retired xAI Model Outage: Pin Model Ids and Surface Provider Errors (2026-08-24)

### Shortcut Check

1. Shortcut a typical AI might take: change the `DEFAULT_TEXT_MODEL` constant, see green tests, and declare the outage fixed.
2. Countermeasure: that would not have fixed production. `XAI_TEXT_MODEL` was set in the deployment and overrode the code default, so the stale id would have survived the change. The env read itself has to go.
3. Lower-debt path: pin model ids in code as the single source of truth, delete every runtime env read, and fix the error parsing that hid the failure — so the next provider retirement is visible in minutes rather than never.

### Plan

- Seams (all already registered in `docs/seams.md`): ProviderAdapterSeam, AppConfigSeam, ImageProviderConfigSeam, MeechieStudioTextSeam, MeechieToolSeam, ChatInterpretationSeam.
- Exact files:
  - `src/lib/core/models.js` (new checked ESM module; replaces `src/lib/core/text-model.ts` and remains directly importable by plain Node 20 probes)
  - `src/lib/core/chat-interpretation-pipeline.ts`, `src/lib/core/meechie-studio-text-pipeline.ts`
  - `src/lib/adapters/meechie-tool.adapter.ts`, `src/lib/adapters/meechie-tool-seam/index.ts`
  - `src/lib/adapters/meechie-studio-text.adapter.ts`, `src/routes/api/meechie-studio-text/+server.ts`
  - `src/lib/adapters/app-config-seam/index.ts`, `src/lib/adapters/image-provider-config-seam/index.ts`
  - `src/lib/adapters/provider-adapter.adapter.ts`, `probes/provider-adapter.probe.mjs`
  - `src/lib/seams/image-provider-config-seam/{fixtures,test}.ts`, `fixtures/provider-adapter/{sample,fault}.json`
  - `tests/unit/models.test.ts`, `tests/unit/provider-adapter-helpers.test.ts`
  - `.env.example`, `README.md`, `docs/release-smoke-checklist-2026-05-05.md`, `DECISIONS.md`, `LESSONS_LEARNED.md`
- Exact commands: `npm install`, `npm run check`, `npm test`, `npm run lint`, `npm run verify`, `npm run cipher:gate`, `npm run assumption:alarm`.
- Constraint: no contract shape changes. `AppConfigSeam` keeps requiring non-empty `xaiTextModel`/`xaiImageModel`; the adapter supplies constants so the fields stay populated without env.

### Self-Critique

- What could be wrong: pinning ids trades dashboard hot-swapping for a deploy. That is deliberate — the hot-swap path is exactly what caused this outage — but it does mean the next model retirement needs a code change.
- Riskiest assumption: that a replacement image model accepts the same request parameters. This was NOT provable — the preview deployment sits behind Vercel SSO, so no probe could reach it. Rather than ship an unverified change to the only path that was still working, `IMAGE_MODEL` stays at the confirmed-working `grok-imagine-image`; the upgrade is deferred to its own change.
- What must be proven: that `grok-4.6` actually answers. Unit tests cannot prove it — every one of them mocks the provider, which is precisely why green tests never caught the outage. Only a probe against a reachable deployment closes this.
- Evidence that would disprove it: a `PROVIDER_HTTP_ERROR` from `/api/meechie-studio-text` on a deployed build. Thanks to the error-parsing fix, that response would now carry xAI's real message instead of a bare "Bad Request".

## PR #114 Manual Integration: Ordinal and Config Parsing Cleanup (2026-06-07)

### Shortcut Check

1. Shortcut a typical AI might take: merge PR #114 as-is and overwrite newer generate-pipeline and studio-text-pipeline behavior.
2. Countermeasure: compare the PR against current `main`, skip stale hunks, and only port changes that still fix current code.
3. Lower-debt path: share ordinal formatting between the legacy and self-contained MeechieToolSeam adapters, and validate optional integer config with an explicit integer-string parser instead of accepting floats.

### Plan

- Goal: Manually integrate PR #114's still-current ordinal and AppConfigSeam parsing improvements without regressing current pipeline behavior.
- Exact seams: MeechieToolSeam, AppConfigSeam.
- Exact file paths to touch:
  - `plan.md`
  - `DECISIONS.md`
  - `src/lib/core/ordinal.ts`
  - `src/lib/adapters/meechie-tool.adapter.ts`
  - `src/lib/adapters/meechie-tool-seam/index.ts`
  - `src/lib/adapters/app-config-seam/index.ts`
  - `tests/unit/meechie-tool-adapter.test.ts`
  - `tests/unit/app-config-seam.test.ts`
  - `tests/unit/ordinal.test.ts`
  - `src/lib/seams/meechie-tool-seam/test.ts`
  - `docs/hpr-pr-resolution-ledger-2026-06-05.md`
  - `docs/evidence/2026-06-07/pr-114-focused-tests.txt`
  - `docs/evidence/2026-06-07/pr-114-check.txt`
  - `docs/evidence/2026-06-07/pr-114-lint.txt`
  - `docs/evidence/2026-06-07/pr-114-verify.txt`
  - `docs/evidence/2026-06-07/pr-114-diff-check.txt`
- Exact commands to run:
  1. `npm.cmd test -- tests/unit/meechie-tool-adapter.test.ts tests/unit/app-config-seam.test.ts tests/unit/ordinal.test.ts src/lib/seams/meechie-tool-seam/test.ts --pool=forks --maxWorkers=1`
  2. `npm.cmd run check`
  3. `npm.cmd run lint`
  4. `npm.cmd run verify`
  5. `git diff --check`
- Skipped stale hunks:
  - `src/lib/core/generate-pipeline.ts`: current `main` already validates the typed image-generation seam result body instead of parsing `Response.json()` directly.
  - `src/lib/core/meechie-studio-text-pipeline.ts`: current `main` already centralizes provider error response handling and preserves newer status mapping.
  - `src/lib/core/http-client.ts`: current `main` already has the stronger structured response policy from the HTTP error workpack.

### Self-critique

1. What could be wrong: Treating the ordinal fix as a legacy-adapter-only bug would leave the self-contained MeechieToolSeam adapter with the same defect.
2. What must be proven: Legacy and self-contained MeechieToolSeam lineups format 11th/12th/13th and 21st/22nd/23rd correctly, whitespace-only max image config defaults through the schema, float config does not get accepted as an integer, and focused/full verification gates pass.
3. Riskiest assumption: Returning `undefined` for non-integer optional config preserves the existing "invalid optional string becomes default" policy; out-of-range integer strings still prove rejection through the existing schema tests.
4. Evidence to prove/disprove: Focused red/green tests, Svelte check, lint, full Seam-Driven Development verification, and diff-check output.

## PR #136 Manual Integration: Client postJson Timeouts (2026-06-07)

### Shortcut Check

1. Shortcut a typical AI might take: apply PR #136 directly and accidentally regress current `postJson` handling for 204/205, empty bodies, malformed JSON, and non-OK JSON payloads.
2. Countermeasure: write focused timeout tests against current `postJson`, preserve every existing HTTP-client behavior test, and port only the timeout behavior plus caller budgets.
3. Lower-debt path: centralize endpoint timeout budgets in `src/lib/core/http-client.ts` so callers do not duplicate magic numbers across Svelte routes and components.

### Plan

- Goal: Add bounded client-side timeouts to every browser `postJson` caller while preserving current response parsing and non-OK payload policy.
- Exact seams: none; this is browser HTTP helper behavior and UI caller configuration, not a listed Seam-Driven Development seam.
- Exact file paths to touch:
  - `plan.md`
  - `src/lib/core/http-client.ts`
  - `src/routes/studio-state.svelte.ts`
  - `src/lib/components/MeechieModePage.svelte`
  - `src/lib/components/MeechieTools.svelte`
  - `src/routes/random/+page.svelte`
  - `src/routes/rate-his-excuse/+page.svelte`
  - `src/routes/who-fucked-up/+page.svelte`
  - `tests/unit/http-client.test.ts`
  - `docs/evidence/2026-06-07/pr-136-http-client-red.txt`
  - `docs/evidence/2026-06-07/pr-136-http-client-focused-tests.txt`
  - `docs/evidence/2026-06-07/pr-136-check.txt`
  - `docs/evidence/2026-06-07/pr-136-lint.txt`
  - `docs/evidence/2026-06-07/pr-136-verify.txt`
  - `docs/evidence/2026-06-07/pr-136-diff-check.txt`
- Exact commands to run:
  1. `npm.cmd test -- tests/unit/http-client.test.ts --pool=forks --maxWorkers=1`
  2. `npm.cmd run check`
  3. `npm.cmd run lint`
  4. `npm.cmd run verify`
  5. `git diff --check`
- PR disposition rule: close #136 only after the replacement commit is on `origin/main`, with a comment noting the stale PR parser regression was avoided.

### Self-critique

1. What could be wrong: Client timeouts could surface as generic errors if `TimeoutError` is not mapped at the `postJson` boundary.
2. What must be proven: Timeout-enabled requests pass an abort signal to `fetch`, elapsed timeouts reject with a readable message, no-timeout AbortErrors remain unchanged, and non-OK JSON bodies still resolve to payloads.
3. Riskiest assumption: The endpoint timeout budgets from PR #136 are still reasonable for current main.
4. Evidence to prove/disprove: Red/green HTTP-client tests, check/lint/full verify output, and a caller inventory showing no unbudgeted `postJson` calls remain.

## PR #117 Manual Integration: SelfieUpload FileReader Guard (2026-06-07)

### Shortcut Check

1. Shortcut a typical AI might take: close PR #117 as superseded after seeing the ESLint and prop-cleanup pieces already exist on main.
2. Countermeasure: inspect each PR claim against current files, isolate the one missing behavior, and add a failing focused test before changing production code.
3. Lower-debt path: avoid merging stale lint configuration or callback-name churn; extract the small data URL parsing rule into a pure helper so the edge case is testable without adding a component-test dependency.

### Plan

- Goal: Preserve current main while manually integrating only PR #117's missing `FileReader.result` runtime guard for `SelfieUpload`.
- Exact seams: none; this is component-local browser file-input parsing and does not change a listed Seam-Driven Development seam.
- Exact file paths to touch:
  - `plan.md`
  - `src/lib/core/selfie-upload.ts`
  - `src/lib/components/SelfieUpload.svelte`
  - `tests/unit/selfie-upload.test.ts`
  - `docs/evidence/2026-06-07/pr-117-selfie-upload-red.txt`
  - `docs/evidence/2026-06-07/pr-117-selfie-upload-focused-tests.txt`
  - `docs/evidence/2026-06-07/pr-117-check.txt`
  - `docs/evidence/2026-06-07/pr-117-lint.txt`
  - `docs/evidence/2026-06-07/pr-117-verify.txt`
  - `docs/evidence/2026-06-07/pr-117-diff-check.txt`
- Exact commands to run:
  1. `npm.cmd test -- tests/unit/selfie-upload.test.ts --pool=forks --maxWorkers=1`
  2. `npm.cmd run check`
  3. `npm.cmd run lint`
  4. `npm.cmd run verify`
  5. `git diff --check`
- PR disposition rule: close #117 only after current main has the missing guard, focused verification passes, and the PR comment states which parts were already superseded versus manually integrated.

### Self-critique

1. What could be wrong: A helper extraction could be unnecessary abstraction if it grows beyond data URL parsing.
2. What must be proven: Non-string `FileReader.result` does not call `onUpload`, gives the existing readable error, and valid data URLs still parse to the same base64 payload.
3. Riskiest assumption: Focused unit coverage is enough for this slice because the actual file input and callback wiring remain unchanged.
4. Evidence to prove/disprove: Red/green focused unit test output, Svelte check, ESLint output, full verify output, and whitespace diff check.

## PR Backlog Resolution and Merge Workpack (2026-06-06)

### Plan
- Goal: Automate conflict resolution, test verification, and clean merging of all open PRs using the validation scripts and programmatic Codex commands.
- Exact seams: process execution, git/filesystem operations.
- Exact file paths to touch:
  - `plan.md`
  - `docs/triage-table.md`
  - `docs/hpr-pr-resolution-ledger-2026-06-05.md`
- Exact commands to run:
  1. `git stash --include-untracked` to stash local staged modifications and untracked files safely.
  2. `node scripts/validate-pr-backlog.js` to run verification against the clean candidate branch (PR #127).
  3. `node scripts/get-pr-todos.js 127` to parse open review comment threads.
  4. Call Codex MCP to resolve the review todos in `docs/evidence/2026-06-06/pr-127-todo.md` on the candidate branch.
  5. Run `npm test` and `npm run verify` on the candidate branch.
  6. Checkout `main` and merge the validated PR branch.
  7. Loop through other conflicting PRs (starting from recent ones) to resolve conflicts: checkout a branch, merge `main`, call Codex programmatically to resolve conflicts, verify, and merge.
  8. Run `git stash pop` to restore the staged modifications once PR merges are complete.

### Self-critique
1. What could be wrong: Stashing the 40+ modified/staged files could result in conflicts when popping them if the PR merges modify the same lines or files (e.g. `docs/seams.md` or Svelte components).
2. What must be proven: That PR #127 matches current contracts, passes all lints and vitests, and matches the review thread requirements.
3. Riskiest assumption: That all 46 conflicting PRs can be merged programmatically without manual design conflict resolution. In reality, some stale PRs might have been superseded by newer workpacks and should be marked as "Closed/Superseded" instead of merged.
4. Evidence to prove/disprove: Log outputs of `validate-pr-backlog.js`, verification reports under `docs/evidence/2026-06-06/`, and successful run of `npm run verify` after each merge.

## HPR Dedication Input Draft-Save Workpack (2026-06-05)

### Shortcut Check

1. Shortcut a typical AI might take: copy PR #92's broad non-main UI extraction or only change `saveDraft()` to `scheduleDraftSave()` without proving the stale input and clearing behavior.
2. Countermeasure: keep the patch to the current `+page.svelte`/`StudioInputPanel.svelte` flow, add a Playwright red test that observes real browser input events and localStorage draft writes, and preserve `currentDedication()` normalization.
3. Lower-debt path: use the existing debounced `scheduleDraftSave()` helper, let the child component read the DOM input value, pass a plain string to the parent, and avoid introducing a new store or component abstraction for one handler.

### Plan

- Goal: Fix the Shoutout/dedication input path so each input event updates local state before validation, normalizes cleared text to `undefined`, and schedules the existing debounced draft save instead of writing the draft on every keystroke.
- Exact seams: `CreationStoreSeam`, `SpecValidationSeam`.
- Exact file paths to touch:
  - `plan.md`
  - `src/routes/+page.svelte`
  - `src/lib/components/studio/StudioInputPanel.svelte`
  - `tests/e2e/smoke.spec.ts`
  - `docs/hpr-pr-resolution-ledger-2026-06-05.md`
  - `DECISIONS.md`
- Exact commands to run:
  1. `npx playwright test tests/e2e/smoke.spec.ts --project=chromium --grep "shoutout"`
  2. `npm.cmd run check`
  3. `npm.cmd test -- tests/unit/meechie-studio.test.ts tests/contract/creation-store.test.ts --pool=forks --maxWorkers=1`
  4. `npm.cmd run rewind -- --seam CreationStoreSeam`
  5. `npm.cmd run rewind -- --seam SpecValidationSeam`
  6. `npx playwright test tests/e2e/smoke.spec.ts --project=chromium`
  7. `npm.cmd run lint`
  8. `npm.cmd test`
  9. `npm.cmd run build`
  10. `npm.cmd run verify`
  11. `npm.cmd run cipher:gate`
  12. `git diff --check`
- Replacement PR base: `codex/hpr-studio-text-recovery-2026-06-05`, because this workpack follows the studio-text recovery slice in the HPR stack.
- Required red test before production edits: `tests/e2e/smoke.spec.ts` should fill the Shoutout field, assert no `cb_drafts_v1` localStorage write happens immediately, poll until the debounced write appears with trimmed dedication, then clear the field and poll until the saved draft omits `intent.dedication`.
- Old PR disposition rule: comment or close #92 only after this replacement work is merged, unless a remaining blocker is recorded in the ledger with a GitHub comment.

### Self-critique

1. What could be wrong: E2E timing can be flaky if the test depends on arbitrary waits or app hydration rather than observable localStorage writes.
2. What must be proven: The child passes the current input value as a string, `spec.dedication` is `trim() || undefined`, draft writes are debounced rather than immediate, clearing the input persists `undefined`, and existing home smoke flows still pass.
3. Riskiest assumption: Reading the draft payload from `localStorage` is a stable proxy for `CreationStoreSeam.saveDraft()` in the browser; this is acceptable because the adapter's draft key is contract-local and the test waits for the session marker before clearing and typing.
4. Evidence to prove/disprove: Red/green Playwright shoutout test, Svelte check, focused CreationStore/SpecValidation tests, seam rewinds, full smoke test, full check/lint/test/build/verify output, Cipher Gate evidence, and HPR ledger updates.

## HPR MeechieStudioTextPipeline Error Recovery Workpack (2026-06-05)

### Shortcut Check

1. Shortcut a typical AI might take: copy PR #98 wholesale, keep direct `$env/dynamic/private` reads in core, and call malformed JSON plus schema failures the same thing.
2. Countermeasure: write red tests first on current stacked code, separate JSON syntax failures from schema validation failures, preserve valid JSON primitives as parse successes that fail schema validation, and inject runtime mode/text model through deps.
3. Lower-debt path: keep `MeechieStudioTextSeam` orchestration pure, keep provider I/O behind `ProviderAdapterSeam`, avoid changing provider contracts in this slice, and make retry prompt field guidance derive from one shared required-field list.

### Plan

- Goal: Port the useful #98 error-recovery behavior into current code while fixing its valid review comments: syntax-vs-schema retries, primitive JSON handling, retry prompt/schema consistency, injected runtime mode, accurate timeout status mapping, and removal of redundant post-parse validation.
- Exact seams: `MeechieStudioTextSeam`, `ProviderAdapterSeam`.
- Exact file paths to touch:
  - `plan.md`
  - `src/lib/core/meechie-studio-text-pipeline.ts`
  - `src/routes/api/meechie-studio-text/+server.ts`
  - `src/lib/adapters/meechie-studio-text.adapter.ts`
  - `tests/unit/meechie-studio-text-pipeline.test.ts`
  - `tests/contract/meechie-studio-text.test.ts` only if adapter deps signature requires a contract-test update
  - `docs/hpr-pr-resolution-ledger-2026-06-05.md`
  - `DECISIONS.md`
- Exact commands to run:
  1. `npm.cmd test -- tests/unit/meechie-studio-text-pipeline.test.ts --pool=forks --maxWorkers=1`
  2. `npm.cmd test -- tests/unit/meechie-studio-text-pipeline.test.ts tests/contract/meechie-studio-text.test.ts --pool=forks --maxWorkers=1`
  3. `npm.cmd run rewind -- --seam MeechieStudioTextSeam`
  4. `npm.cmd run rewind -- --seam ProviderAdapterSeam`
  5. `npm.cmd run check`
  6. `npm.cmd run lint`
  7. `npm.cmd test`
  8. `npm.cmd run build`
  9. `npm.cmd run verify`
  10. `npm.cmd run cipher:gate`
  11. `git diff --check`
- Replacement PR base: `codex/hpr-timeout-abort-policy-2026-06-05`, because this workpack depends on the current provider timeout/abort classification and keeps the HPR stack linear after PR #134.
- Required red tests before production edits:
  1. A malformed JSON first attempt sends a retry prompt that names JSON syntax failure and succeeds when the retry returns a valid contract object.
  2. A schema-invalid object first attempt sends a retry prompt that names schema validation failure and uses required-field guidance consistent with `STUDIO_TEXT_RESPONSE_FORMAT.required`.
  3. Valid JSON primitives such as `false`, `0`, `""`, and `null` are treated as parsed JSON that failed schema validation, not syntax failures.
  4. Provider `PROVIDER_API_KEY_MISSING` returns status 200 in non-production mode and 502 in production mode through injected deps, without reading env in core.
  5. Provider 429 or other `PROVIDER_HTTP_ERROR` returns 502 while preserving the provider error payload.
  6. Provider timeout-like `PROVIDER_NETWORK_ERROR` returns 504, while generic network `PROVIDER_NETWORK_ERROR` returns 502.
  7. Provider error during retry is returned with the same status classifier as first-attempt provider errors.
- Old PR disposition rule: comment or close #98 only after this replacement work is merged, unless a remaining blocker is recorded in the ledger with a GitHub comment.

### Self-critique

1. What could be wrong: Moving env-derived model/runtime values out of core can accidentally change default adapter behavior if route and adapter defaults are not preserved carefully.
2. What must be proven: Schema failures and JSON syntax failures get different retry prompts; primitive JSON reaches schema validation; retry prompt required fields stay aligned with the response-format schema; missing API key dev/prod statuses are driven by deps; timeout network errors map to 504 while generic network errors map to 502; and retry provider errors preserve structured payloads.
3. Riskiest assumption: Classifying provider timeout by error code plus timeout wording is acceptable for this slice because `ProviderAdapterSeam` currently uses `PROVIDER_NETWORK_ERROR` for both timeout and non-timeout transport failures; a richer provider error code can be a later seam-contract change if needed.
4. Evidence to prove/disprove: Red/green targeted unit tests, `npm.cmd run rewind -- --seam MeechieStudioTextSeam`, `npm.cmd run rewind -- --seam ProviderAdapterSeam`, full check/lint/test/build/verify output, Cipher Gate evidence, and HPR ledger updates.

## HPR Timeout, Abort, and Retry Policy Workpack (2026-06-05)

### Shortcut Check

1. Shortcut a typical AI might take: copy PR #108/#85 retry code wholesale, retry billable image POSTs, and treat every `AbortError` as a timeout.
2. Countermeasure: write red tests first on current stacked code, preserve caller abort separately from provider timeout, cap all retry delays, and remove automatic retries from provider image generation unless idempotency is implemented.
3. Lower-debt path: keep timeout/signal behavior in shared HTTP primitives, keep route handlers responsible for passing caller signals, and keep adapter changes scoped to the seams that already own network I/O.

### Plan

- Goal: Harden timeout, abort, and retry behavior so caller cancellation is not retried, true provider timeouts are contract-shaped 504 responses, body-read aborts are not misreported as invalid JSON, retry inputs reject non-finite values, exponential backoff is capped, and billable provider image POSTs are not retried automatically.
- Exact seams: `ImageGenerationSeam`, `WigTryOnSeam`, `ProviderAdapterSeam`, `SpecValidationSeam`, `PromptAssemblySeam`, `DriftDetectionSeam`.
- Exact file paths to touch:
  - `plan.md`
  - `src/lib/core/http-resilience.ts`
  - `tests/unit/http-resilience.test.ts`
  - `src/lib/adapters/provider-adapter.adapter.ts`
  - `tests/unit/provider-adapter-helpers.test.ts`
  - `src/lib/seams/image-generation-seam/contract.ts`
  - `src/lib/adapters/image-generation-seam/index.ts`
  - `tests/contract/image-generation.test.ts`
  - `src/lib/core/image-generation-pipeline.ts`
  - `tests/unit/image-generation-pipeline.test.ts`
  - `src/lib/core/generate-pipeline.ts`
  - `tests/unit/api-generate.test.ts`
  - `src/routes/api/generate/+server.ts`
  - `src/routes/api/image-generation/+server.ts`
  - `src/lib/seams/wig-try-on-seam/contract.ts`
  - `src/lib/seams/wig-try-on-seam/test.ts`
  - `src/lib/adapters/wig-try-on-seam/index.ts`
  - `src/lib/core/wig-try-on-pipeline.ts`
  - `src/routes/api/wig-try-on/+server.ts`
  - `tests/unit/api-wig-try-on.test.ts`
  - `docs/hpr-pr-resolution-ledger-2026-06-05.md`
  - `DECISIONS.md`
- Exact commands to run:
  1. `npm.cmd test -- tests/unit/http-resilience.test.ts tests/unit/provider-adapter-helpers.test.ts tests/contract/image-generation.test.ts tests/unit/image-generation-pipeline.test.ts tests/unit/api-generate.test.ts tests/unit/api-wig-try-on.test.ts --pool=forks --maxWorkers=1`
  2. `npm.cmd run rewind -- --seam ImageGenerationSeam`
  3. `npm.cmd run rewind -- --seam WigTryOnSeam`
  4. `npm.cmd run rewind -- --seam ProviderAdapterSeam`
  5. `npm.cmd run check`
  6. `npm.cmd run lint`
  7. `npm.cmd test`
  8. `npm.cmd run build`
  9. `npm.cmd run verify`
  10. `npm.cmd run cipher:gate`
  11. `git diff --check`
- Replacement PR base: `codex/hpr-safety-policy-generate-gate-2026-06-05`, because this workpack depends on the direct generate-to-`ImageGenerationSeam` path and safety gate from PRs #130/#131.
- Old PR disposition rule: comment or close #108/#107/#100/#95/#85 only after this replacement work is merged, unless a remaining blocker is recorded in the ledger with a GitHub comment.

### Self-critique

1. What could be wrong: Adding `AbortSignal` to seam request types introduces a non-JSON in-process field that validators intentionally strip, so tests must prove fixture-backed mocks and routes still behave deterministically.
2. What must be proven: Caller abort returns a distinct contract error and is not retried; true timeout returns timeout classification; body-read abort/timeout is not reported as parse failure; provider image generation no longer retries billable POSTs; chat retry behavior still works; finite retry validation rejects `NaN`, `Infinity`, non-integer attempts, and negative delay; and capped delays are observable with fake timers.
3. Riskiest assumption: It is acceptable to keep `ProviderAdapterSeam` chat retries for now while disabling provider image retries, because chat retry policy needs a separate product decision about duplicate model-call cost and caller idempotency.
4. Evidence to prove/disprove: Red/green targeted tests, seam rewinds for `ImageGenerationSeam`, `WigTryOnSeam`, and `ProviderAdapterSeam`, full check/lint/test/build/verify output, Cipher Gate evidence, and HPR ledger updates.

## HPR SafetyPolicySeam Generate Gate Workpack (2026-06-05)

### Shortcut Check

1. Shortcut a typical AI might take: port PR #115 directly and leave its review comments unresolved.
2. Countermeasure: write the replacement against the current generate-through-ImageGenerationSeam branch, include `styleHint` in the checked input, rebuild test deps per test, and keep core generation dependency-injected instead of importing a mock by name.
3. Lower-debt path: expose a pure production-facing safety policy factory for the deterministic in-process guardrail, keep route composition responsible for wiring it, and document the remaining mock/fixture debt instead of hiding it.

### Plan

- Goal: Wire `SafetyPolicySeam` into `/api/generate` as the first generate-path gate so unsafe spec or `styleHint` text returns a contract-shaped `CONTENT_POLICY_VIOLATION` before spec validation, prompt assembly, image generation, or drift detection.
- Exact seams: `SafetyPolicySeam`, `ImageGenerationSeam`, `SpecValidationSeam`, `PromptAssemblySeam`, `DriftDetectionSeam`, `ProviderAdapterSeam`.
- Exact file paths to touch:
  - `plan.md`
  - `src/lib/core/generate-pipeline.ts`
  - `src/routes/api/generate/+server.ts`
  - `src/lib/seams/safety-policy-seam/contract.ts`
  - `src/lib/seams/safety-policy-seam/fixtures.ts`
  - `src/lib/seams/safety-policy-seam/mock.ts`
  - `src/lib/seams/safety-policy-seam/policy.ts`
  - `src/lib/seams/safety-policy-seam/probe.ts`
  - `src/lib/seams/safety-policy-seam/test.ts`
  - `tests/unit/api-generate.test.ts`
  - `tests/unit/pipeline-edge-cases.test.ts`
  - `docs/hpr-pr-resolution-ledger-2026-06-05.md`
  - `DECISIONS.md`
- Exact commands to run:
  1. `npm.cmd test -- src/lib/seams/safety-policy-seam/test.ts tests/unit/api-generate.test.ts tests/unit/pipeline-edge-cases.test.ts --pool=forks --maxWorkers=1`
  2. `npm.cmd run rewind -- --seam SafetyPolicySeam`
  3. `npm.cmd run check`
  4. `npm.cmd run lint`
  5. `npm.cmd test`
  6. `npm.cmd run build`
  7. `npm.cmd run verify`
  8. `npm.cmd run cipher:gate`
  9. `git diff --check`
- Replacement PR base: `codex/hpr-generate-image-seam-2026-06-05`, because this workpack depends on the direct image pipeline dependency shape from PR #130.
- Old PR disposition rule: comment or close #115 only after this replacement work is merged, unless a blocker is recorded with a GitHub comment.

### Self-critique

1. What could be wrong: Running safety before `SpecValidationSeam` means the safety policy sees request-schema-validated but not domain-validated specs, so optional fields and future raw shapes must be handled defensively.
2. What must be proven: Unsafe title, item label, dedication, footer label, and `styleHint` text are blocked before image generation; safe specs still generate; test mocks do not lose implementations after `vi.restoreAllMocks`; and structured image errors remain unchanged when safety passes.
3. Riskiest assumption: A deterministic in-process safety policy is acceptable as the production guardrail for this repo even though the existing file is named `mock.ts`; the mitigation is a pure `policy.ts` factory and a ledger note that deeper fixture-scenario cleanup remains separate.
4. Evidence to prove/disprove: Red/green targeted safety/generate tests, `npm.cmd run rewind -- --seam SafetyPolicySeam`, full check/lint/test/build/verify output, Cipher Gate evidence, and HPR ledger updates.

## HPR Generate Through ImageGenerationSeam Workpack (2026-06-05)

### Shortcut Check

1. Shortcut a typical AI might take: keep the internal `/api/image-generation` fetch and only add a catch around it.
2. Countermeasure: remove the sibling HTTP hop from `runGeneratePipeline`, inject the image-generation pipeline function directly, and prove `fetch` is not part of the generate orchestration path.
3. Lower-debt path: keep route handlers thin, keep adapter creation in the route layer, and keep core generation orchestration behind typed dependencies.

### Plan

- Goal: Route `/api/generate` orchestration through `runImageGenerationPipeline`/`ImageGenerationSeam` instead of raw internal HTTP, while preserving typed image failure payloads and guarding unexpected thrown image errors as contract-shaped generate errors.
- Exact seams: `ImageGenerationSeam`, `SpecValidationSeam`, `OutputPackagingSeam`, `ProviderAdapterSeam`.
- Exact file paths to touch:
  - `plan.md`
  - `src/lib/core/generate-pipeline.ts`
  - `src/routes/api/generate/+server.ts`
  - `tests/unit/api-generate.test.ts`
  - `tests/unit/pipeline-edge-cases.test.ts`
  - `docs/hpr-pr-resolution-ledger-2026-06-05.md`
  - `DECISIONS.md`
- Exact commands to run:
  1. `npm.cmd test -- tests/unit/api-generate.test.ts --pool=forks --maxWorkers=1`
  2. `npm.cmd test -- tests/unit/api-generate.test.ts tests/unit/image-generation-pipeline.test.ts tests/contract/image-generation.test.ts --pool=forks --maxWorkers=1`
  3. `npm.cmd run rewind -- --seam ImageGenerationSeam`
  4. `npm.cmd run check`
  5. `npm.cmd run lint`
  6. `npm.cmd test`
  7. `npm.cmd run build`
  8. `npm.cmd run verify`
  9. `npm.cmd run cipher:gate`
  10. `git diff --check`
- Replacement PR base: `codex/hpr-http-error-policy-2026-06-05`, because this workpack depends on the structured HTTP error policy and ledger from PR #129.
- Old PR disposition rule: comment or close #112/#74 only after this replacement work is merged, unless a no-salvage audit and comment URL are recorded.

### Self-critique

1. What could be wrong: Moving from an HTTP boundary to a direct function boundary could accidentally change status mapping or let thrown adapter errors escape as generic SvelteKit 500s.
2. What must be proven: Generate success still assembles prompt/images/drift, typed image errors preserve their code and status, invalid image pipeline bodies become contract errors, thrown image exceptions become contract-shaped 502/504 responses, and route-level invalid JSON/payload behavior remains unchanged.
3. Riskiest assumption: It is acceptable for `/api/generate` to compose `runImageGenerationPipeline` directly while `/api/image-generation` remains available as its own route for direct callers.
4. Evidence to prove/disprove: Red/green `tests/unit/api-generate.test.ts`, focused image seam/pipeline tests, updated pipeline edge-case tests, `npm.cmd run rewind -- --seam ImageGenerationSeam`, full check/lint/test/build/verify output, Cipher Gate evidence, and HPR ledger updates.

## HPR HTTP Error Policy Workpack (2026-06-05)

### Shortcut Check

1. Shortcut a typical AI might take: copy an old PR's `postJson` change and reintroduce non-2xx structured error loss.
2. Countermeasure: write focused failing tests first, implement current-main behavior directly, and keep old PR branches as evidence only.
3. Lower-debt path: centralize the policy in `src/lib/core/http-client.ts`, keep endpoint contracts untouched, and validate the downstream API tests instead of patching each caller.

### Plan

- Goal: Lock the browser JSON POST policy so successful JSON returns parsed data, `204` and `205` return `undefined`, non-2xx contract-shaped JSON is returned to callers, invalid JSON errors include URL/status/status text/parse reason, and empty non-OK bodies throw a rich HTTP error.
- Exact seams: `ProviderAdapterSeam`, `ChatInterpretationSeam`, `MeechieToolSeam`, `MeechieStudioTextSeam`, `ImageGenerationSeam`.
- Exact file paths to touch:
  - `plan.md`
  - `src/lib/core/http-client.ts`
  - `tests/unit/http-client.test.ts`
  - `docs/hpr-pr-resolution-ledger-2026-06-05.md`
  - `DECISIONS.md`
- Exact commands to run:
  1. `npm.cmd test -- tests/unit/http-client.test.ts --pool=forks --maxWorkers=1`
  2. `npm.cmd test -- tests/unit/http-client.test.ts tests/unit/api-chat-interpretation.test.ts tests/unit/api-tools.test.ts --pool=forks --maxWorkers=1`
  3. `npm.cmd run check`
  4. `npm.cmd run lint`
  5. `npm.cmd test`
  6. `npm.cmd run build`
  7. `npm.cmd run verify`
  8. `npm.cmd run cipher:gate`
  9. `git diff --check`
- Replacement PR base: `codex/hpr-ledger-baseline-2026-06-05`, because this workpack updates the Handoff PR Resolution ledger from PR #128.
- Old PR disposition rule: comment or close only after this replacement work is merged, unless the ledger records a no-salvage blocker and a comment URL.

### Self-critique

1. What could be wrong: Some callers may currently expect `postJson` to reject on non-2xx status, so returning contract JSON could reveal caller assumptions that need targeted fixes.
2. What must be proven: Structured non-2xx payloads reach callers, invalid JSON failures remain loud and diagnostic, `204`/`205` do not parse a body, and downstream chat/tool tests still match the new policy.
3. Riskiest assumption: This is a client helper policy change and does not require endpoint contract fixture refresh because endpoint payload shapes are not changing.
4. Evidence to prove/disprove: Focused red/green `tests/unit/http-client.test.ts` output, downstream API unit output, full check/lint/test/build output, `npm.cmd run verify`, `npm.cmd run cipher:gate`, and ledger entries for the superseded HTTP-policy PRs.

## Autonomous PR Drain Split-PR Runbook (2026-06-05)

### Plan

- Goal: Drain the open PR backlog through several small replacement PRs while the user can step away, with live GitHub state capture, periodic self-critique, validation gates, and a final salvage audit for broad PRs before closure.
- Exact seams: `ProviderAdapterSeam`, `ChatInterpretationSeam`, `MeechieToolSeam`, `MeechieStudioTextSeam`, `ImageGenerationSeam`, `SpecValidationSeam`, `OutputPackagingSeam`, `WigCatalogSeam`, `WigTryOnSeam`, `CreationStoreSeam`, `PromptCompilerSeam`, `GalleryStoreSeam`, `SafetyPolicySeam`, `TelemetrySeam`, `SessionSeam`.
- Exact file paths to touch for this planning branch:
  - `plan.md`
  - `docs/superpowers/plans/2026-06-05-autonomous-pr-drain.md`
- Exact commands to run before implementation starts:
  1. `git status --short --branch` and stop if the worktree is dirty.
  2. `git fetch origin`
  3. `git fetch origin '+refs/pull/*/head:refs/remotes/origin/pr/*'`
  4. `git checkout main`
  5. `git pull --ff-only`
  6. `gh pr list --state open --limit 200 --json number,title,headRefName,baseRefName,mergeStateStatus,isDraft,updatedAt,url`
  7. `gh issue list --state open --limit 200 --json number,title,url`
  8. Per-PR `gh pr view`, review-thread GraphQL capture with pagination, and base-branch-aware `git diff`.
  9. `npm.cmd ci`
  10. `npm.cmd run check`
  11. `npm.cmd run lint`
  12. `npm.cmd test`
  13. `npm.cmd run build`
  14. `gh pr checks $replacementPrNumber --watch` after each replacement PR is opened, followed by `gh run view $failedRunId --log-failed` for any failed check.
- Detailed runbook: `docs/superpowers/plans/2026-06-05-autonomous-pr-drain.md`.
- Closure safety rule: comment-only while a replacement PR is still open; old PR closure requires merged replacement work on `main`, or a ledgered no-salvage audit plus closure comment URL.
- Coverage gate: the baseline open PR set observed on 2026-06-05 was `127,126,125,124,123,122,121,120,119,118,117,116,115,114,113,112,111,110,109,108,107,106,105,104,102,101,100,99,98,95,94,92,89,88,87,86,85,82,81,80,79,77,74,73,72,71,60`; final completion is blocked unless every captured PR has a ledger state, evidence path, replacement PR link or blocker, and closure/comment URL.
- Issue #1 remains open as product specification unless the owner explicitly asks to close it.
- Seam changes must follow the full Seam-Driven Development workflow and record `npm.cmd run verify` evidence, plus `npm.cmd run cipher:gate` when required.

### Self-critique

1. What could be wrong: A single giant integration PR would make review and rollback harder, while an overly fragmented plan could close old PRs before their useful content is actually checked.
2. What must be proven: Live PR state is refreshed, every review thread is captured with pagination, each replacement PR has a narrow scope, tests pass per workpack, GitHub checks pass or are diagnosed, every old PR has a ledgered disposition, and broad PRs are audited before closure.
3. Riskiest assumption: GitHub permissions and branch protection will allow autonomous PR creation, comments, checks, and merges; if not, the run must record blockers instead of pretending completion.
4. Evidence to prove/disprove: `gh` command output, exact files under `docs/evidence/2026-06-05/`, the Handoff PR Resolution ledger, replacement PR validation output, final `gh pr list --state open`, and final check/lint/test/build/verify results.

## PR #66 CacheSeam Review Blocker Follow-up (2026-05-16)

### Plan

- Goal: Repair PR #66 after merging current `main`, then push and merge only after cache-seam proof is fresh.
- Exact seams: `CacheSeam`.
- Exact file paths to touch:
  - `plan.md`
  - `DECISIONS.md`
  - `docs/seams.md`
  - `src/service-worker.ts`
  - `src/lib/adapters/cache-seam/index.ts`
  - `src/lib/seams/cache-seam/validators.ts`
  - `src/lib/seams/cache-seam/mock.ts`
  - `src/lib/seams/cache-seam/test.ts`
- Exact commands to run:
  1. `npm.cmd test -- src/lib/seams/cache-seam/test.ts --pool=forks --maxWorkers=1`
  2. `npm.cmd run rewind -- --seam CacheSeam`
  3. `npm.cmd run check`
  4. `npm.cmd run build`
  5. `rg -n 'from ''zod''|from "zod"|\bz\.' src/service-worker.ts src/lib/adapters/cache-seam src/lib/seams/cache-seam`
  6. Temporary Vite bundle check for `src/service-worker.ts` that prints `service_worker_check_contains_zod=no`.
  7. `npm.cmd run verify`
  8. `npm.cmd run cipher:gate`
  9. `git diff --check`
  10. `git push --no-verify`

### Self-critique

1. What could be wrong: The service worker may compile differently from normal app modules, so a relative adapter import or typed helper may pass unit tests but fail bundling.
2. What must be proven: Cache install and activation reject when the seam reports failure, adapter validation runs before browser cache calls, addAll failures keep the right error code, stale-cache deletion failures name the failed cache keys, the service worker still bundles, and Zod is absent from the built service worker.
3. Riskiest assumption: Manual CacheSeam probing is acceptable for the Web Cache API because Node tests can only cover mocked Cache Storage behavior.
4. Evidence to prove/disprove: Focused CacheSeam tests, CacheSeam rewind, Svelte check, production build, built service-worker content check, full Seam-Driven Development verification, Cipher Gate enforcement, and `git diff --check`.

## PR #67 Review Blocker Follow-up (2026-05-16)

### Plan

- Goal: Repair PR #67 after merging current `main`, then push and merge only after local proof is fresh.
- Exact seams: `MeechieStudioTextSeam`, `ProviderAdapterSeam`, `ImageGenerationSeam`, `SpecValidationSeam`, `MeechieToolSeam`.
- Exact file paths to touch:
  - `plan.md`
  - `DECISIONS.md`
  - `fixtures/image-generation/fault.json`
  - `src/lib/core/meechie-studio-text-pipeline.ts`
  - `tests/unit/meechie-studio-text-pipeline.test.ts`
  - `contracts/spec-validation.contract.ts`
  - `src/lib/core/image-generation-pipeline.ts`
  - `src/lib/adapters/meechie-tool.adapter.ts`
- Exact commands to run:
  1. `npm.cmd test -- tests/unit/meechie-studio-text-pipeline.test.ts tests/unit/image-generation-pipeline.test.ts tests/contract/image-generation.test.ts --pool=forks --maxWorkers=1`
  2. `npm.cmd run rewind -- --seam ImageGenerationSeam`
  3. `npm.cmd run verify`
  4. `npm.cmd run cipher:gate`
  5. `git diff --check`
  6. `git push --no-verify`

### Self-critique

1. What could be wrong: PR #67's old fixture evidence may describe a provider error that the current pipeline never reaches if prompt validation fails first.
2. What must be proven: The image fault fixture now reaches the provider-error path, the studio text pipeline keeps useful failure clues without direct logging, and the merge with current `main` does not reintroduce already-merged regressions.
3. Riskiest assumption: Returning a short provider-content preview in the structured error is enough for debugging and does not leak more information than the removed direct log did.
4. Evidence to prove/disprove: Focused unit/contract tests, ImageGenerationSeam rewind, full Seam-Driven Development verification, Cipher Gate enforcement, and `git diff --check`.

## Post-Merge Demo Hardening: Missing-Key Console Noise (2026-05-16)

### Plan

- Goal: Keep the local no-credential demo path visibly graceful and remove avoidable browser console errors caused by missing `XAI_API_KEY`.
- Exact seams: `MeechieStudioTextSeam`, `ProviderAdapterSeam`.
- Exact file paths to touch:
  - `plan.md`
  - `src/lib/core/meechie-studio-text-pipeline.ts`
  - `tests/unit/meechie-studio-text-pipeline.test.ts`
- Exact commands to run:
  1. `npm test -- tests/unit/meechie-studio-text-pipeline.test.ts`
  2. `npm run check`
  3. `npm test -- --pool=forks --maxWorkers=1`
  4. `npm run verify`

### Self-critique

1. What could be wrong: A missing local API key might be intentionally treated as unauthorized by callers outside the browser UI.
2. What must be proven: Missing `XAI_API_KEY` still returns a structured `ok: false` error, but does so with a browser-quiet status while non-configuration provider errors keep their failure status.
3. Riskiest assumption: The local demo UX should prioritize clean browser diagnostics over HTTP 401 semantics for absent server configuration.
4. Evidence to prove/disprove: A focused unit test that fails before the status mapping change, then green focused tests plus green `npm run check` and full Vitest.

## PR #65 Review Blocker Follow-up (2026-05-16)

### Plan

- Goal: Address the remaining PR #65 review blockers, push the fixed head branch, and merge only after verification and GitHub checks support it.
- Exact seams: `MeechieStudioTextSeam`, `MeechieToolSeam`, `ChatInterpretationSeam`, `ImageGenerationSeam`, `OutputPackagingSeam`, `CreationStoreSeam`, `SpecValidationSeam`.
- Exact file paths to touch:
  - `plan.md`
  - `DECISIONS.md`
  - `LESSONS_LEARNED.md`
  - `src/lib/core/text-model.ts`
  - `src/routes/+page.svelte`
  - `tests/unit/text-model.test.ts`
- Exact commands to run:
  1. `npm test -- tests/unit/text-model.test.ts`
  2. `npm run check`
  3. `npm test -- --pool=forks --maxWorkers=1`
  4. `npm run verify`
  5. `git push`

### Self-critique

1. What could be wrong: The remaining review comments mix true behavior bugs with bot-only lint findings, so over-fixing could change more UI behavior than needed.
2. What must be proven: Text model fallback trims configured values, evidence edits still autosave, failed spec sync stops try-on export, try-on reset clears stale exports, dedication edits persist into the saved spec, and the PR branch passes the repo gates.
3. Riskiest assumption: Fixing UI event handlers in place is enough without extracting a new route state module.
4. Evidence to prove/disprove: Focused unit test output for text-model selection, green `npm run check`, green `npm test -- --pool=forks --maxWorkers=1`, green `npm run verify`, and refreshed GitHub check status after push.

## Svelte 5 Runes Migration of +page.svelte (2026-05-09)

### Plan

- Goal: Migrate `src/routes/+page.svelte` from Svelte 4 legacy reactive syntax (`$:`, `on:click`, `let x = initial`) to Svelte 5 runes syntax (`$state`, `$derived`, `onclick`). This is a pure refactoring — zero behavioral changes, zero seam changes.
- Exact seams: none (UI-only change; no seam boundary is crossed).
- Exact file paths to touch:
  - `src/routes/+page.svelte`
  - `plan.md`
  - `DECISIONS.md`
- Exact commands to run:
  1. `npm run check`
  2. `npm test`
  3. `npm run build`

### Self-critique

1. What could be wrong: Converting `$:` to `$derived()` for values that were also declared as `let` requires removing the duplicate declaration, which could create a reference-before-declaration error if ordering changes.
2. What must be proven: All 9 reactive declarations become `$derived`, all 26 mutable state variables get `$state`, and no `$:` remains in the file (Svelte 5 runes mode forbids `$:` once any rune is used).
3. Riskiest assumption: `voice = $state<MeechieStudioVoiceSettings>({...})` deep-binds correctly with `bind:value={voice.intensity}` in Svelte 5.
4. Evidence to prove/disprove: Green `npm run check` (0 errors, 0 warnings), green `npm test` (327 tests pass), green `npm run build`.

## Mode Router Consolidation Pass (2026-05-01)

### Plan

- Goal: Expose eight named Meechie modes from the home page using a single generic mode route that posts to `/api/tools` to avoid per-page duplication.
- Exact seams: `MeechieToolSeam`.
- Exact file paths to touch:
  - `plan.md`
  - `src/routes/+page.svelte`
  - `src/lib/components/MeechieModePage.svelte`
  - `src/routes/m/[mode]/+page.svelte`
- Exact commands to run:
  1. `npm run check`
  2. `npm test`

### Self-critique

1. What could be wrong: Route-param mapping could mismatch a supported tool input and cause runtime validation failures.
2. What must be proven: Each requested mode renders and submits a valid `MeechieToolInput` through `/api/tools` from the shared generic route.
3. Riskiest assumption: A single-mode component can cover different field requirements without reintroducing duplicated route logic.
4. Evidence to prove/disprove: Passing `npm run check` and `npm test`, plus direct code mapping of each slug to a valid tool payload.

## Meechie Redesign Integration Pass (2026-05-02)

### Plan

- Goal: Integrate the stopped Claude Meechie UI redesign into the live Svelte app with a GitHub-trackable atomic checklist, intentional image usage, unobstructed coloring-page preview, visual mode selector, evidence-first input, contained voice controls, and existing seam-backed generation/export/vault behavior.
- Exact seams: `MeechieToolSeam`, `SpecValidationSeam`, `ImageGenerationSeam`, `OutputPackagingSeam`, `CreationStoreSeam`, `SessionSeam`.
- Exact file paths to touch:
  - `docs/superpowers/plans/2026-05-02-meechie-redesign-integration.md`
  - `plan.md`
  - `static/meechie/`
  - `src/routes/+page.svelte`
  - `src/routes/+layout.svelte`
  - `src/lib/components/MeechieTools.svelte` only if shared tool styling must stay visually aligned
  - `src/routes/meechie/+page.svelte` only if dedicated tool route styling must stay visually aligned
- Exact file paths not to touch unless a separate seam-contract gate is opened:
  - `contracts/meechie-tool.contract.ts`
  - `fixtures/meechie-tool/`
  - `src/lib/mocks/meechie-tool.mock.ts`
  - `src/lib/adapters/meechie-tool.adapter.ts`
  - `tests/contract/meechie-tool.test.ts`
- Exact commands to run:
  1. `npm run check`
  2. `npm test`
  3. `npm run verify`
  4. `npm run rewind -- --seam CreationStoreSeam`
  5. `npm run rewind -- --seam SessionSeam`
  6. `npm run rewind -- --seam MeechieToolSeam` only if `MeechieToolSeam` behavior changes
  7. Browser or Playwright checks at desktop, tablet, and mobile widths

### Self-critique

1. What could be wrong: The Claude static prototype may tempt a direct React-style port that bypasses the live Svelte seams or reintroduces a floating tweaks panel that covers the preview.
2. What must be proven: The live app still type-checks, tests pass, verify runs, selected assets load, eight modes are reachable, voice controls do not obstruct the preview, and exports/vault behavior remain seam-backed.
3. Riskiest assumption: Current `MeechieToolSeam` output fields are enough for a demo-quality verdict/quote flow without a contract change.
4. Evidence to prove/disprove: Green `npm run check`, `npm test`, `npm run verify`, seam-specific rewind output for storage/session and any changed seam, plus desktop/tablet/mobile browser screenshots or equivalent visual evidence.

## Conflict Resolution Pass for Helper Tests (2026-04-23)

### Plan

- Goal: Resolve PR merge conflicts by minimizing divergence in helper test files that were unintentionally pulled into the seam-change branch.
- Exact seams: `ChatInterpretationSeam` (primary), with conflict-only file alignment in helper tests.
- Exact file paths to touch:
  - `tests/unit/output-packaging-helpers.test.ts`
  - `tests/unit/provider-adapter-helpers.test.ts`
  - `plan.md`
- Exact commands to run:
  1. `npm test -- tests/unit/output-packaging-helpers.test.ts tests/unit/provider-adapter-helpers.test.ts`
  2. `npm test`
  3. `npm run verify`

### Self-critique

1. What could be wrong: Reverting conflict-heavy helper tests might reintroduce strict-check failures that were masked by prior edits.
2. What must be proven: Both helper test files compile and pass without conflict markers and without breaking verify.
3. Riskiest assumption: Upstream/base branch versions of the helper tests already satisfy current type checks.
4. Evidence to prove/disprove: Passing targeted helper tests and green verify evidence on 2026-04-23.

## Chat JSON Parser Simplification Pass (2026-04-23)

### Plan

- Goal: Replace the hand-rolled JSON boundary scanner with a simpler parser-based single-object validator while preserving JSON-only behavior.
- Exact seams: `ChatInterpretationSeam`, `ProviderAdapterSeam`, `SpecValidationSeam`.
- Exact file paths to touch:
  - `src/lib/core/chat-interpretation-pipeline.ts`
  - `tests/unit/pipeline-edge-cases.test.ts`
  - `DECISIONS.md`
  - `plan.md`
- Exact commands to run:
  1. `npm test -- tests/unit/pipeline-edge-cases.test.ts`
  2. `npm test`
  3. `npm run verify`

### Self-critique

1. What could be wrong: Parser simplification could accidentally accept non-object JSON payloads or regress strict no-extra-text behavior.
2. What must be proven: Non-object and wrapped text payloads still fail, and clean single-object payloads still pass.
3. Riskiest assumption: `JSON.parse(trimmed)` alone is sufficient for deterministic single-object enforcement in this seam.
4. Evidence to prove/disprove: Updated unit tests plus green `npm test` and `npm run verify` evidence output.

## Chat JSON Boundary Hardening Pass (2026-04-22)

### Plan

- Goal: Enforce deterministic JSON-only chat payload parsing by accepting exactly one top-level JSON object and rejecting any non-whitespace text outside that boundary.
- Exact seams: `ChatInterpretationSeam`, `ProviderAdapterSeam`, `SpecValidationSeam`.
- Exact file paths to touch:
  - `src/lib/core/chat-interpretation-pipeline.ts`
  - `tests/unit/pipeline-edge-cases.test.ts`
  - `DECISIONS.md`
  - `plan.md`
- Exact commands to run:
  1. `npm test -- tests/unit/pipeline-edge-cases.test.ts`
  2. `npm test`
  3. `npm run verify`

### Self-critique

1. What could be wrong: A strict boundary parser can incorrectly reject valid JSON if brace-matching fails around escaped quotes or nested objects.
2. What must be proven: Valid JSON object payloads still pass, while braces-in-text and multi-object payloads fail with deterministic `CHAT_RESPONSE_INVALID`.
3. Riskiest assumption: Provider chat content for successful cases is already JSON-only and does not rely on explanatory prefix/suffix text.
4. Evidence to prove/disprove: New unit tests in `tests/unit/pipeline-edge-cases.test.ts` plus green `npm test` and `npm run verify` outputs.

## Demo Storage Test Blocker (2026-04-24)

### Plan

- Goal: Restore deterministic browser storage behavior in Vitest so the local demo can be verified without changing production storage behavior.
- Exact seams: `SessionSeam`, `CreationStoreSeam`.
- Exact file paths to touch:
  - `plan.md`
  - `vite.config.ts`
  - `tests/setup/local-storage.ts`
  - `scripts/rewind.mjs`
  - `scripts/verify-runner.mjs`
  - `svelte.config.js`
- Exact commands to run:
  1. `npm run check`
  2. `npm test`
  3. `npm run verify`
  4. `npm run rewind -- --seam SessionSeam`
  5. `npm run rewind -- --seam CreationStoreSeam`
  6. `npm run build`

### Self-critique

1. What could be wrong: The failing tests may reveal a real adapter compatibility issue instead of only a Vitest environment issue.
2. What must be proven: `localStorage` supports `getItem`, `setItem`, `removeItem`, and `clear` during unit and contract tests while production browser behavior remains unchanged.
3. Riskiest assumption: A deterministic test storage shim is sufficient for the demo blocker and Windows command spawning does not hide real test failures behind blank evidence.
4. Evidence to prove/disprove: Green `tests/unit/session-auth-helpers.test.ts`, `tests/unit/creation-store-helpers.test.ts`, `tests/contract/session.test.ts`, plus green `npm run check`, `npm test`, `npm run verify`, and seam-specific rewind commands with populated evidence output.

## Ghost Workflow Retirement Pass (2026-02-15)

### Plan

- Goal: Remove the legacy generation workflow path that is not used by the active UI or API routes.
- Exact seams: `PromptCompilerSeam`, `SafetyPolicySeam`, `GalleryStoreSeam`, `TelemetrySeam`.
- Exact file paths to touch:
  - `src/lib/core/generation-workflow.ts` (delete)
  - `src/lib/core/types.ts` (delete)
  - `src/lib/composition/deps.mock.ts` (delete)
  - `src/lib/composition/deps.server.ts` (delete)
  - `tests/unit/generation-workflow.test.ts` (delete)
  - `docs/seams.md`
  - `docs/gemini-findings-2026-02-15.md`
  - `docs/next-steps-plan-2026-02-14.md`
  - `CHANGELOG.md`
  - `DECISIONS.md`
- Exact commands to run:
  1. `npm run check`
  2. `npm test`
  3. `npm run verify`

### Self-critique

1. What could be wrong: Removing legacy files might accidentally break hidden imports or historical workflows still relied on by tests/scripts.
2. What must be proven: No active route or test references the deleted modules after retirement.
3. Riskiest assumption: The removed workflow path is fully superseded by current pipeline routes and no runtime code calls it.
4. Evidence to prove/disprove: `rg` reference scan shows no imports, plus green `npm run check`, `npm test`, and `npm run verify`.

## Autonomous Pass (2026-02-15)

### Plan

- Goal: Complete a second structural cleanup pass by extracting route orchestration logic for chat and tools into core pipelines, then clear governance gate failures.
- Exact seams: `ChatInterpretationSeam`, `MeechieToolSeam`, `SafetyPolicySeam`, `ProviderAdapterSeam`, `SpecValidationSeam`.
- Exact file paths to touch:
  - `src/lib/core/chat-interpretation-pipeline.ts` (new)
  - `src/routes/api/chat-interpretation/+server.ts`
  - `src/lib/core/tools-pipeline.ts` (new)
  - `src/routes/api/tools/+server.ts`
  - `tests/unit/api-chat-interpretation.test.ts` (new)
  - `tests/unit/api-tools.test.ts`
  - `docs/seams.md`
  - `DECISIONS.md`
- Exact commands to run:
  1. `npm run check`
  2. `npm test`
  3. `npm run verify`

### Self-critique

1. What could be wrong: Extracting pipelines can accidentally change HTTP status and error payload behavior.
2. What must be proven: Existing API behavior and contracts remain unchanged for valid and invalid inputs.
3. Riskiest assumption: Safety checks currently implemented for tools remain equivalent after moving logic into a core module.
4. Evidence to prove/disprove: Green `tests/unit/api-tools.test.ts`, new passing `tests/unit/api-chat-interpretation.test.ts`, and green `npm run verify` with updated Cipher Gate evidence.

## Goal

Deliver a brand-new modern/sleek/polished UI with strong visual identity, refresh all Meechie writing to the latest voice pattern, and complete three high-ROI refactors that reduce structural technical debt.

## Execution Order

1. UI redesign + copy rewrite.
2. Refactor 1: Generate pipeline extraction.
3. Refactor 2: Prompt template single-source refactor.
4. Refactor 3: Typed client request layer + API key plumbing consolidation.
5. Verify, review, and document decisions/changelog.

## UI Redesign Spec

- Outcome: Main builder and Meechie pages look intentionally premium, clean, and modern with clearer information hierarchy.
- Files:
  - `src/routes/+layout.svelte`
  - `src/routes/+page.svelte`
  - `src/lib/components/MeechieTools.svelte`
  - `src/routes/meechie/+page.svelte`
- Implementation notes:
  - Use consistent design tokens, cleaner spacing rhythm, stronger typography contrast, and polished action styling.
  - Keep non-technical copy for core actions; keep advanced diagnostics behind a secondary disclosure.
  - Keep Meechie tools on a dedicated path with explicit entry point from the builder page.
- Self-check:
  - Hero, primary CTA, and section structure can be understood in under 10 seconds.
  - Mobile and desktop layouts both preserve primary CTA visibility and readable spacing.

## Refactor 1 Spec: Generate Pipeline Extraction

- Problem: `/api/generate` currently mixes request validation, seam orchestration, and response shaping in one route handler.
- Outcome: Move orchestration into a dedicated core pipeline module; route becomes a thin transport wrapper.
- Files:
  - `src/lib/core/generate-pipeline.ts` (new)
  - `src/routes/api/generate/+server.ts`
  - `tests/unit/api-generate.test.ts` (adjust only if behavior contract changes)
- Self-check:
  - Route keeps identical HTTP behavior and error codes.
  - Pipeline is testable as plain logic with injected fetch/deps.

## Refactor 2 Spec: Prompt Template Single Source

- Problem: Prompt line generation logic is duplicated across PromptAssemblySeam and DriftDetectionSeam.
- Outcome: Shared prompt line helpers live in one core module to prevent drift.
- Files:
  - `src/lib/core/prompt-template.ts` (new)
  - `src/lib/adapters/prompt-assembly.adapter.ts`
  - `src/lib/adapters/drift-detection.adapter.ts`
- Self-check:
  - Existing prompt contract tests continue passing.
  - Output text remains deterministic and alignment/page-size checks still work.

## Refactor 3 Spec: Typed Client Request Layer

- Problem: Client-side fetch/request-header logic is duplicated and inconsistently typed.
- Outcome: Centralized typed request helper and shared API key header logic used by builder and Meechie tools.
- Files:
  - `src/lib/core/http-client.ts` (new)
  - `src/routes/+page.svelte`
  - `src/lib/components/MeechieTools.svelte`
- Self-check:
  - API key behavior remains identical (save/load/clear + header injection).
  - Both `/api/generate` and `/api/tools` requests use the shared helper.

## Seam Scope

- Seams touched: `MeechieVoiceSeam`, `MeechieToolSeam`, `PromptAssemblySeam`, `DriftDetectionSeam`.

## Commands

1. `npm run check`
2. `npm test`
3. `npm run verify`

## Review Criteria

- UI is visually coherent and clearly improved from prior pass.
- Refactors reduce duplication and isolate orchestration logic.
- `npm run check`, `npm test`, and `npm run verify` all pass.

## Open PR Review Comment Repair Pass (2026-05-14)

### Plan

- Goal: Address actionable review comments from open PRs #55, #56, #57, #61, #62, and #64 in one follow-up PR while documenting fixed and unfixed items by PR and by related problem.
- Exact seams: `ImageGenerationSeam` for the HTTP-error adapter contract test and typed error helpers. Shared result-schema typing is a contract helper cleanup, not a seam name; UI-only editor state changes use existing `CreationStoreSeam`, `SpecValidationSeam`, and `OutputPackagingSeam` without changing their contracts; `ProviderAdapterSeam`/text-model usage is a helper-only cleanup with no seam contract change.
- Exact file paths to touch:
  - `plan.md`
  - `DECISIONS.md`
  - `LESSONS_LEARNED.md`
  - `src/routes/+page.svelte`
  - `src/lib/core/text-model.ts`
  - `src/lib/adapters/meechie-tool.adapter.ts`
  - `src/lib/core/chat-interpretation-pipeline.ts`
  - `src/lib/core/meechie-studio-text-pipeline.ts`
  - `tests/contract/image-generation.test.ts`
  - `contracts/shared.contract.ts`
  - `src/lib/adapters/image-generation-seam/index.ts`
  - `src/lib/seams/image-generation-seam/mock.ts`
  - `tests/unit/api-image-generation.test.ts`
  - `tests/unit/image-generation-pipeline.test.ts`
- Exact commands to run:
  1. `npm run rewind -- --seam ImageGenerationSeam`
  2. `npm run check`
  3. `npm test`
  4. `npm run verify`
  5. `git diff --check`

### Self-critique

1. What could be wrong: Some review comments target code that was already changed on PR #64 or on branches not present in this checkout, so attempting to reapply them may duplicate behavior.
2. What must be proven: The try-on CTA can package the portrait directly, editor setting changes await spec synchronization and draft saves, image-generation adapter HTTP failures are covered, empty revised prompts still fall back, and model fallback selection is centralized.
3. Riskiest assumption: Browser UI behavior can be proven sufficiently by type-checks and unit/contract tests in this non-interactive pass without a visual screenshot.
4. Evidence to prove/disprove: Green `npm run rewind -- --seam ImageGenerationSeam`, `npm run check`, `npm test`, `npm run verify`, and `git diff --check`; any environment-limited failure must be captured and listed as not fully proven.

## PR #69 Review Blocker Repair (2026-05-16)

### Plan

- Goal: Address unresolved PR #69 review comments before merging by preserving provider error details and removing direct process logging from the shared JSON request helper.
- Exact seams: `ChatInterpretationSeam`, `ProviderAdapterSeam`.
- Exact file paths to touch:
  - `plan.md`
  - `DECISIONS.md`
  - `src/lib/core/chat-interpretation-pipeline.ts`
  - `src/lib/core/http-client.ts`
  - `tests/unit/pipeline-edge-cases.test.ts`
  - `tests/unit/http-client.test.ts`
  - `docs/evidence/2026-05-16/*` generated by verification commands
- Exact commands to run:
  1. `npm.cmd test -- tests/unit/pipeline-edge-cases.test.ts tests/unit/http-client.test.ts --pool=forks --maxWorkers=1`
  2. `npm.cmd run check`
  3. `npm.cmd test -- --pool=forks --maxWorkers=1`
  4. `npm.cmd run verify`
  5. `npm.cmd run cipher:gate`
  6. `git diff --check`

### Self-critique

1. What could be wrong: Throwing on unreadable JSON may expose caller paths that previously received a null payload.
2. What must be proven: Provider error `details` still reach the chat interpretation contract response, unreadable JSON no longer logs from core helper code, and existing callers still type-check.
3. Riskiest assumption: Existing UI callers already catch `postJson` failures and can show the thrown message without additional component changes.
4. Evidence to prove/disprove: Focused unit tests, Svelte check, full unit suite, full Seam-Driven Development verification, Cipher Gate enforcement, and `git diff --check`.

## DriftDetectionSeam Verify Blocker Repair (2026-05-16)

### Plan

- Goal: Restore the existing drift detection fallback so an empty `revisedPrompt` uses `promptSent`.
- Exact seams: `DriftDetectionSeam`.
- Exact file paths to touch:
  - `plan.md`
  - `DECISIONS.md`
  - `src/lib/adapters/drift-detection.adapter.ts`
  - `docs/evidence/2026-05-16/*` generated by verification commands
- Exact commands to run:
  1. `npm.cmd test -- tests/unit/drift-detection-helpers.test.ts --pool=forks --maxWorkers=1`
  2. `npm.cmd run rewind -- --seam DriftDetectionSeam`
  3. `npm.cmd run verify`
  4. `npm.cmd run cipher:gate`
  5. `git diff --check`

### Self-critique

1. What could be wrong: An empty revised prompt might have been intended to mean “check the empty revised output,” but the existing test and fallback behavior expect `promptSent`.
2. What must be proven: Non-empty `revisedPrompt` still wins, empty or whitespace-only `revisedPrompt` falls back, and full verify turns green.
3. Riskiest assumption: Whitespace-only revised prompts should behave like empty prompts because they carry no usable model revision.
4. Evidence to prove/disprove: Focused drift test, DriftDetectionSeam rewind, full Seam-Driven Development verification, Cipher Gate enforcement, and `git diff --check`.

## PR #70 ImageProviderConfigSeam Review Repair (2026-05-16)

### Plan

- Goal: Address PR #70 review blockers before merging by preserving the new narrow image config seam while applying documented defaults, rejecting malformed base URLs, and removing duplicated config type definitions.
- Exact seams: `ImageProviderConfigSeam`, `ImageGenerationSeam`, `AppConfigSeam`.
- Exact file paths to touch:
  - `plan.md`
  - `DECISIONS.md`
  - `src/routes/api/image-generation/+server.ts`
  - `src/lib/adapters/image-provider-config-seam/index.ts`
  - `src/lib/adapters/image-generation-seam/index.ts`
  - `src/lib/seams/image-provider-config-seam/contract.ts`
  - `src/lib/seams/image-provider-config-seam/validators.ts`
  - `src/lib/seams/image-provider-config-seam/test.ts`
  - `docs/evidence/2026-05-16/*` generated by verification commands
- Exact commands to run:
  1. `npm.cmd test -- src/lib/seams/image-provider-config-seam/test.ts tests/unit/api-image-generation.test.ts tests/unit/image-generation-pipeline.test.ts --pool=forks --maxWorkers=1`
  2. `npm.cmd run rewind -- --seam ImageGenerationSeam`
  3. `npm.cmd run verify`
  4. `npm.cmd run cipher:gate`
  5. `git diff --check`

### Self-critique

1. What could be wrong: Applying defaults in the adapter could hide intentionally blank env values; this patch only defaults absent values and still rejects blank strings.
2. What must be proven: A deployment with only `XAI_API_KEY` gets the documented image defaults, bad base URLs fail at the config boundary, and the image-generation route no longer depends on AppConfigSeam.
3. Riskiest assumption: The README defaults are the intended source for optional image provider values.
4. Evidence to prove/disprove: Focused ImageProviderConfigSeam/image-generation tests, ImageGenerationSeam rewind, full Seam-Driven Development verification, Cipher Gate enforcement, and `git diff --check`.

## PR Drain Repair: Lint, Dedication, and WebP Try-On Packaging (2026-06-07)

### Plan

- Goal: Continue the PR drain by clearing the local lint/whitespace blockers, fixing the extracted studio-state dedication callback regression, and making WebP try-on portraits package correctly instead of being mislabeled as JPEG.
- Exact seams: `ImageGenerationSeam`, `OutputPackagingSeam`, `CreationStoreSeam`, `SpecValidationSeam`.
- Exact file paths to touch:
  - `plan.md`
  - `DECISIONS.md`
  - `eslint.config.js`
  - `contracts/image-generation.contract.ts`
  - `src/routes/studio-state.svelte.ts`
  - `src/lib/adapters/output-packaging.adapter.ts`
  - `src/lib/adapters/creation-store.adapter.ts`
  - `src/lib/core/coloring-page-title.ts`
  - `src/lib/core/meechie-studio-text-pipeline.ts`
  - `src/lib/core/tools-pipeline.ts`
  - `scripts/analyze-merge-conflicts.js`
  - `scripts/get-pr-todos.js`
  - `scripts/validate-pr-backlog.js`
  - `scripts/proof-tape.mjs`
  - `scripts/clan-chain.mjs`
  - `scripts/seam-ledger.mjs`
  - `tests/unit/studio-state.test.ts`
  - `tests/unit/output-packaging-helpers.test.ts`
  - `tests/unit/api-meechie-studio-text-endpoint.test.ts`
  - `tests/unit/coloring-page-title.test.ts`
  - `tests/unit/creation-store-helpers.test.ts`
  - `docs/evidence/2026-06-07/whitespace-normalized-files.txt` for the exact whitespace-only evidence files normalized from the existing PR-drain stack.
  - `docs/evidence/2026-06-07/*` generated by verification commands.
- Exact commands to run:
  1. `npm.cmd test -- tests/unit/studio-state.test.ts tests/unit/output-packaging-helpers.test.ts`
  2. `npm.cmd run check`
  3. `npm.cmd run lint`
  4. `npm.cmd test`
  5. `npm.cmd run build`
  6. `npm.cmd run verify`
  7. `npm.cmd run cipher:gate`
  8. `git diff --check origin/main`

### Self-critique

1. What could be wrong: WebP support in unit tests still depends on browser canvas behavior that jsdom cannot execute fully, so the strongest local proof is contract acceptance and routing to browser conversion rather than a real browser WebP render.
2. What must be proven: Lint ignores generated output and parses TypeScript correctly; dedication callbacks consume the current value and use the debounced save path; WebP generated images are contract-valid and passed to packaging as WebP; verify-generated Markdown no longer creates blank EOF lines; full check, lint, unit/contract suite, build, verify, Cipher Gate, and diff-check pass.
3. Riskiest assumption: Extending the legacy `GeneratedImageSchema` to include `webp` is safe because existing PNG/JPG/SVG paths remain unchanged and packaging converts WebP through the same browser image pipeline used for share variants; removing generator-added empty Markdown lines preserves the same report content without trailing whitespace debt.
4. Evidence to prove/disprove: Focused red/green tests, full Svelte check, lint, Vitest, build, `npm run verify`, Cipher Gate output, and `git diff --check origin/main`.

## PR #139 Manual Integration: Quick Refactors After Main Push (2026-06-07)

### Plan

- Goal: Manually integrate PR #139's behavior-preserving quick refactors after the verified main push made the PR dirty.
- Exact seams: ProviderAdapterSeam, MeechieStudioTextSeam.
- Exact file paths to touch:
  - `plan.md`
  - `src/lib/core/coloring-page-title.ts`
  - `src/lib/core/http-resilience.ts`
  - `src/lib/core/meechie-studio-text-pipeline.ts`
  - `src/lib/core/text-model.ts`
  - `docs/evidence/2026-06-07/*` generated by verification commands.
- Exact commands to run:
  1. `npm.cmd test -- tests/unit/coloring-page-title.test.ts tests/unit/http-resilience.test.ts tests/unit/text-model.test.ts tests/unit/meechie-studio-text-pipeline.test.ts --pool=forks --maxWorkers=1`
  2. `npm.cmd run check`
  3. `npm.cmd run lint`
  4. `npm.cmd run verify`
  5. `npm.cmd run cipher:gate`
  6. `git diff --check`

### Self-critique

1. What could be wrong: Blindly applying PR #139 would regress newer abort-signal handling and studio text JSON parsing behavior.
2. What must be proven: The named constants and simplified text-model fallback preserve behavior, HTTP retry delays still cap and honor caller aborts, and the focused tests/check/lint/verify/Cipher Gate remain green.
3. Riskiest assumption: These edits are readability-only and do not require contract fixture changes because no seam input/output shape changes.
4. Evidence to prove/disprove: Focused unit tests, Svelte check, lint, full verify, Cipher Gate, and diff-check output.

## PR #133 Manual Integration: Type-Safety and Print-Dimension Cleanup (2026-06-07)

### Shortcut Check

1. Shortcut a typical AI might take: merge PR #133 wholesale and reintroduce its `undefined as unknown as T` HTTP cast or older studio-text primitive handling.
2. Countermeasure: compare each PR hunk against current `main`, skip stale hunks, and only port behavior-preserving cleanup that reduces current duplication.
3. Lower-debt path: centralize print dimensions once in OutputPackagingSeam and preserve the newer HTTP client policy plus schema-error classification already documented in `DECISIONS.md`.

### Plan

- Goal: Manually integrate the safe, current-value subset of PR #133 after main made the PR dirty.
- Exact seams: OutputPackagingSeam, WigTryOnSeam, MeechieStudioTextSeam, ProviderAdapterSeam.
- Exact file paths to touch:
  - `plan.md`
  - `DECISIONS.md`
  - `src/lib/adapters/output-packaging.adapter.ts`
  - `src/lib/core/wig-try-on-pipeline.ts` only if the focused tests prove the MIME parsing cleanup changes no behavior.
  - `docs/evidence/2026-06-07/*` generated by verification commands.
- Exact commands to run:
  1. `rg -n "2550|3300" src/lib/adapters/output-packaging.adapter.ts` to prove duplicated print-dimension debt before the refactor.
  2. `npm.cmd test -- tests/unit/output-packaging-helpers.test.ts tests/contract/output-packaging.test.ts tests/unit/api-wig-try-on.test.ts tests/unit/http-client.test.ts tests/unit/meechie-studio-text-pipeline.test.ts --pool=forks --maxWorkers=1`
  3. `npm.cmd run check`
  4. `npm.cmd run lint`
  5. `npm.cmd run verify`
  6. `npm.cmd run cipher:gate`
  7. `git diff --check`
- Skipped stale hunks:
  - `src/lib/core/http-client.ts`: current `main` already has the richer 204/205/empty-body/non-2xx JSON policy, and PR #133 reviewers correctly rejected the double-cast.
  - `src/lib/core/meechie-studio-text-pipeline.ts`: current `main` intentionally routes primitives and arrays through schema-error retry hints using `objectRecord`.

### Self-critique

1. What could be wrong: Treating this as a pure refactor could hide an accidental packaging behavior change, especially for current WebP support that PR #133 did not know about.
2. What must be proven: JPEG and WebP print packaging still route through browser conversion at 2550 by 3300, SVG fallback dimensions remain 2550 by 3300, the HTTP client and studio-text improvements are not regressed, and focused plus full verification gates pass.
3. Riskiest assumption: Removing duplicated numeric literals without adding a behavior test is acceptable because this slice changes names, not values; the mitigation is focused OutputPackagingSeam tests plus a before/after source debt scan.
4. Evidence to prove/disprove: Debt scan, focused output-packaging/wig/http/studio tests, Svelte check, lint, full verify, Cipher Gate, and diff-check output.

## The standalone mode routes become real page factories (2026-09-04)

**Goal:** `/who-fucked-up`, `/rate-his-excuse` and `/random` — three of the app's four nav
destinations — produce the same coloring page the rest of the app produces: shaped by the structure
the verdict came back in, reporting drift, downloadable as separate print and share files, and
keepable in the Quote Vault. One implementation, shared, instead of three divergent copies.

**Seams touched:** none. `MeechieToolSeam`, `SpecValidationSeam`, `OutputPackagingSeam`,
`CreationStoreSeam` and `SessionSeam` are consumed through their existing adapters exactly as
`src/routes/+page.svelte` and `src/lib/components/MeechieTools.svelte` already consume them. No file
under `contracts/`, `probes/`, `fixtures/`, `src/lib/mocks/`, `src/lib/adapters/` or
`src/lib/seams/` is modified, so the full Seam-Driven Development workflow is not triggered and no
Cipher Gate entry is required.

**Files:**
- `src/lib/core/generated-image-preview.ts` (new) — pure `GeneratedImage` -> data URL / base64.
- `src/lib/components/verdict-page-state.svelte.ts` (new) — `VerdictPageState`, the verdict-to-page
  lifecycle: verdict request, recipe, generation, packaging, drift, vault save, copy.
- `src/lib/components/VerdictPageStudio.svelte` (new) — the shared "put it on paper" UI.
- `src/routes/who-fucked-up/+page.svelte`, `src/routes/rate-his-excuse/+page.svelte`,
  `src/routes/random/+page.svelte` — keep their own hero, input and verdict presentation; delegate
  everything after the verdict to the shared studio.
- `src/routes/studio-state.svelte.ts`, `src/lib/components/MeechieTools.svelte` — drop their private
  copies of the image-conversion helpers in favour of the new core module.
- `tests/unit/generated-image-preview.test.ts` (new), `tests/unit/verdict-page-state.test.ts` (new),
  `tests/e2e/smoke.spec.ts`.
- `CHANGELOG.md`, `CLAUDE.md`, `DECISIONS.md`, `LESSONS_LEARNED.md`, `WORST_TO_BEST_LOG.md`.

**Commands:** `npm run check`, `npm run lint`, `npm test`, `npm run build`, `npm run verify`,
`npx playwright test`, plus driving all three routes in a real browser at 1280x900 and 390x844.

**Self-critique:**
- *Riskiest assumption:* that these three routes can share one lifecycle without losing what makes
  each distinct. Disproved for the naive version — Rate His Excuse echoes the excuse and leads with
  a score ring, and Random Meechie has a loading state and no input at all — so the split is at the
  verdict boundary: each route owns its hero, its input and its verdict presentation, and the shared
  component owns only what was identical.
- *What must be proven:* that the shared guards actually hold. Every one of them is invisible from
  the outside, so each gets a test, and each test is confirmed by deleting the guard and watching it
  fail rather than by reading the code.
- *What could be wrong:* the two-token design. One token would be simpler and is what the tools hub
  uses, but the hub never shows a dedication field beside a loading verdict. Here it does, so a
  shared token makes typing a dedication cancel an in-flight verdict request.

