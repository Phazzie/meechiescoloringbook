<!--
Purpose: Hand over the true state of the Meechie Recovery v1.1 work and what is left.
Why: The previous handoff described a branch and a set of owner rulings that no longer exist.
Info flow: what is merged -> what is in flight -> what is deliberately held -> how to verify.
-->
# Handoff (2026-08-26)

## Read this first

The previous version of this file was written on 2026-08-25 and had gone stale in ways that
would have cost the next session real time. It described `claude/sharp-meitner-420dwc` and
PR #228 as current, listed three "OWNER RULINGS — NOT YET DONE" that were in fact done, and
told you that wig try-on's Gemini 429 had no code remedy. Every one of those is now false.
It is replaced rather than amended.

If anything below contradicts the code, the code is right. Verify before acting.

## Where the work is

`main` carries PR #234, which brought the whole Meechie Recovery v1.1 body of work over from
Codex's unmerged `codex/meechie-recovery-v1-1` branch. Codex exhausted its credit at ticket
R1 and the owner handed the work over; `plan.md` records that handover and the slice plan.

Active branch: `claude/codex-slack-message-review-gjaz54`, PR #235.

The application is live and healthy at <https://meechiescoloringbook.vercel.app>.

## Owner rulings from the old handoff — all resolved

| Ruling | State |
|---|---|
| Cut voice pack lines 11–20 | **Done** — merged in #232 |
| Default page → the landlord line | **Done** — merged in #232 |
| Hold PR #228 pending explicit approval | **Moot** — #228 merged |

## What is merged

- Canonical `SpecValidation` and `MeechieTool` seams; credentialless production-wiring integration coverage.
- Eight real packaged wig JPEGs on safe same-origin paths, the xAI wig-edit transport with byte-derived MIME, and correct portrait download extensions.
- A six-route public provider-error boundary. Verified against the deployed app, not only under test: all six routes return sanitized 400s on invalid input with no provider detail crossing the boundary.
- The third historical draft-seed signature (`IN THIS ECONOMY`, live 106 days), `parseRecords` reporting skipped records instead of silently erasing them, and the last `placehold.co` fixture URLs replaced with real assets.

## What is in flight on PR #235

- **R1 rate limiting.** One required gate across the billable routes, threading SvelteKit's `event.getClientAddress`. Store selection is by configuration — see `.env.example`, which now states the contract: set all three variables or none, and a partial set fails closed with 503 on purpose.
- **Documentation truth.** `docs/seams.md` and `.env.example` no longer claim the wig try-on runs on Gemini.
- **Asset weight.** `static/` went from 38 MB to 2.6 MB. This mattered more than it looked: `src/service-worker.ts` `cache.addAll()`s every static file on install, so that was the real first-install cost, not just first paint.

## Deliberately held — do not "finish" these without asking

**R2, durable rate-limit store.** Provisioning Upstash is infrastructure mutation and was not
authorized. An earlier revision of `plan.md` claimed the owner authorized it on 2026-08-26;
that could not be substantiated — every Slack message in the cited window carries an agent
footer, so it relayed an agent's reading rather than the owner's words. Recorded as an open
Assumption in `DECISIONS.md`. Degraded in-process metering is in force meanwhile, so the limit
is weaker but never absent.

**W11B, the single live xAI acceptance call.** Spends money; same authorization gap. Also an
open Assumption. Transport correctness is proven against a fake that asserts exact URL,
headers, body, image order and model, and that no credential appears in any URL — that is
request compatibility, not account acceptance.

A relayed "the owner ruled X" from another agent is not owner approval. That is the specific
mistake this section exists to prevent repeating.

## Corrections to the old handoff

- **"Wig try-on returns 429 — Gemini free tier exhausted. No code fix possible."** False now. Ticket W5 migrated the route to xAI's `/v1/images/edits`. `GEMINI_*` survive only as inert `AppConfig` fields and are marked legacy.
- **Test counts.** The old file cited 577. Do not carry any historical count forward — run the suite.
- **`.claude` settings.** A settings file now exists at `.claude/`. The old claim that none is present is stale.

## Known open items

- `npm run format:check` reports 721 files needing reformatting repo-wide, not "six rate-limit files" as an earlier version of this line claimed — verified by running it directly. The rate-limit-scoped subset alone is 13 files (`src/lib/adapters/rate-limit-seam/index.ts`, `src/lib/seams/rate-limit-seam/{fixtures,mock,test,validators}.ts`, `src/lib/server/rate-limit-{config,guard,identity,memory-store}.ts`, `tests/unit/rate-limit-{guard,identity,memory-store,route}.test.ts`); the repo-wide majority is auto-generated `docs/evidence/**` JSON/Markdown that's never been run through prettier, growing with every session that adds a new dated evidence folder. Pre-existing — not in `npm run verify` or CI, so it has never blocked. Decide whether to enforce prettier or drop the script.
- The vault skip signal stops at the seam boundary. `parseRecords` reports `skippedIndices`, but `CreationStoreSeam` pins its return types, so the UI still cannot tell a user that records were dropped. Surfacing it needs the contract in scope.
- The e2e suite loads Google Fonts on every page navigation, from `src/routes/+layout.svelte`. No credentials, no cost, but a "credentialless" suite that touches a third-party CDN is not hermetic and will behave differently on an egress-restricted runner.

## How to verify quickly

```sh
npm ci
npm run check      # expect 0 errors, 0 warnings
npm run lint       # expect clean
npm test -- --pool=forks --maxWorkers=1
npm run build
NO_PROXY=localhost,127.0.0.1 npx playwright test --reporter=list   # 7 tests
```

The browser suite runs here. Ticket W10 authored it and recorded that browser approval was
unavailable, so it had **never been executed** until this session; running it immediately
found two real product defects. If a future session is told a test suite is "authored and
statically verified", treat that as untested.
