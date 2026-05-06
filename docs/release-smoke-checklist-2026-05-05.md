# Release Smoke Checklist - 2026-05-05

Purpose: Track the current smoke-test findings, deployment blockers, fixes, and follow-up coverage for Meechies Coloring Book.

## Broken Interactions

- [x] Home AI text flow: clicking `Generate Verdict` posts to `/api/meechie-studio-text` and can fail before producing a verdict.
- [x] Home mode selector: active mode styling changes, but the visible mode heading and placeholder can stay on the previous mode.
- [x] Home `Random Meechie` mode is blocked when server AI text generation is unavailable.
- [x] `Rate His Excuse` export: `Generate My Coloring Page` can return `PROMPT_TOO_LONG`.
- [x] `Who Fucked Up?` export: `Generate My Coloring Page` can return `PROMPT_TOO_LONG`.
- [x] Vault destructive actions are not fully smoke-tested because saved pages require the upstream generation flow to succeed first.

## Console Errors

- [x] `401 Unauthorized` from `/api/meechie-studio-text` when `XAI_API_KEY` is not visible to the server process.
- [x] `400 Bad Request` provider responses after the key is loaded need root-cause confirmation.
- [x] `400 Bad Request` from `/api/generate` when prompt assembly exceeds the provider prompt limit.

## Network And API Errors

- [x] Confirm local dev loads `.env.local` or document the required startup command.
- [ ] Confirm production has `XAI_API_KEY`.
- [ ] Confirm optional production model vars: `XAI_TEXT_MODEL`, `XAI_IMAGE_MODEL`, `XAI_BASE_URL`, `XAI_IMAGE_ENDPOINT_PATH`.
- [x] Confirm xAI chat request payload is accepted by the selected text model.
- [x] Confirm xAI image request payload is accepted by the selected image model.

## Missing Test IDs Or Unstable Selectors

- [x] No stable `data-testid` or `data-qa` hooks exist for primary flows.
- [x] Home has duplicate `Generate Verdict` buttons, which makes role/name selectors ambiguous.
- [x] Add stable selectors for primary route controls, route submits, mode tabs, generated output, empty states, and errors.

## Flows That Need E2E Coverage

- [x] Home mode switching updates visible copy and placeholders.
- [x] Home AI text generation success state and server-error state.
- [x] Home coloring-page generation success state and prompt/API-error state.
- [x] Home copy quote, save to vault, load saved item, pin/unpin, and delete.
- [x] `/random` tap, AI-error state, success state, and page generation.
- [x] `/rate-his-excuse` submit, reset, glitter toggle, and page generation.
- [x] `/who-fucked-up` submit, reset, glitter toggle, and page generation.
- [x] `/meechie` tab switching, all tool submits, lineup add/remove, and random saying error/success paths.

## Smallest Fixes Before Release

- [x] Make server runtime config read local and deployed env values reliably.
- [x] Fix home active mode state so visible text reacts when mode buttons are clicked.
- [x] Shorten or constrain route-generated page titles before calling `/api/generate`.
- [x] Add deterministic handling for missing AI credentials in smoke-friendly paths.
- [x] Add a thin Playwright smoke suite with stable selectors.
- [x] Run `npm run check`, `npm test`, `npm run build`, `npm run verify`, and `npm run test:e2e`.

## Second-Pass Blocker Check

- [x] Re-run static deployment audit after fixes.
- [x] Re-run browser smoke after fixes.
- [x] Re-check console errors after fixes.
- [x] Re-check API/network errors after fixes.
- [x] Re-check recent PR #38 review threads and address useful comments.
- [x] Update this checklist with completed items and remaining risks.

## PR Review Comments Addressed

- [x] Queue a follow-up draft save when edits happen while a draft save is already in progress.
- [x] Log a short server-side diagnostic when Meechie studio text JSON extraction fails after retry.
- [x] Use literal UI parity assertions instead of regex-built tool id checks.
- [x] Split raw provider output before normalizing Random Meechie sayings so multiline responses keep the first line.

## Remaining Operational Items

- [ ] Confirm production deployment environment variables in Vercel.
- [x] Add full vault CRUD E2E coverage with a seeded local storage scenario.
