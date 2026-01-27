# Seam-Driven Development Checklist

## Phase 0 — Orientation
- [ ] Read `AGENTS.md`, `DECISIONS.md`, `docs/seams.md` (confirm Wu-Bob roster and current governance).
- [ ] Identify commands you will run for this work and record them (shell history or notes).
- [ ] Note plan items requiring approvals, external probes, or evidence capture (prepare `docs/evidence/YYYY-MM-DD/`).

## Phase 1 — Probes & Fixtures
- [ ] `set -a; source .env; set +a` and confirm `XAI_API_KEY` is loaded.
- [ ] Run `node probes/provider-adapter.probe.mjs`; save output to `docs/evidence/YYYY-MM-DD/probe-provider-adapter.txt`.
- [ ] Run `node probes/chat-interpretation.probe.mjs`; save output to `docs/evidence/YYYY-MM-DD/probe-chat-interpretation.txt`.
- [ ] Run `node probes/image-generation.probe.mjs`; save output to `docs/evidence/YYYY-MM-DD/probe-image-generation.txt`.
- [ ] If any probe fails, document an Assumption entry in `DECISIONS.md`, run `npm run assumption:alarm`, and declare BLOCKED.
- [ ] Refresh fixtures under `fixtures/provider-adapter/`, `fixtures/chat-interpretation/`, `fixtures/image-generation/` to match probe outputs (sample/fault/dense as applicable).

## Phase 2 — Prompt Alignment & Drift
- [ ] Confirm `MAX_PROMPT_LENGTH = 1024` in `src/lib/adapters/prompt-assembly.adapter.ts`.
- [ ] Validate sample prompt length (`node -e '...sample.json...'` <= 1024).
- [ ] Update `fixtures/prompt-assembly/*.json` to reflect the canonical prompt template (sample, title-only, fault) and note template version.
- [ ] Align required phrases/casing in `src/lib/adapters/drift-detection.adapter.ts` and `fixtures/drift-detection/*.json` (sample/title-only/fault).

## Phase 3 — ImageGeneration & Provider Alignment
- [ ] Ensure `contracts/image-generation.contract.ts` matches xAI response shape including `images`, `revisedPrompt`, `modelMetadata`.
- [ ] Confirm `src/lib/adapters/image-generation.adapter.ts` enforces required phrases, uses `/api/image-generation`, and returns contract-aligned results.
- [ ] Update `contracts/provider-adapter.contract.ts`/`src/lib/adapters/provider-adapter.adapter.ts` to POST to `https://api.x.ai/v1/images/generations` with `model: grok-2-image-1212` and `response_format: b64_json`.
- [ ] Validate server route `src/routes/api/image-generation/+server.ts` proxies through ProviderAdapterSeam only.

## Phase 4 — Output Packaging (PDF)
- [ ] Confirm `contracts/output-packaging.contract.ts` describes PDF variants.
- [ ] Ensure `src/lib/adapters/output-packaging.adapter.ts` uses `pdf-lib` and emits expected files (print/square/chat).
- [ ] Refresh `fixtures/output-packaging/*.json` and `tests/contract/output-packaging.test.ts`.

## Phase 5 — Storage & Session Seams
- [ ] Update/verify `contracts/creation-store.contract.ts`, adapter (`src/lib/adapters/creation-store.adapter.ts`), mock, fixtures, and tests; localStorage adapter must handle anonymous owners.
- [ ] Handle drafts and storage retention schema (cb_creations_v1, cb_drafts_v1).
- [ ] Ensure SessionSeam artifacts (`contracts/session.contract.ts`, adapters, fixtures, tests) are complete.
- [ ] Confirm SpecValidationSeam is defined (contract, adapter, fixtures, tests) and gates generation.

## Phase 6 — UI / PWA
- [ ] `src/routes/+page.svelte`: manual builder + chat panel + debug panel (Prompt/Revised prompt/Violations), alignment toggles, and spec validation gating.
- [ ] Ensure generation buttons call seams in order: spec validation → prompt assembly → image generation → drift detection → output packaging → creation store.
- [ ] Confirm `static/manifest.webmanifest`, `static/icons/*`, and service worker (if any) enable Android PWA install.
- [ ] Verify top-of-file comments describe purpose/why/info flow.

