# Handoff — Meechie canon + rebuild

Written 2026-08-25. Previous session hit context limits. Read this first.

---

## 1. THE CANON — 10 lines, ruled by the owner, wording is final

Do NOT reword, recapitalize, or "fix" any of these. The wording IS the line.
Live at `src/lib/seams/meechie-voice-seam/voice-pack.ts` as `MEECHIE_LINES`.

| # | id | line |
|---|---|---|
| 1 | `edges` | If a bitch ain't got no edges, she ain't got no sense. |
| 2 | `stepmama-short` | Keep fucking with me and I'ma end up being your stepmama. |
| 3 | `stepmama-long` | So I told him if he didn't quit fucking with that bitch I was gonna fuck his brother. He tried to come at me all crazy. I told him he got off lucky. If he talks to her again I'ma fuck his daddy and he'll be calling me stepmama. |
| 4 | `biggest-in-the-house` | The biggest nigga in this whole house, the one y'all scared of... he's running from me. So I just did whatever the fuck I wanted. |
| 5 | `baby-dad` | she mad because i tricked with her baby dad while she was in jail....but i'll beat her ass. and she know it. that was my boyfriend when i was 15, i don't give a fuck |
| 6 | `area-of-control` | All I need to be a hoe is an area of control. |
| 7 | `stole-something` | People say you can tell if someone stole something by whether they're willing to fight over it. That's not true. I beat up plenty of bitches over their own shit. |
| 8 | `my-shadow` | As long as I'm alive, you bitches will have a place to live. Right here in my shadow. |
| 9 | `landlord` | You should have fucked the landlord, not the dopeman. |
| 10 | `the-door` | Don't open the door. Not even a little bit. Cause if you open the door even a little bit, I'm coming through. |

Owner edits already applied — do not revert:
- #9 is **"You should have"**, not "Should've". Owner changed it.
- #10 is **"Cause"**, not "Because". Owner chose this.
- #5 is stored **exactly as typed** — lowercase, four dots. Intentional.

`#10 the-door` is the only line with no profanity, which makes it the only one
usable as visible placeholder copy.

**These lines are prompt examples only.** They go into the xAI system prompt to
teach the voice. They are never shown to a user and never printed on a page.

There is no `tier` field any more. `MeechieQuoteSchema` is `{ id, text }`, `.strict()`.
82 stored entries were cut down to these 10 across PRs #227 and #230.

---

## 2. WHAT THE OWNER WANTS BUILT (not started yet)

The actual ask, from the top of the session. **None of this is done.**

- One flow: user types a **situation** → hits generate → gets a **Meechie quote**
- Then turn that into a **printable coloring page** (keep the existing ColoringPageSpec)
- **Keep xAI** for both text and image
- **Leave the wigs out** — drop the whole wig try-on feature
- **Base theme only** — no theme picker, keep the dark-glam look
- Owner said "lets work on the current repo for a bit" (was going to be a new repo)

On architecture, owner asked: "is there a way to keep the best parts of seam driven
development without it being so cumbersome?" Answer given and accepted implicitly:
keep typed boundaries + offline mocks + one-file-per-dependency; drop the ceremony
(8 verify scripts, Cipher Gate entries, evidence freshness rules, 6-file seams).
Rule of thumb offered: something is a seam only if it crosses a process boundary
(network, disk, clock, randomness, browser storage).

**Features to strip in the rebuild:** wig try-on (+ catalog, selfie upload), the
11-tool Meechie toolkit at `/meechie`, the 8-mode rotation, standalone mode pages
(`/random`, `/who-fucked-up`, `/rate-his-excuse`, `/m/[mode]`), themes, voice sliders.

### THE PROMPT ALSO SHIPS SIX ANTI-EXAMPLES — keep them

`tone.donts` in `voice-pack.ts` holds six lines fed to the model under
"NEVER DO THIS". They are NOT Meechie quotes — they are therapy-speak
counter-examples that keep the model out of empowerment-poster voice:

  "You deserve someone who chooses you every single day."
  "I blocked him and started my healing journey."
  "Real love doesn't make you question your worth."
  "My therapist says I need to stop dimming my light for people."
  "I'm in my unbothered era and I'm not looking back."
  "She's not the problem. He just wasn't ready for her."

