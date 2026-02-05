<!--
Purpose: Track remaining work and the concrete steps to reach completion.
Why: Keep scope and verification explicit for Seam-Driven Development.
Info flow: Code inventory -> remaining tasks -> evidence and verification.
-->
# Remaining Work & Detailed Plan

## Governance reminder
- Any governance change still requires a micro Plan + Self-Critique with seams, file paths, and commands recorded before edits.
- Checklist items must be verifiable via file paths or evidence outputs under `docs/evidence/YYYY-MM-DD/`.

## Current code status (from the repository)
- Manual builder, chat builder, validation gating, generation chain, debug panel, and saved creations are implemented in `src/routes/+page.svelte`.
- Seam adapters and mocks exist for all listed seams under `src/lib/adapters/` and `src/lib/mocks/`.
- Server endpoints for chat and image generation exist in `src/routes/api/chat-interpretation/+server.ts` and `src/routes/api/image-generation/+server.ts`.
- PWA shell, manifest, icons, and service worker are present in `src/app.html`, `static/manifest.webmanifest`, `static/icons/`, and `src/service-worker.ts`.
- Contract tests exist for all seams in `tests/contract/`.
- Browser seam probes are implemented in `probes/browser-seams.probe.mjs` for Session/AuthContext/CreationStore.

## Completion status (2026-02-05)
- Browser seam probes ran and fixtures were refreshed (see `docs/evidence/2026-02-05/`).
- Seam rewinds, `npm test`, `npm run verify`, and `npm run build` completed with evidence captured.
- No remaining tasks for v1; rerun probes and verification when seams change.

## Remaining work to reach completion
None. All required Seam-Driven Development steps are complete for v1 with evidence captured on 2026-02-05.

## Granular Plan Steps
1. **Browser seam probe + fixture refresh**
   - Run `node probes/browser-seams.probe.mjs`.
   - If outputs differ, refresh `fixtures/session/sample.json`, `fixtures/auth-context/sample.json`, and `fixtures/creation-store/sample.json`.
2. **Seam-scoped tests (contract-first)**
   - Run `npm run rewind -- --seam <SeamName>` for each seam (the `--seam` flag selects a single seam contract test).
   - Capture each output in `docs/evidence/YYYY-MM-DD/rewind-<seam>.txt`.
3. **Provider probes + fixture refresh**
   - Run `node probes/provider-adapter.probe.mjs`, `node probes/chat-interpretation.probe.mjs`, and `node probes/image-generation.probe.mjs`.
   - If outputs differ, refresh `fixtures/*/sample.json` and `fixtures/*/fault.json` accordingly.
4. **Full verification**
   - Run `npm test` and `npm run verify`, capturing outputs in `docs/evidence/YYYY-MM-DD/`.
5. **PWA build validation**
   - Run `npm run build` and confirm manifest + icons are emitted in the build output.
6. **Documentation gates**
   - Update `DECISIONS.md` with a Cipher Gate entry referencing the evidence paths.
   - Update `CHANGELOG.md` and `LESSONS_LEARNED.md` with evidence-backed notes.

## Detailed checklist
Use `docs/CHECKLIST.md` for the step-by-step completion checklist.
