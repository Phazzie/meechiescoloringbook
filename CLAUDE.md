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
| `ai-quota.ts` | Pure reading of the per-caller AI quota the billable routes publish in `RateLimit-*` / `Retry-After` on every response — the units-to-actions arithmetic (`STUDIO_TEXT_QUOTA_COST`, the one definition, imported by the pipeline that charges it) and the sentence the studio shows. An absent or malformed header set reads as `null`, which the UI renders as nothing rather than as a guess |
| `quality-report.ts` | Pure quality-report transforms — turns the drift violations, their severity and source, the recommended fixes and the spec-validation issues into what the reader is told. A check that could not grade arrives as `driftCheckFailure` on the `/api/generate` contract, not as a magic violation code, so an unrunnable check is never reported as a clean page. `hasPage` and `driftChecked` are separate inputs because an empty violation list means opposite things for a page that exists and one that does not. Scopes every sentence to what was inspected: the drift seam reads only the prompt strings and never the image, so nothing here claims anything about the picture. Keeps violations and fixes as the two independent lists the contract declares rather than pairing them |
| `vault-gallery.ts` | Pure Quote Vault transforms — sort/search/label saved pages, and rebuild a saved page's image from its stored bytes |
| `tool-page-recipe.ts` | Pure per-tool coloring page recipes — turns a Meechie tool verdict into the `ColoringPageSpec` + style hint it deserves (list page vs full-quote page) |
| `meechie-studio.ts` | The studio's modes, control metadata, and Meechie-text → `ColoringPageSpec` mapping. Also owns the **mode spotlight**: which mode is called out for the UTC month, which two for the UTC week, when that next changes, and the sentence the strip shows about itself. Every one of those is a pure function of an explicit `epochMs` the caller supplies — this file reads no clock. It used to call `new Date()` and `Date.now()` directly, which `ClockSeam` exists to forbid, and which froze the strip into the prerendered HTML at build time |
| `mode-catalog.ts` | The focused-mode catalog behind `/m/<slug>` — which modes exist, the questions each asks, and how the answers become a `MeechieToolInput`. Derived from `studioModes` so the home page's links and the mode pages cannot drift apart |
| `generated-image-preview.ts` | Pure `GeneratedImage` conversions — `data:` URL for a preview, base64 bytes for the vault. Shared by the studio, the toolkit and the mode routes |
| `page-exports.ts` | Pure descriptions of a finished page's downloads — what each packaged file is, what it is for, how big it is, and one sentence naming any variant that could not be built. The variant is carried in from the call site that asked the packaging seam for it, never recovered from a filename |
| `offline-cache.ts` | The offline layer's whole policy: which build files are pre-cached and at what priority (critical / optional / skipped), which requests the service worker may answer at all (`/api/*`, cross-origin and non-GET never are), the cache key a navigation is looked up under, the network-first-then-cache-then-offline-page orchestration, and the sentence the app shows about its own connection. Reaches the Cache API only through `CacheSeam`, so `src/service-worker.ts` is pure wiring and every rule here runs against `createMockCacheSeam` in a unit test |
| `wig-catalog-gallery.ts` | Pure wig-catalog shopping transforms — search across name/brand/style/colour/tags, facet chips for length, hair type and colour family, and sorting. Facet counts are measured against the search and every *other* dimension, so a chip never advertises results it cannot return |

### src/routes/

| File | Purpose |
|------|---------|
| `+page.svelte` | Main Meechie coloring-page studio with wig try-on |
| `meechie/+page.svelte` | Direct route to Meechie tools (hosts `MeechieTools.svelte`, not a chat UI) |
| `who-fucked-up/+page.svelte`, `rate-his-excuse/+page.svelte`, `random/+page.svelte` | The three standalone mode routes in the nav. Each owns its hero, input and verdict presentation, then hands off to `VerdictPageStudio` |
| `m/[mode]/+page.svelte` | Focused single-mode page, one per studio mode. **Reachable from the home page** — `StudioHero.svelte` renders a `/m/<id>` link for *every* mode, not for a rotating subset; it used to render three, which left five modes with no link on the home page or in the site nav — reachable only from `/offline` and the 404 page, which both list all eight through `modeCatalog()`. Resolves the slug in `+page.ts` (404 on an unknown one) and keys the component on it. Full coloring-page factory: verdict, then `VerdictPageStudio`. Not a delete candidate |
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
| `VerdictPageStudio.svelte` | The "put it on paper" panel shared by the three mode routes — dedication, generate, drift report, preview, downloads, vault save |
| `verdict-page-state.svelte.ts` | `VerdictPageState`: the runes state class behind `VerdictPageStudio`. Owns the verdict request, the page recipe, generation, packaging, and the vault write, with separate staleness tokens for the verdict and the page |
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