## Phase 7 — Docs, Logs, Naming
- [ ] Update `docs/seams.md` (owners, probes, naming clarity) and note any new seam/rule changes.
- [ ] Document updates in `DECISIONS.md` (Cipher Gates + Assumptions) and `CHANGELOG.md` (user-visible summary).
- [ ] Record lessons in `LESSONS_LEARNED.md` (prompt limits, probe outcomes, Wu-Bob practices).
- [ ] Add references to source-of-truth guidance to `AGENTS.md` if needed.

## Phase 8 — Verification & Self‑Review
- [ ] Run `npm test` and `npm run verify`; update evidence under `docs/evidence/YYYY-MM-DD/`.
- [ ] Produce final self-review covering seam inventory, dependency direction, test coverage, and risk checklist.
- [ ] Final message must cite files and include verification of `npm test` + `npm run verify` outputs.

## Phase 9 — Remaining Work Checklist (UI + Delivery)
- [ ] **Manual / Chat Builder UI**
  - [ ] Update `src/routes/+page.svelte` (and imported components) with manual form fields (title, numbered items, optional footer) plus alignment toggle (left/center) and list mode switch.
  - [ ] Include chat panel that loads `ChatInterpretationSeam` output and populates the same spec form.
  - [ ] Add debug panel showing current “Prompt / Revised prompt / Violations” using the latest seam outputs.
  - [ ] Connect the Generate flow to run `SpecValidationSeam` → `PromptAssemblySeam` → `ImageGenerationSeam` → `DriftDetectionSeam` → `OutputPackagingSeam` → `CreationStoreSeam` and surface errors.
- [ ] **Spec Validation & Prompt Constraints**
  - [ ] Confirm `src/lib/adapters/spec-validation.adapter.ts` enforces max items/label lengths so prompts stay ≤1024 chars.
  - [ ] Update `fixtures/spec-validation/sample.json` and `fixtures/spec-validation/fault.json` if adjustments are required.
  - [ ] Ensure `tests/contract/spec-validation.test.ts` covers both success and validation failure scenarios.
- [ ] **Creation Storage & Drafts**
  - [ ] Validate `src/lib/adapters/creation-store.adapter.ts` writes to `localStorage` keys `cb_creations_v1` and `cb_drafts_v1` and retains the 50-creation rolling window.
  - [ ] Ensure the UI uses `CreationStoreSeam` to list, save, favorite, and delete creations (including anonymous session owner metadata).
  - [ ] Refresh `fixtures/creation-store/*.json` and rerun `tests/contract/creation-store.test.ts`.
- [ ] **PWA polish**
  - [ ] Verify `static/manifest.webmanifest`, icon assets (`static/icons/*`), and service worker (if present) support Android install (name, short_name, display, start_url, theme_color).
  - [ ] Confirm `src/app.html` or layout includes the manifest + theme meta tags and the service worker registration script.
  - [ ] Run `npm run build` to ensure the PWA assets compile, then manually inspect `/build`.
- [ ] **Documentation / Evidence**
  - [ ] After final changes rerun `npm test` & `npm run verify`, copy outputs into `docs/evidence/YYYY-MM-DD/` (new folder for that date).
  - [ ] Update `DECISIONS.md` with any new Cipher Gate / Assumption entries stemming from UI/storage work.
  - [ ] Review `docs/seams.md` to refresh “Last probe” dates, ensure seam names remain PascalCase, and note `Probe: N/A` for pure seams.
  - [ ] Describe new UI flows in `README.md` or `AGENTS.md` if needed for non-coders (e.g., how to trigger chat builder or view debug panel).

## Phase 10 — Closure
- [ ] Confirm no helper modules perform I/O outside approved adapters (scan `rg -n 'fetch\\(' src lib` etc).
- [ ] Ensure every touched file still has the top-level comment describing purpose/why/info flow.
- [ ] Run `git status`, stage relevant files, and craft the final summary referencing file paths + verification commands.
## Anticipated Blockers & Safety Checks
- [ ] Check network access before probe runs; if locked, declare BLOCKED.
- [ ] Confirm `XAI_API_KEY` is never committed or logged.
- [ ] Avoid `any/as any` and `*Sync` I/O.
- [ ] Verify all helper modules route I/O through authorized seam adapters only.
