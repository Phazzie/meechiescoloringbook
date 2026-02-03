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

## Remaining work to reach completion
1. **Verification + evidence capture**
   - Run seam-scoped contract tests, then `npm test` and `npm run verify`.
   - Save outputs under `docs/evidence/YYYY-MM-DD/` and update `DECISIONS.md` with a Cipher Gate entry.
2. **Real-world probes + fixtures**
   - Run provider/chat/image probes with credentials, and refresh fixtures if outputs change.
   - Record Assumption entries if probes are blocked.
3. **Fix any failing probes/tests**
   - Apply only the minimal changes required to satisfy contract tests and probes.
4. **PWA build check**
   - Run `npm run build` and verify manifest + icons are emitted.
5. **Docs sweep**
   - Update `CHANGELOG.md`, `LESSONS_LEARNED.md`, and `docs/seams.md` with evidence-backed status.

## Granular Plan Steps
1. **Seam-scoped tests (contract-first)**
   - Run `npm run rewind -- --seam <SeamName>` for each seam (the `--seam` flag selects a single seam contract test).
   - Capture each output in `docs/evidence/YYYY-MM-DD/rewind-<seam>.txt`.
2. **Probes + fixture refresh**
   - Run `node probes/provider-adapter.probe.mjs`, `node probes/chat-interpretation.probe.mjs`, and `node probes/image-generation.probe.mjs`.
   - If outputs differ, refresh `fixtures/*/sample.json` and `fixtures/*/fault.json` accordingly.
3. **Full verification**
   - Run `npm test` and `npm run verify`, capturing outputs in `docs/evidence/YYYY-MM-DD/`.
4. **PWA build validation**
   - Run `npm run build` and confirm manifest + icons are emitted in the build output.
5. **Documentation gates**
   - Update `DECISIONS.md` with a Cipher Gate entry referencing the evidence paths.
   - Update `CHANGELOG.md` and `LESSONS_LEARNED.md` with evidence-backed notes.

## Detailed checklist
Use `docs/CHECKLIST.md` for the step-by-step completion checklist.
