<!--
Purpose: Provide a step-by-step completion checklist for Seam-Driven Development work.
Why: Ensure every step is verifiable with evidence or a concrete file path.
Info flow: Plan -> commands -> evidence -> decisions -> completion.
-->
# Seam-Driven Development Checklist

> Every checklist item below must be tied to a tangible artifact: a specific file path or a command output captured under `docs/evidence/YYYY-MM-DD/`.

## Phase 0 - Orientation (docs-only prep)
- [ ] Read `AGENTS.md`, `DECISIONS.md`, and `docs/seams.md` (confirm Wu-Bob roster and governance).
- [ ] Record the Plan + Self-Critique with seam names, file paths, and commands before edits.
- [ ] Create today's evidence folder under `docs/evidence/YYYY-MM-DD/`.

## Phase 1 - Code inventory (confirm implementation exists)
- [ ] UI flow is implemented in `src/routes/+page.svelte` (manual builder, chat builder, validation gating, generation chain, debug panel, saved creations).
- [ ] Server endpoints exist in `src/routes/api/chat-interpretation/+server.ts` and `src/routes/api/image-generation/+server.ts`.
- [ ] Adapters exist for all seams under `src/lib/adapters/`.
- [ ] Mocks exist for all seams under `src/lib/mocks/`.
- [ ] Contracts exist for all seams under `contracts/`.
- [ ] Contract tests exist under `tests/contract/`.
- [ ] PWA assets exist in `src/app.html`, `static/manifest.webmanifest`, `static/icons/`, and `src/service-worker.ts`.

## Phase 2 - Provider probes (real-world behavior)
- [ ] Load credentials with `set -a; source .env; set +a` (exports variables from `.env` for the current shell).
- [ ] Run `node probes/provider-adapter.probe.mjs` and save output to `docs/evidence/YYYY-MM-DD/probe-provider-adapter.txt`.
- [ ] Run `node probes/chat-interpretation.probe.mjs` and save output to `docs/evidence/YYYY-MM-DD/probe-chat-interpretation.txt`.
- [ ] Run `node probes/image-generation.probe.mjs` and save output to `docs/evidence/YYYY-MM-DD/probe-image-generation.txt`.
- [ ] If any probe is blocked, record an Assumption entry (a dated blocked-probe note) in `DECISIONS.md`, run `npm run assumption:alarm`, and stop.

## Phase 3 - Fixtures refresh (probe-backed)
- [ ] Update `fixtures/provider-adapter/` to match the latest probe outputs.
- [ ] Update `fixtures/chat-interpretation/` to match the latest probe outputs.
- [ ] Update `fixtures/image-generation/` to match the latest probe outputs.

## Phase 4 - Contract-first seam verification
- [ ] Run `npm run rewind -- --seam AuthContextSeam` (the `--seam` flag selects a single seam contract test) and save output to `docs/evidence/YYYY-MM-DD/rewind-auth-context-seam.txt`.
- [ ] Run `npm run rewind -- --seam CreationStoreSeam` and save output to `docs/evidence/YYYY-MM-DD/rewind-creation-store-seam.txt`.
- [ ] Run `npm run rewind -- --seam PromptAssemblySeam` and save output to `docs/evidence/YYYY-MM-DD/rewind-prompt-assembly-seam.txt`.
- [ ] Run `npm run rewind -- --seam ChatInterpretationSeam` and save output to `docs/evidence/YYYY-MM-DD/rewind-chat-interpretation-seam.txt`.
- [ ] Run `npm run rewind -- --seam ImageGenerationSeam` and save output to `docs/evidence/YYYY-MM-DD/rewind-image-generation-seam.txt`.
- [ ] Run `npm run rewind -- --seam DriftDetectionSeam` and save output to `docs/evidence/YYYY-MM-DD/rewind-drift-detection-seam.txt`.
- [ ] Run `npm run rewind -- --seam MeechieToolSeam` and save output to `docs/evidence/YYYY-MM-DD/rewind-meechie-tool-seam.txt`.
- [ ] Run `npm run rewind -- --seam ProviderAdapterSeam` and save output to `docs/evidence/YYYY-MM-DD/rewind-provider-adapter-seam.txt`.
- [ ] Run `npm run rewind -- --seam OutputPackagingSeam` and save output to `docs/evidence/YYYY-MM-DD/rewind-output-packaging-seam.txt`.
- [ ] Run `npm run rewind -- --seam SessionSeam` and save output to `docs/evidence/YYYY-MM-DD/rewind-session-seam.txt`.
- [ ] Run `npm run rewind -- --seam SpecValidationSeam` and save output to `docs/evidence/YYYY-MM-DD/rewind-spec-validation-seam.txt`.

## Phase 5 - Full verification (required for seam changes)
- [ ] Run `npm test` and save output to `docs/evidence/YYYY-MM-DD/npm-test.txt`.
- [ ] Run `npm run verify` and save output to `docs/evidence/YYYY-MM-DD/npm-verify.txt`.
- [ ] Confirm automation outputs exist under `docs/evidence/YYYY-MM-DD/` (chamber lock, shaolin lint, seam ledger, clan chain, proof tape, cipher gate).

## Phase 6 - PWA build validation
- [ ] Run `npm run build` and save output to `docs/evidence/YYYY-MM-DD/npm-build.txt`.
- [ ] Confirm the build output includes the manifest and icons (inspect the build folder or emitted assets list).

## Phase 7 - Documentation gates
- [ ] Update `DECISIONS.md` with a Cipher Gate entry (a dated evidence-linked change record).
- [ ] Update `CHANGELOG.md` with user-visible changes only.
- [ ] Update `LESSONS_LEARNED.md` with any new pitfalls or fixes.
- [ ] Update `docs/seams.md` with Last probe dates and notes that match evidence.
- [ ] Confirm every touched file starts with a Purpose/Why/Info flow comment.

## Phase 8 - Final status
- [ ] Capture `git status -sb` output to `docs/evidence/YYYY-MM-DD/git-status.txt`.
