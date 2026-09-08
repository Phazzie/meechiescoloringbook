<!--
Purpose: Give Claude Code session context — commands, architecture, and file map.
Why: AGENTS.md owns governance; this file owns navigation and Claude Code-specific shortcuts.
Info flow: This file -> AGENTS.md -> docs/seams.md -> contracts/ or src/lib/seams/ -> src/
-->
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Read `AGENTS.md` first.** It owns all governance: Seam-Driven Development workflow, Wu-Bob persona, mandates, checklists, and automation. This file does not repeat any of that — it adds Claude Code-specific navigation on top.

## Commands

```sh
npm run dev                              # start dev server
npm run build                           # production build
npm run check                           # svelte-check + TypeScript
npm run lint                            # eslint
npm run test                            # all tests (vitest; integration tests may be env-gated)
npm run test:integration                # integration tests (set FEATURE_INTEGRATION_TESTS=true and populate .env from .env.example, including XAI_* / AppConfig vars)
npm run test:e2e                        # playwright
npm run verify                          # required for any seam change
npm run rewind -- --seam <SeamName>     # single-seam contract verification (PascalCase name)
npm run hooks:install                   # install local git hooks
```

## Architecture

SvelteKit 2 app (Svelte 5, TypeScript) deployed via `@sveltejs/adapter-vercel`. Core logic is deterministic and dependency-free; all external I/O is isolated behind seams.

**Every page route is prerendered** (`prerender = true`, and `'auto'` on `/m/[mode]` so its slug aliases still resolve through the function). No page `load` depends on the request — they read a bundled catalog and the reader's own typing, and every provider call happens after hydration. This is what puts the app's HTML in `$service-worker`'s `prerendered` list, which is what the service worker caches so an installed copy opens with no network. Adding a request-dependent `load` to a page means removing its `prerender` flag; the build will tell you.

**Request path:**
```
src/routes/api/<endpoint>/+server.ts
  → src/lib/core/<feature>-pipeline.ts    (pure orchestration, no direct I/O)
  → adapter (real I/O behind a seam; may be sync or async depending on the contract)
```

**Two seam layouts coexist** (see `docs/seams.md` for the registry):

| Layout | Contract | Mock | Adapter | Tests | Fixtures |
|--------|----------|------|---------|-------|----------|
| Legacy (flat) | `contracts/<seam-name>.contract.ts` | `src/lib/mocks/<seam-name>.mock.ts` | `src/lib/adapters/<seam-name>.adapter.ts` | `tests/contract/<seam-name>.test.ts` | `fixtures/<seam-name>/` |
| New (self-contained) | `src/lib/seams/<seam-name>/contract.ts` | `src/lib/seams/<seam-name>/mock.ts` | `src/lib/adapters/<seam-name>/index.ts` | `src/lib/seams/<seam-name>/test.ts` | `src/lib/seams/<seam-name>/fixtures.ts` |

New seams use the self-contained layout. Do not add flat-layout seams. See `src/lib/seams/CLAUDE.md` for the folder anatomy.

## File Map

### Root governance docs

| File | Purpose |
|------|---------|
| `AGENTS.md` | **Source of truth** — Seam-Driven Development workflow, Wu-Bob, mandates, checklist |
| `DECISIONS.md` | Cipher Gate entries, Assumption entries, tradeoff log |
| `LESSONS_LEARNED.md` | Dated pitfall/fix entries |
| `CHANGELOG.md` | User-visible changes only |
| `HANDOFF.md` | Session handoff notes |
| `plan.md` | Current autonomous deep-work plan (updated before major refactors) |
| `SDD_MASTER_GUIDE_COPY.md` | Full Seam-Driven Development rationale and reference |
| `SDD_QUICK_REFERENCE.md` | One-page cheat sheet |

### docs/

| File/Dir | Purpose |
|----------|---------|
| `docs/seams.md` | **Authoritative seam registry** — PascalCase names, file paths, probe status, last probe date |
| `docs/SEAM_BLUEPRINT.md` | Template for new seams |
| `docs/CHECKLIST.md` | Pre-ship checklist |
| `docs/evidence/YYYY-MM-DD/` | Dated outputs from `npm run verify` (chamber-lock, proof-tape, etc.) |

### src/lib/core/ — orchestration pipelines (no direct I/O)

