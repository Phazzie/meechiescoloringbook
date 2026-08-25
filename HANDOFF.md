<!--
Purpose: Hand over the state of the xAI outage repair and what the owner has ruled next.
Why: The session ran long and ends mid-stream; the next window should not re-derive any of this.
Info flow: what shipped -> owner rulings not yet done -> open questions -> exact next commands.
-->
# Handoff (2026-08-25)

## Branch
`claude/sharp-meitner-420dwc` → PR #228. Verify green: **551 passed, 1 skipped, 0 failed**,
`npm run verify` exits 0.

## OWNER RULINGS — NOT YET DONE

### 1. Cut voice pack lines 11–20
`src/lib/seams/meechie-voice-seam/voice-pack.ts`. Remove these ten, all `approved` tier.
Leaves 5 `canon` + 5 `approved` = 10 lines.

| # | id | line |
|---|---|---|
| 11 | `i-dont-act` | He said I act like I run the place. I don't act. |
| 12 | `eyes-locked` | When our eyes locked after I said that, we both knew I was capable of it... |
| 13 | `somewhere-to-sit` | I don't need revenge. I need somewhere to sit where your mama can see me. |
| 14 | `first-name` | Keep playing and your brother gonna be calling me by my first name. |
| 15 | `he-forgot` | He said he forgot. I believe him. He forgot I was me. |
| 16 | `location-live` | Your phone died but your location was live at her apartment. Interesting. |
| 17 | `his-people` | He told his people I was crazy. His people called me anyway. |
| 18 | `not-invited` | I don't need to be invited. I need to know what time dinner starts. |
| 19 | `sat-down` | I walked in and sat down. Nobody asked me to leave. |
| 20 | `lower-my-voice` | I don't raise my voice. I lower it. They all get quiet when I do. |

Blast radius: the pack is the single source for BOTH prompt builders — the studio path injects
`VOICE_EXAMPLES` (`meechie-studio-text-pipeline.ts:74`) and the tools path uses
`buildMeechieSystemPrompt` (`meechie-system-prompt.ts`). Cutting ten of twenty halves the
examples the model learns voice from, so regenerate and eyeball real output afterwards.
`meechie-voice-seam` fixtures and tests assert pack contents and will need updating.

Note: #15 `he-forgot` is the seed the model riffed on to produce the off-voice "barbershop"
line the owner rejected. Cutting it is consistent with that rejection.

### 2. Default coloring page → the landlord line
`DEFAULT_STUDIO_TEXT_OUTPUT` in `src/lib/core/meechie-studio.ts:15` should use
"You should have fucked the landlord, not the dopeman." — already canon at `voice-pack.ts:24`
(`approved`, id `landlord`). Also check `static/meechie/demo-coloring-page.png`, which
`StudioPreviewPanel.svelte:81` labels "Example page".

### 3. Merge PR #228
`AGENTS.md` now carries a standing rule (**Merge When The Gates Are Green**): a PR with green
CI, all review comments addressed, green verify with evidence, and nothing unpushed is merged
**without asking**. #228 now meets 1, 3 and 4. Remaining: several open Codex review threads.

## SHIPPED THIS SESSION
- **Root cause of the outage:** xAI retired `grok-4-1-fast-reasoning`; every text call 400'd, which also blocked image generation because the page button requires a verdict first. Model ids are now pinned in `src/lib/core/models.ts`; all `XAI_TEXT_MODEL`/`XAI_IMAGE_MODEL` env reads deleted, so a stale dashboard value can no longer override code.
- **`grok-4.6` verified live** — probe captured `ok:true` with the studio's strict `json_schema`; `POST /api/meechie-studio-text` returned a real verdict. Assumption closed.
- **Provider errors unswallowed** — xAI returns `error` as a bare string; only the nested shape was read, so everything surfaced as "Bad Request". That is why the outage was invisible.
- **Account identifiers redacted** — those same messages are returned to API clients verbatim and contained the deployment's xAI team UUID.
- **Prompt stopped drawing its own labels** — pages rendered `TYPOGRAPHY:` as page text. Cause was an unconditional placeholder above a conditional value. Drawable text is now instruction-then-value-on-its-own-line, deliberately unquoted (`ALLOWED_TEXT_REGEX` permits `"` in a title). Verified live with `He Said "Go"`.
- **Chat no longer retries on timeout** — a slow-but-succeeding 55s generation was aborted at 60s and retried to ~118s, past the client budget. Provider budget 110s, single attempt.
- **`api-generate` test made hermetic** — it was firing real xAI requests through a retry backoff, ~4.8s against a 5s limit. Fixed at cause, not by widening the timeout.
- Duplicate `prompt-assembly` adapter collapsed to a re-export (was a byte-identical copy).
- `.env.example` restored to plaintext; `defaultImageSize` given a schema default (a fresh `cp .env.example .env` was 500ing wig try-on).

## OPEN / NOT RESOLVED
- **Wig try-on returns 429** — Gemini free tier exhausted. Billing at aistudio.google.com. No code fix possible.
- **Generation takes ~55s** and is a product decision, not a bug. Raw model latency measured on a bare prompt: `grok-4.6` 12.7s, `grok-4.5` 4.1s, `grok-4.3` 3.9s. The 55s is this app's large system prompt plus strict structured output, not the model. The owner asked for two more prompts per model plus image variations of an existing Meechie page — **not yet run**.
- Several Codex review threads on #228 still open.
- `.claude/settings.json` (command allowlist) was committed at the owner's explicit request, then removed by another session acting on a bot's scope objection. Currently untracked locally. Owner's instruction stands; it has not been re-added.

## WATCH OUT
Another session pushes to this same branch and has **force-pushed** over it at least once, and
scheduled crons open PRs against this repo. Always `git fetch` and check before assuming your
local state matches the remote.