`tone.dos` is now EMPTY (four of its six lines were promoted into the canon,
two were cut), so the prompt no longer emits a "RULES:" section.
`tone.samples` is DERIVED from the same array as `responses.quotes` — they
cannot drift apart. Do not reintroduce a second hand-maintained list.

---

## 2b. REBUILD INVENTORY — what exists today, what to keep, what to cut

Derived by reading the whole app at the start of the session. This is the input
to the rebuild in §2; without it the next session has to re-derive it.

### KEEP
- `ColoringPageSpec` (`contracts/spec-validation.contract.ts`) — title, numbered
  items (max 20, labels max 40 chars, charset-restricted), optional footerItem,
  optional dedication (max 60), listMode list|title_only, alignment, whitespace,
  text size/font/stroke, colorMode, decorations, illustrations, shading, border
  + thickness, variations 1-4, outputFormat png|pdf, pageSize US_Letter|A4.
  Owner said "generate coloring pages with the current spec" — this is it.
- `/api/generate` -> `generate-pipeline.ts` (validation -> prompt -> image ->
  drift -> packaging). The real generate path.
- `/api/meechie-studio-text` -> `meechie-studio-text-pipeline.ts`. The PRIMARY
  text flow. Its `MEECHIE_SYSTEM_PROMPT` interpolates VOICE_EXAMPLES from the
  voice pack — this is the thing the canon actually feeds.
- Output packaging (`output-packaging.adapter.ts`) — PDF via pdf-lib, PNG,
  square/chat share variants. PDF download is the deliverable.
- PWA manifest, icons, service worker (offline caching).
- Anonymous per-device session + draft autosave, IF the vault survives.

### CUT (owner said wigs out; toolkit/modes are not in the asked-for flow)
- Wig try-on end to end: `/api/wig-try-on`, `wig-try-on-pipeline.ts`,
  `wig-catalog-seam/`, `wig-try-on-seam/`, adapters for both,
  `WigCarousel.svelte`, `SelfieUpload.svelte`, `WigTryOnStudio.svelte`,
  `src/lib/data/wigs.json`, `static/wigs/*`, `selfie-upload.ts`.
  Note: this is the ONLY Gemini dependency in the app — cutting it removes
  `GEMINI_API_KEY` entirely.
- Meechie toolkit: `/meechie` route, `MeechieTools.svelte`, `/api/tools`,
  `tools-pipeline.ts`, `meechie-tool-seam/` + both tool adapters, and the
  11 tools (apology_translator, red_flag_or_run, wwmd, lineup, horoscope,
  receipts, caption_this, clapback, meechie_explains, rate_excuse,
  random_meechie).
- Mode system: `studioModes` (8 modes), weekly/monthly rotation helpers,
  `/m/[mode]` route + `meechie-mode-config.ts`, `MeechieModePage.svelte`, and
  standalone pages `/random`, `/who-fucked-up`, `/rate-his-excuse`.
- `studioThemes` (8 themes) + the theme picker. Owner wants base theme only.
- Voice sliders (intensity / rawness / thirdPerson) unless owner asks to keep.

### ALREADY DEAD — do not resurrect
- `/api/chat-interpretation` + adapter: fully built, no UI calls it.
- `gallery-store-seam`, `telemetry-seam`: contracts/mocks only, no consumers.
- Chat-sized share export: implemented in packaging, never requested by any UI.

### DECIDE WITH THE OWNER
- The Quote Vault (save/load/pin/delete creations). Not mentioned in the
  rebuild ask. It is real user-facing value and it is also scope.
- The revision budget (3 AI text actions per page).

---

## 3. REPO STATE

- Branch `claude/app-features-inventory-hrticr`, head `12baead`, **working tree clean**
- `origin/main` at `b8de819`
- **PR #227 — MERGED.** Cut the voice to 20 lines, killed 3 drifted lists.
- **PR #230 — OPEN, all 10 checks green, mergeable_state clean.** Cuts to the 10 above.