| File | Purpose |
|------|---------|
| `generate-pipeline.ts` | Top-level coloring page generation flow |
| `image-generation-pipeline.ts` | Image provider call orchestration |
| `chat-interpretation-pipeline.ts` | Chat input → structured spec translation |
| `tools-pipeline.ts` | Meechie tool dispatch |
| `prompt-template.ts` | Canonical and compressed prompt assembly |
| `constants.ts` | App-wide constants |
| `http-client.ts` | Shared fetch helper for JSON POST requests (used by routes and UI components). `onResponseHeaders` exposes the response headers to the caller, which is how the AI quota reaches the UI |
| `ai-quota.ts` | Pure reading of the per-caller AI quota the billable routes publish in `RateLimit-*` / `Retry-After` on every response — the units-to-actions arithmetic and the sentence a surface shows. One bucket funds actions of different prices (`STUDIO_TEXT_QUOTA_COST` is 2, `CHAT_INTERPRETATION_QUOTA_COST` is 1), each defined here once and imported by the pipeline that charges it, so a surface divides by *its own* cost and names what it is counting. An absent or malformed header set reads as `null`, which the UI renders as nothing rather than as a guess |
| `quality-report.ts` | Pure quality-report transforms — turns the drift violations, their severity and source, the recommended fixes and the spec-validation issues into what the reader is told. A check that could not grade arrives as `driftCheckFailure` on the `/api/generate` contract, not as a magic violation code, so an unrunnable check is never reported as a clean page. `hasPage` and `driftChecked` are separate inputs because an empty violation list means opposite things for a page that exists and one that does not. Scopes every sentence to what was inspected: the drift seam reads only the prompt strings and never the image, so nothing here claims anything about the picture. Keeps violations and fixes as the two independent lists the contract declares rather than pairing them |
| `vault-gallery.ts` | Pure Quote Vault transforms — sort/search/label saved pages, and rebuild a saved page's image from its stored bytes |
| `vault-page.ts` | Pure decisions for the vault as a *place* — its one path (`VAULT_PATH`), the permalink that reopens a saved page in the studio (`/?creation=<id>`), the reader-chosen sort orders, the two-number count sentence, and every sentence the vault says about its own state. `showsVaultLink` is an exact match against the save confirmation and never a search for the word "vault", because several failure messages on that same status line contain it while meaning the page never got there |
| `tool-page-recipe.ts` | Pure per-tool coloring page recipes — turns a Meechie tool verdict into the `ColoringPageSpec` + style hint it deserves (list page vs full-quote page) |
| `meechie-studio.ts` | The studio's modes, control metadata, and Meechie-text → `ColoringPageSpec` mapping. Also owns the **mode spotlight**: which mode is called out for the UTC month, which two for the UTC week, when that next changes, and the sentence the strip shows about itself. Every one of those is a pure function of an explicit `epochMs` the caller supplies — this file reads no clock. It used to call `new Date()` and `Date.now()` directly, which `ClockSeam` exists to forbid, and which froze the strip into the prerendered HTML at build time |
| `mode-catalog.ts` | The focused-mode catalog behind `/m/<slug>` — which modes exist, the questions each asks, and how the answers become a `MeechieToolInput`. Derived from `studioModes` so the home page's links and the mode pages cannot drift apart |
| `describe-page.ts` | Every decision `/describe` makes — how long a description may be, one reader-facing sentence per interpretation failure code, the read-back that turns an interpreted `ColoringPageSpec` into sentences the reader checks *before* a generation is paid for, the cautions that come with it (never refusals), and the style hint sent alongside the spec. Derived from the validated spec and never from the sentence that produced it: a read-back built from the request rather than the result would hide exactly the mismatch it exists to expose |
| `generated-image-preview.ts` | Pure `GeneratedImage` conversions — `data:` URL for a preview, base64 bytes for the vault. Shared by the studio, the toolkit and the mode routes |
| `page-exports.ts` | Pure descriptions of a finished page's downloads — what each packaged file is, what it is for, how big it is, and one sentence naming any variant that could not be built. The variant is carried in from the call site that asked the packaging seam for it, never recovered from a filename |
| `offline-cache.ts` | The offline layer's whole policy: which build files are pre-cached and at what priority (critical / optional / skipped), which requests the service worker may answer at all (`/api/*`, cross-origin and non-GET never are), the cache key a navigation is looked up under, the network-first-then-cache-then-offline-page orchestration, and the sentence the app shows about its own connection. Reaches the Cache API only through `CacheSeam`, so `src/service-worker.ts` is pure wiring and every rule here runs against `createMockCacheSeam` in a unit test |
| `print-layout.ts` | The whole geometry of putting a page on paper — the two papers in points, the `PRINT_SAFE_MARGIN_MM` that must stay blank, where the artwork is letterboxed inside what is left, the full-sheet raster size at 300dpi, and the origin flip a canvas needs that a PDF does not. `src/lib/adapters/output-packaging-seam/index.ts` decides no geometry of its own: it holds a canvas and a PDF page and asks here where the ink goes. The margin is **12mm, the same number `@page` in `+layout.svelte` already reserved** — the two used to disagree by the whole margin, so the app's own print and its downloaded PDF produced two different sizes of the same page, and the downloaded one bled to the edge of the sheet where no printer can mark. `tests/unit/print-layout.test.ts` reads that stylesheet and fails if the two drift apart |
| `share-page.ts` | Pure send policy — whether a finished page can be handed to another app, which packaged file goes and why that one (the square PNG: the adapter letterboxes the whole page onto white rather than cropping it, so nothing is cut off and a chat previews it inline), what the control says, the payload's title and text, and what each outcome tells the reader. A dismissed share sheet is silent, not an error. Touches no DOM: `navigator.share` lives in `SharePageButton.svelte` |
| `print-sheet.ts` | Pure print policy — whether a surface has anything to put on paper, what the Print control says, the one sentence explaining why it is off (shared by the disabled button and the print-only fallback sheet, so they cannot drift), and the document title the job runs under, which is the default filename a reader gets from "Save as PDF". Filesystem-hostile characters and trailing dots are stripped there, because Meechie's page titles routinely contain `?` and `/`. Touches no DOM: `window.print()` lives in `PrintPageButton.svelte`, and what actually reaches the paper is the `@media print` block in `+layout.svelte` |
| `wig-catalog-gallery.ts` | Pure wig-catalog shopping transforms — search across name/brand/style/colour/tags, facet chips for length, hair type and colour family, and sorting. Facet counts are measured against the search and every *other* dimension, so a chip never advertises results it cannot return |

