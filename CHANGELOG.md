<!--
Purpose: Record user-visible changes for this repo.
Why: Provide a clear history of behavior changes and releases.
Info flow: Changes -> entries -> release communication.
-->

# Changelog

All notable user-visible changes for this repo.

## Unreleased

- `[TICK-003]`: Defused 4 critical zero-trust vulnerabilities identified during adversarial audit (async state leaks, validation race conditions, regex memory bomb, and silent retry DOS loops).
- `[TICK-002d]`: Replaced hardcoded E2E network stubs with strict SDD-compliant API routing and validated against contract fixtures to ensure full backend integration testing.
- `[TICK-002e]`: Enforced robust UI error states and hydration handling during network failure/timeout events.
- `[TICK-002a]`: Migrated the active xAI text configuration, fixtures, probes, tests, and current documentation from the retired model to the key-accessible `grok-4.3`; one real `/api/chat-interpretation` request returned HTTP 200 with a contract-valid result.
- `[TICK-002b]`: Confirmed `grok-imagine-image` is exposed to the configured key and passed the line-art prompt/safety/drift preflight; the single authorized live image request remained inconclusive because the PowerShell client did not recover its response status or body, and no retry was made.
- Isolated `/api/generate` unit coverage from the live image provider so installing a real `.env` key cannot turn the test suite into billable xAI traffic.
- `[TICK-001f1]`: Repaired the nested design-token structure and replaced the remaining child/family design language with the approved adult high-glam verdict direction.
- `[TICK-001i5]`: Corrected Random Meechie's metadata to describe the actual one-tap interaction and verified exactly one description across server rendering and client navigation.
- Repaired `.env.example` from an unusable base64 blob into plain placeholder-only environment documentation and updated its text-model default to `grok-4.3`.
- `[TICK-001i0]`: Made global `<meta name="description">` fallback route-aware in `src/routes/+layout.svelte` to prevent duplicate meta tag accumulation on target sub-page routes.
- `[TICK-001i1]`: Added persona-aligned route meta descriptions to `src/routes/who-fucked-up/+page.svelte` and `src/routes/rate-his-excuse/+page.svelte` while retaining existing titles.
- `[TICK-001i2]`: Added persona-aligned route meta descriptions to `src/routes/random/+page.svelte` and `src/routes/meechie/+page.svelte` while retaining existing titles.
- `[TICK-001e]`: Reoriented home-page hero section copy in `src/lib/components/studio/StudioHero.svelte` around the Adult Cultural Verdict Persona.
- `[TICK-001f]`: Aligned `design.md` visual tokens and `README.md` intro copy with the Adult Cultural Verdict Persona while preserving setup instructions and provider configs.
- `[TICK-001h]`: Audited `src/lib/adapters/meechie-tool.adapter.ts` against the 5 locked canonical quotes; verified 0 code drift with clean contract tests.
- `[TICK-002c]`: Verified deterministic mock and offline fallback behavior in `tests/contract/meechie-voice.test.ts` with zero live API calls.
- `[TICK-001b]` & `[TICK-001d]`: Added global SEO, OpenGraph, and Twitter Card metadata tags in `src/routes/+layout.svelte` aligned with Adult Relationship Verdict Persona, and verified header navigation.
- `[TICK-001a]`: Deferred Wig Try-On Studio section on Home Page (`src/routes/+page.svelte`) for Phase 1 MVP focus.
- Re-oriented project documentation (`design.md`, `README.md`, reports) to accurately reflect Meechie's adult cultural verdict & high-glam statement coloring persona.
- Locked `meechieVoicePack` quote pools and sample fixtures **EXCLUSIVELY** to the 5 canonical Meechie quotes.
- Established a 5-phase operational release roadmap deferring the Virtual Wig Try-On feature for MVP launch.
- Added a local PR backlog dry-run validation script (`scripts/validate-pr-backlog.js`) to automate checking out, testing, and verifying clean PR candidates.
- Added a review-comment extraction script (`scripts/get-pr-todos.js`) to isolate and scope active review threads for a specific PR.
- Added a real-time merge conflict analysis script (`scripts/analyze-merge-conflicts.js`) to test all open PR branches for merge conflicts and update the triage table.
- Fully redesigned the builder and Meechie pages with a cleaner modern visual system, clearer hierarchy, and polished action flows on desktop/mobile.
- Moved Meechie tools to a dedicated destination path from the main builder flow and added a focused handoff card.
- Added a temporary UI API key panel (save/load/clear/show) and propagated `x-api-key` from client requests to generation endpoints.
- Improved image-generation failure handling with clearer status codes and actionable missing-key messaging.
- Refactored `/api/generate` orchestration into `src/lib/core/generate-pipeline.ts` so the route is a thin transport wrapper.
- Refactored `/api/chat-interpretation` and `/api/tools` into core pipelines so both routes are now thin wrappers with centralized validation/safety behavior.
- Retired the unused legacy generation workflow/composition path so active runtime flow is only the current endpoint-pipeline architecture.
- Added shared prompt-template helpers in `src/lib/core/prompt-template.ts` and refactored PromptAssemblySeam/DriftDetectionSeam to use one wording source.
- Added shared client request helpers in `src/lib/core/http-client.ts` and refactored builder + Meechie tool fetch paths to use it.
- Refreshed MeechieVoiceSeam and fixture-backed Meechie tool copy to match the latest power-first tone pattern.
- Centralized Meechie voice copy in MeechieVoiceSeam and routed Meechie tools through the voice pack.
- Made image-generation prompt phrase checks case-insensitive to avoid false negatives when validating prompts.
- Wired the main UI and chat builder to enforce the full seam loop (SpecValidation → PromptAssembly → ImageGeneration → DriftDetection → OutputPackaging → CreationStore), gating Generate on validation, surfacing prompt/drift debug info, and adding creation favorites/deletion plus draft persistence.
- Added Manifest + Android-ready PNG/maskable icons for Meechie's Coloring Book PWA alongside the existing SVG asset.
- Added server-side xAI chat/image endpoints with client adapters calling `/api/chat-interpretation` and `/api/image-generation`.
- Added PWA manifest, icon, and service worker registration for Android installability.
- Embedded Meechie tools directly in the main page and reused the component for `/meechie`.
- Tweaked default page style to include minimal decorations and a decorative border for sparkle-friendly prompts.
- Added optional dedication line support in the spec and prompt assembly.
- Added square and group-chat share exports in output packaging.
- Added a sparkle overlay preview toggle in the output gallery.
- Added local environment template and secret ignore rules for safe configuration.
- Recorded Seam-Driven Development governance decisions and seam inventory for project setup.
- Implemented seam contracts, fixtures, mocks, adapters, and contract tests for all v1 seams.
- Added deterministic SVG rendering, drift detection, and client-side PDF/PNG packaging.
- Built the worksheet-style UI with manual builder, chat stub, debug panel, and saved creation list.
- Aligned prompt assembly with left/center alignment, centered list columns when requested, and removed decorative instructions to match constraints.
- Added alignment phrase checks to drift detection and reinforced deterministic SVG layout assertions.
- Added a shared alignment-line utility so PromptAssemblySeam, DriftDetectionSeam, fixtures, and probes all emit the “all numbers vertically aligned; all text left-aligned; treat blank space as intentional; do not fill empty space” sentence, eliminating drift between seams.
- Removed external font loading and ensured SVG-to-PNG/PDF outputs render on white backgrounds.
- Expanded user options (list mode/gutter, typography, color, decorations, illustrations, shading, border, and page size) with deterministic prompt + renderer enforcement.
- Added title-only drift detection coverage and dense/scene renderer proof fixtures for deterministic SVG output.
- Added seam ledger and proof tape automation outputs to improve proof visibility for non-coders.
- Added clan chain evidence summaries to flag clean vs dirty seams.
- Added cipher gate automation to require evidence-linked proof summaries in decisions.
- Added assumption alarm automation to enforce logged blocked-probe assumptions.
- Replaced the default README with project-specific Seam-Driven Development and Wu-Tang coding context.
- Expanded the README explanation to be more relatable for non-coders.
- Expanded README explanation to include integration-first seams and synthesis benefits.
- Added git hooks and CI verify workflow to enforce Seam-Driven Development gates automatically.
- Documented the local git hook install step in the README.
- Clarified that hooks should be installed after cloning.
- Added Meechie tools UI with deterministic templates behind a new seam.
- Added explicit Wu-Bob response formatting in AGENTS guidance.
- Updated Wu-Bob response guidance to a combined voice format.
- Added AI-agent reference notes plus a Seam-Driven Development checklist to keep plans and evidence explicit for autonomous agents.
- Shortened the canonical prompt template to fit the xAI 1024-character limit, updated drift checks, fixtures, and probes to match, and clarified negative/option line phrasing.