### PR #230 has FIVE OPEN REVIEW THREADS — all replied to, none resolved

The previous session fixed all five in commit `12baead` but did NOT reply to the
threads. Owner was asked whether to continue and had not answered. **Do not assume
these are safe to ignore** — every prior round of these found something real.

Fixed but unreplied, on head `bbfebe1`:
1. P1 — probe the studio-text flow (the pack feeds `/api/meechie-studio-text`, the
   PRIMARY generate flow; only the tools endpoint had been probed). Fixed: added
   `tests/integration/meechie-studio-text-seam.test.ts`.
2. P2 — placeholder matching had a mirror bug (see §4). Fixed.
3. P2 — probe timeouts too short for valid adapter retries. Fixed.
4. P1 — CI evidence pinned a stale SHA. Fixed.
5. P1 — DECISIONS.md scope incomplete. Fixed.

### FOUR MORE FINDINGS ON `12baead` — arrived after the fixes, NOT yet addressed

All four verified as correct by reading the cited code. Nothing has been done about
them. They are the top of the next session's queue.

1. **P2 — a test of mine reports FALSE GREEN.** In
   `tests/integration/meechie-tool-seam.test.ts` the `it.each` cases use
   `if (skipLive) return;` instead of `skipIf`. Without `FEATURE_INTEGRATION_TESTS`
   or `XAI_API_KEY`, Vitest reports those three live probes as **passing**, not
   skipped — an integration run with no credentials prints `3 passed | 4 skipped`.
   A green count that is not provider verification. Fix: `skipIf` on those cases,
   matching how the studio-text probe already does it.

2. **P2 — the echo check misses user-visible fields.**
   `tests/integration/meechie-studio-text-seam.test.ts` only checks `quote` and
   `verdict` for verbatim canon copies. `pageTitle` and `pageItems[].label` are also
   displayed in the studio preview and become coloring-page text. A canon line
   copied into the page title passes the probe today.

3. **P2 — studio probe timeout too small.** It is set to 200_000ms, derived from
   3 × 60s + backoff. But `http-resilience.ts` honours `Retry-After` up to 30s per
   retry (≈270s), AND `runMeechieStudioTextPipeline` can make a *second* provider
   call after an invalid first response — so worst case is roughly double again.
   Derive it from the pipeline's full retry budget, not one call's.

4. **P1 — red-proof evidence is stale.**
   `docs/evidence/2026-08-25/canon-ten-draft-migration-proof.txt` still describes the
   superseded `PLACEHOLDER_PAGE_TITLES` / title-only fix and records only the two
   historical-title failures. `DECISIONS.md` claims the *mirror* regression was
   red-proved, and that output is not in the artifact. The red proof WAS re-run in
   the terminal (19 pass → title-only → 2 fail → full-shape → 19 pass) but the file
   was never regenerated. Either regenerate it or drop the claim.

---

## 4. REAL BUGS FOUND — do not reintroduce

**The placeholder/draft bug.** `studio-state.svelte.ts` decides whether a saved
draft holds real generated wording by inspecting its spec. Two opposite errors
have both actually happened:

- Comparing against only the CURRENT placeholder → changing the placeholder makes
  every older untouched draft look generated, and the studio restores retired
  wording as the user's own, exportable. (Shipped in #227.)
- Comparing on TITLE alone → a draft with genuine generated output that happens to
  share a retired title gets classified as untouched, and the user's saved preview
  silently disappears.

Current fix: `PLACEHOLDER_SHAPES` in `src/lib/core/meechie-studio.ts` records
title + item labels for every placeholder ever shipped; `isUntouchedPlaceholder()`
matches the whole shape. **Append the outgoing entry whenever the placeholder
changes. Never remove one** — each is load-bearing for someone's saved draft.

**Two mirrored seam layouts.** `contracts/*.contract.ts` (legacy flat) and
`src/lib/seams/*/contract.ts` (self-contained) are byte-identical apart from import
paths. Any line changed in BOTH counts as duplicated new code and trips SonarCloud
(threshold 3%). Collapsing that mirror is the real fix and nobody has done it.