### src/routes/

| File | Purpose |
|------|---------|
| `+layout.svelte` | App shell: head metadata, nav, the offline banner and service-worker registration — and **the app's entire print stylesheet**. That `@media print` block is what decides what reaches paper: it hides everything that is not a `data-print-sheet`, inside one, or an ancestor of one (`:has()` is what makes "ancestor of" expressible), so one finished picture prints as one full sheet and the app does not print at all. Structural on purpose — a rule listing the panels to hide would silently start printing every panel added afterwards. Needs the `display: contents` `.app-body` wrapper around `{@render children()}` as its boundary, and carries the print-only fallback sheet a screen with no page on it prints instead of blank paper |
| `+page.svelte` | Main Meechie coloring-page studio with wig try-on |
| `meechie/+page.svelte` | Direct route to Meechie tools (hosts `MeechieTools.svelte`, not a chat UI) |
| `who-fucked-up/+page.svelte`, `rate-his-excuse/+page.svelte`, `random/+page.svelte` | The three standalone mode routes in the nav. Each owns its hero, input and verdict presentation, then hands off to `VerdictPageStudio` |
| `m/[mode]/+page.svelte` | Focused single-mode page, one per studio mode. **Reachable from the home page** — `StudioHero.svelte` renders a `/m/<id>` link for *every* mode, not for a rotating subset; it used to render three, which left five modes with no link on the home page or in the site nav — reachable only from `/offline` and the 404 page, which both list all eight through `modeCatalog()`. Resolves the slug in `+page.ts` (404 on an unknown one) and keys the component on it. Full coloring-page factory: verdict, then `VerdictPageStudio`. Not a delete candidate |
| `vault/+page.svelte` | The Quote Vault as a place: every saved page, searched and sorted, at an address the nav links to. Prerendered (`+page.ts`), so `planPrecache` puts it in the critical set and an installed copy opens it with no network — which is the moment saved pages matter most. Nothing about a reader's pages may reach that HTML file: the pages are read from this device after hydration, and until then the page says it is *reading* rather than claiming the vault is empty. A row links to `/?creation=<id>` rather than reopening in place, because only the studio can rebuild a page. New routes must be added to `vercel.json` — `tests/unit/security-headers.test.ts` walks the route tree and fails the build otherwise |
| `describe/+page.svelte` | **`/describe`** — the one surface where the reader says what the page should be instead of picking a question Meechie already wrote. It is the front door for `ChatInterpretationSeam`, which shipped complete (contract, mock, fixtures, probe, pipeline, live billable endpoint, browser adapter, contract tests) and had **zero callers anywhere in `src/routes/**` or `src/lib/components/**`** for the app's whole life. Two billable calls in a fixed order: the interpretation is shown as a read-back the reader checks, and only then is the button that pays for a picture offered. Prerendered, and in `vercel.json` — `tests/unit/security-headers.test.ts` walks the route tree and fails the build otherwise |
| `offline/+page.svelte` | The page a navigation lands on when it reaches neither the network nor the cache. Prerendered (`+page.ts`) so a real file exists for the service worker to store at install — `planPrecache` reports `fallbackAvailable: false` if that ever stops being true, and the worker then declines to offer a fallback rather than serving a path it never cached. Names what still works on this device and what waits for a connection, and reads this device's live `navigator.onLine` rather than asserting a state |
| `+error.svelte` | The app-wide error page. Before it existed every failure fell through to SvelteKit's unstyled default; it now lists every real mode so a mistyped `/m/<slug>` has somewhere to go |
| `api/generate/+server.ts` | Generation endpoint |
| `api/image-generation/+server.ts` | Image provider endpoint |
| `api/chat-interpretation/+server.ts` | Chat-to-spec endpoint |
| `api/tools/+server.ts` | Meechie tool endpoint |
| `api/meechie-studio-text/+server.ts` | Meechie Studio text (verdict/quote) endpoint |
| `api/wig-try-on/+server.ts` | Wig try-on portrait endpoint |

