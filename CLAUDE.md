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

**Request path:**
```
src/routes/api/<endpoint>/+server.ts
  → src/lib/core/<feature>-pipeline.ts    (pure orchestration, no direct I/O)
  → adapter (real I/O behind a seam; may be sync or async depending on the contract)
```

**Two seam layouts coexist** (see `docs/seams.md` for the registry):

| Layout | Contract | Mock | Adapter | Tests | Fixtures |
|--------|----------|------|---------|-------|----------|
| Legacy (flat) | `contracts/<seam>.contract.ts` | `src/lib/mocks/<seam>.mock.ts` | `src/lib/adapters/<seam>.adapter.ts` | `tests/contract/<seam>.test.ts` | `fixtures/<seam>/` |
| New (self-contained) | `src/lib/seams/<name>/contract.ts` | `src/lib/seams/<name>/mock.ts` | `src/lib/adapters/<name>/index.ts` | `src/lib/seams/<name>/test.ts` | `src/lib/seams/<name>/fixtures.ts` |

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
| `http-client.ts` | Shared fetch helper for JSON POST requests (used by routes and UI components) |

### src/routes/

| File | Purpose |
|------|---------|
| `+page.svelte` | Main coloring page builder UI |
| `meechie/+page.svelte` | Meechie assistant chat UI |
| `api/generate/+server.ts` | Generation endpoint |
| `api/image-generation/+server.ts` | Image provider endpoint |
| `api/chat-interpretation/+server.ts` | Chat-to-spec endpoint |
| `api/tools/+server.ts` | Meechie tool endpoint |

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
| `cipher-gate.mjs` | `npm run cipher:gate` — enforces Cipher Gate entry in DECISIONS.md |
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