**Production vs compatibility adapters.** `src/lib/core/tools-pipeline.ts` imports
`$lib/adapters/meechie-tool-seam` (self-contained). The flat
`src/lib/adapters/meechie-tool.adapter.ts` also exists and works but is NOT
deployed. Probe the deployed one.

**`/api/image-generation` composes `createImageProviderConfigSeam`**, which needs
only `XAI_API_KEY` and defaults model/baseURL/endpoint. It does NOT use
`AppConfigSeam`. Don't gate image tests on the full AppConfig set.

---

## 5. ENVIRONMENT GOTCHAS (cost the last session real time)

- **`api.github.com` via curl returns 403.** GitHub access is only available through
  the `mcp__github__*` tools. Curl-based CI polling silently parses error bodies and
  reports false "all clear". Use the MCP tools.
- **`sonarcloud.io` API IS reachable** by curl — useful for per-file duplication and
  issue detail that the GitHub check summary doesn't show.
- **`XAI_API_KEY` is present in the environment.** Live probes are runnable.
- **`tests/unit/api-generate.test.ts` "transport-thin" fails locally** at the 5000ms
  default. Measured: 6.79s total, 5.83s test time, ~2.8s user CPU — it waits on I/O.
  Passes at `--testTimeout=60000`, passes on CI, fails identically on a clean base
  checkout. Environmental, pre-existing. Previous session declined to patch it
  (would widen scope + loosen a shared gate); that stance is on PR #230 and the
  reviewer disagreed. Unresolved.
- **`npm run test:integration` was broken on main** and is fixed on this branch —
  `vitest.integration.config.ts` had no SvelteKit plugin so `$env/dynamic/private`
  never resolved and every integration test died at import. Now aliased.
- Backticks in `node -e` inside bash break the shell. Write a `.mjs` to scratchpad
  and run it instead.
- `git stash` to test a clean checkout works well for proving a failure pre-exists.

---

## 6. VERIFIED STATE OF #230

```
npm run check                                     0 errors, 0 warnings
npm run lint                                      clean
npm test                                          548 passing, 1 env failure
rewind "MeechieVoiceSeam (self-contained)"        17 passing
rewind "MeechieToolSeam (self-contained)"          6 passing
FEATURE_INTEGRATION_TESTS=true test:integration    7 passing, 3 files, LIVE xAI
CI on 12baead                                     10/10 green
```

Live probe result worth remembering: the model does NOT echo canon lines verbatim,
but one response borrowed `the-door`'s phrasing ("don't open the door even a little
bit") without quoting it. Expected when 10 examples pull harder than 20. Watch it.

---

## 6b. LIVE SESSION STATE — clean these up

- **An armed scheduled trigger:** `trig_012H1RNS5FWZE7K7C9QYW1cy`, fires around
  03:03Z, bound to the OLD session (`session_01W5YgHTimkyby1HwuUFKazN`). A new
  window will not receive it, but it is still live. Delete it with
  `mcp__Claude_Code_Remote__delete_trigger` if the old session is abandoned.
- **PR #230 activity subscription** is on the old session too. A new session
  that wants CI/review events must call `subscribe_pr_activity` for #230 itself.
- Five earlier review threads on #230 are replied-to but UNRESOLVED, and four
  newer findings (§3) have no reply at all. Thread IDs are not recorded here —
  fetch them with `pull_request_read` method `get_review_comments` (use the
  `after` cursor for pagination; the `page` parameter is ignored).

---

## 7. DECISION THE OWNER STILL OWES

Asked and unanswered:
1. Reply to the five #230 threads and keep going
2. Stop — merge #230 as-is
3. Move on to the rebuild (§2)

The previous session leaned 2 or 3 and characterized the open threads as
"conversational rather than blocking." **The owner pushed back on that and was
right** — those threads are where every real bug in this work came from. Do not
treat green CI as evidence that review findings are safe to skip.