### src/lib/components/ — shared components

| File | Purpose |
|------|---------|
| `MeechieTools.svelte` | The eleven-tool hub at `/meechie`; owns its own verdict-to-page lifecycle |
| `QualityFindings.svelte` | The one rendering of a report's findings — each with its severity tag — and then the fixes the drift seam computed. Used by System Trace directly and by `QualityReportPanel` |
| `QualityReportPanel.svelte` | The whole report block as it appears under a "make the page" button: the clean line, or the boxed findings. Shared by the mode routes and the tools hub, which had byte-similar copies of the wrapper and its CSS. Renders nothing for `unchecked` — the block sits under the generate button, where "no check has reported" would caption an empty space |
| `VaultGallery.svelte` | The **only** rendering of the vault's rows in the app — count, search, undo banner, thumbnails, pin, two-step delete, download — shared by the home card and `/vault`. **Owns its own CSS**, including the card frame, label typography, input and button rules it used to inherit from `.studio`. Those forty-three rules lived in `+page.svelte` as `:global(.studio .vault-*)` for fourteen runs, which is why the vault never left the home page: the markup was reachable by copying and the styling was not. A row is a `<button>` in the studio, where reopening mutates state, and an `<a>` on `/vault`, where it navigates |
| `vault-collection.svelte.ts` | `VaultCollection`: the runes state behind the saved pages themselves — list, search, pin, two-step delete, undo, and the UTC day-boundary refresh behind the "Saved today" labels. `StudioState` holds one and forwards to it through accessors, so the studio and `/vault` are one implementation. `saveToVault` and `loadCreation` deliberately stayed on `StudioState`: both need the page on screen |
| `VaultStatusLine.svelte` | The **only** rendering of what a surface says after a save, on all four hosts, with the link to `/vault` beside it when — and only when — the save actually succeeded. The decision is `showsVaultLink` in core |
| `VerdictPageStudio.svelte` | The "put it on paper" panel shared by the three mode routes — dedication, generate, drift report, preview, downloads, vault save |
| `verdict-page-state.svelte.ts` | `VerdictPageState`: the runes state class behind `VerdictPageStudio`. Owns the **verdict half only** — the `/api/tools` request, the recipe it becomes, and the dedication — and extends `PageArtifactState` for everything from the spec onwards. Two staleness tokens, because the two lifecycles are cancelled by different actions |
| `PageExportRow.svelte` | The **only** export row in the app: every download, each one saying what it is, what it is for and how big it is, plus the notice naming anything that could not be packaged. Owns its own styling — the rules used to be `:global(.studio .export-*)` in `+page.svelte`, which is a large part of why the row stayed the home page's alone for twelve runs: the markup was reachable by copying and the styling was not. The other twelve page-making surfaces rendered `{file.filename}` as the link text until Run 14 |
| `SharePageButton.svelte` | The **only** place in `src/` that calls `navigator.share`, `navigator.canShare` or `navigator.clipboard.write`. Decodes the chosen export to a `File` synchronously so the user gesture survives — an await before `share()` spends the transient activation in several browsers — and falls back to copying the PNG where the Web Share API cannot take files. Every decision is in `$lib/core/share-page` |
| `PrintPageButton.svelte` | The **only** place in `src/` that calls `print()`. Shared by the home studio, the shared verdict studio and the tools hub, so the label, the disabled rule and the saved-file name are one answer rather than three. Sets `document.title` to the page's own title for the duration of the job — restored on `afterprint`, not after `print()` returns, because in several browsers `print()` resolves as soon as the preview opens |
| `page-artifact-state.svelte.ts` | `PageArtifactState`: the **spec -> finished page** half of every page-making surface — `/api/generate`, decoding what the browser can actually show, installing the page *before* packaging it, the split print/share packaging, the export row, the drift report and the vault write. Driven by a `PageSource` (a recipe plus what to store and say about it), which is the one thing that differs between a page Meechie ruled into existence and one the reader described. `VerdictPageState` and `DescribePageState` both extend it, so a fix to any of it lands on every surface at once |
| `describe-page-state.svelte.ts` | `DescribePageState`: the message -> `/api/chat-interpretation` -> read-back -> page lifecycle behind `/describe`. `interpretedFrom` pins the read-back to the words that produced it, because the box stays editable afterwards. A **failed** interpretation never destroys a page already paid for; a **successful** one does, because that page belongs to the interpretation it replaces |
| `DescribePageStudio.svelte` | The `/describe` markup — description field, example chips, the read-back panel, and the finished page through the same shared `QualityReportPanel`, `PageExportRow`, `PrintPageButton`, `SharePageButton` and `VaultStatusLine` every other surface uses |
| `SelfieUpload.svelte` | Wig try-on selfie input |
| `WigCarousel.svelte` | The wig catalog browser — presentational, taking `wigs` and `loadError` as props, and owning the search box, facet chips, sort control and result count. The catalog is read by `WigCatalogSeam` in the page's `load` (never a raw `wigs.json` import, so a load failure or an empty catalog is reported rather than rendered as an empty row) — in `load` rather than an `$effect` so the cards and their affiliate links are server-rendered |
| `MeechieModePage.svelte` | The body of the `/m/[mode]` focused-mode page, which the home page links to. Asks the mode's question, shows the verdict, then hands off to `VerdictPageStudio` — the same shared panel the three standalone mode routes use |
| `studio/` | The home studio's panels (hero, input, preview, settings, vault row, wig try-on). `StudioHero.svelte` renders **every** mode as a card and a `/m/` link — a rotation may decide what is *badged*, never what exists — and gates both badges and the schedule sentence on hydration, because `/` is prerendered and that document is what the service worker replays offline |

