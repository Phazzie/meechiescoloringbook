# Remaining Work & Detailed Plan

## Work to finish
1. _UI / Workflow completion_
   - Wire the manual spec form and chat panel to create/mutate the spec object.
   - Surface the current assembled prompt, revised prompt, and any drift violations in the debug panel (Svelte component + state).
   - Gate the Generate action on `SpecValidationSeam` and pipe its output through the seam chain (Prompt → Image → Drift → Output → Storage).
2. _Spec validation + prompt constraints_
   - Confirm `spec-validation` rejects inputs that would exceed 1024 characters or violate item limits by referencing the spec schema.
   - Update fixtures/tests (`fixtures/spec-validation/`, `tests/contract/spec-validation.test.ts`) with both happy/fault cases aligned to the new UI data.
3. _Storage / drafts / session alignment_
   - Ensure `CreationStoreSeam` writes/reads `cb_creations_v1` + `cb_drafts_v1` via localStorage and enforces the 50-record cap.
   - UI should show saved creations, allow deletion/favorites, and persist a draft spec across refreshes via `SessionSeam` metadata.
4. _PWA / install prep_
   - Validate `static/manifest.webmanifest` and `static/icons/*` provide Android-ready metadata (display, theme color, start_url).
   - Confirm the service worker (if present) caches static assets and responds with fallbacks if offline.
   - Run `npm run build` to ensure the manifest + icons bundle cleanly.
5. _Documentation & evidence sweep_
   - After each change re-run `npm test` / `npm run verify`, copy outputs into a new `docs/evidence/<today>/` folder, and update `DECISIONS.md` with a new cipher entry documenting the change.
   - Refresh `docs/seams.md` to update owner/write status and highlight one-time source-of-truth rules (seam names in PascalCase, file names in kebab-case).

## Granular Plan Steps
1. **Manual + Chat builder (Svelte)**
   - Open `src/routes/+page.svelte`.
   - Add inputs for title, items, footer label, alignment toggles (left/center). Use Svelte stores/actions to keep spec state consistent.
   - Include the chat panel, a button that calls `ChatInterpretationSeam`, and patches the spec state with the mocked response.
   - Display `PromptAssemblySeam` output (prompt/revised prompt) in a debug panel along with `DriftDetectionSeam` violations.
   - Trigger generation via `OutputPackagingSeam` after passing validation and show result thumbnails.
2. **Spec Validation + Prompt Limits**
   - Update `contracts/spec-validation.contract.ts` to document min/max items, label length, and disallowed characters.
   - Adjust `src/lib/adapters/spec-validation.adapter.ts` to enforce these limits, emitting clear errors for UI binding.
   - Refresh `fixtures/spec-validation/sample.json` and `fault.json`, then regenerate `tests/contract/spec-validation.test.ts` cases to cover both success and failure.
3. **Creation Storage + Draft Flow**
   - Revisit `src/lib/adapters/creation-store.adapter.ts` to confirm `localStorage` persistence, `cb_creations_v1`, `cb_drafts_v1`, and owner metadata (anonymous session id).
   - Ensure the adapter exposes `listCreates`, `saveCreation`, `deleteCreation`, `saveDraft`, `clearDraft` (per seam contract) and that the UI uses them.
   - Update `fixtures/creation-store/sample.json`/`fault.json` if needed and rerun `tests/contract/creation-store.test.ts` for both success and failure flows.
4. **PWA polish**
   - Confirm `manifest.webmanifest` includes `name`, `short_name`, `display`, `start_url`, `theme_color`, `background_color`, and `icons` entries with `sizes` for Android.
   - If a service worker exists (e.g., `src/service-worker.ts`), ensure it caches `/`, `/api/*`, and `static/icons/` and handles offline fallback.
   - Run `npm run build` and inspect the `build` folder to confirm the manifest and icons bundled properly.
5. **Docs + Evidence Maintenance**
   - For every change rerun `npm test`/`npm run verify` and copy outputs into `docs/evidence/<today>/`.
   - Update `CHANGELOG.md`, `LESSONS_LEARNED.md`, and `DECISIONS.md` (Cipher Gate entry) describing the work.
   - Keep `AGENTS.md` and `docs/seams.md` in sync with naming rules, plan requirements, and new seam owners.