### scripts/ — `npm run verify` automation (do not edit without a plan)

| File | Backs |
|------|-------|
| `chamber-lock.mjs` | `npm run chamber:lock` — checks seam artifact presence |
| `verify-runner.mjs` | `npm run verify:runner` — runs check + test, captures evidence |
| `shaolin-lint.mjs` | `npm run shaolin:lint` — enforces evidence freshness |
| `assumption-alarm.mjs` | `npm run assumption:alarm` — enforces Assumption entries |
| `seam-ledger.mjs` | `npm run seam:ledger` — writes seam coverage ledger |
| `clan-chain.mjs` | `npm run clan:chain` — writes clean/dirty seam summaries |
| `proof-tape.mjs` | `npm run proof:tape` — plain-English evidence summary |
| `cipher-gate.mjs` | `npm run cipher:gate` — enforces Cipher Gate entry in DECISIONS.md (not in verify chain; run manually if needed) |
| `rewind.mjs` | `npm run rewind` — single-seam contract verification |
| `install-githooks.mjs` | `npm run hooks:install` — configures pre-commit/pre-push hooks |

### contracts/ — legacy flat-layout contracts

See `contracts/CLAUDE.md`. These belong to existing seams; new seams go under `src/lib/seams/`.

### src/lib/seams/ — new self-contained seam folders

See `src/lib/seams/CLAUDE.md` for folder anatomy and current seam list.

## CLAUDE.md vs AGENTS.md — how they divide responsibility

| Question | Where to look |
|----------|---------------|
| What workflow must I follow? | `AGENTS.md` |
| What are the mandates and bans? | `AGENTS.md` |
| What is Wu-Bob and who is in it? | `AGENTS.md` |
| What commands do I run? | This file |
| Where does a file live? | This file + nested CLAUDE.mds |
| Which seams exist? | `docs/seams.md` |
| What decisions were made? | `DECISIONS.md` |

**Never symlink or mirror these files.** They serve different tools and different purposes. `AGENTS.md` is read by any AI tool; `CLAUDE.md` is Claude Code-specific navigation that explicitly defers governance back to `AGENTS.md`.
