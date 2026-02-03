<!--
Purpose: Decision log for architecture and process choices.
Why: Preserve rationale and prevent re-litigation.
Info flow: Decision -> consequences -> future changes.
-->
# Decisions

Short, durable decisions with context and tradeoffs.

## Template
- Date:
- Decision:
- Context:
- Alternatives:
- Consequences:
- Revisit criteria:

## 2026-01-26 - Add AI agent reference notes to AGENTS.md
- Date: 2026-01-26
- Decision: Add a short AI agent reference notes section to `AGENTS.md` pointing to sources of truth, naming rules, and evidence locations.
- Context: The user requested concise notes an AI coding agent can rely on without hunting through multiple files.
- Alternatives: Keep guidance scattered across `AGENTS.md` and rely on the master guide.
- Consequences: `AGENTS.md` grows slightly; no behavioral change to workflows.
- Revisit criteria: If the reference notes become too long or duplicate the master guide.
- Plan:
  - Goal: Add an AI reference section that summarizes sources of truth and evidence locations.
  - Files: `AGENTS.md`, `DECISIONS.md`.
  - Rule change: Governance guidance now includes an AI agent reference section.
  - Confirm: Docs-only change with zero behavioral impact.
- Self-critique: The risk is duplicating guidance and letting it drift; evidence is the added section in `AGENTS.md`.

## 2026-01-26 - Align probe prompt + required-phrase checks with canonical template
- Date: 2026-01-26
- Decision: Replace the ImageGenerationSeam probe prompt with the compressed canonical prompt and align required-phrase checks to that casing.
- Context: The probe still used the older verbose prompt (triggering a 400 length error), and required-phrase checks expected a lowercase prefix that no longer matches the canonical prompt.
- Alternatives: Keep the verbose prompt and accept probe failure, or make required-phrase checks case-insensitive.
- Consequences: The probe prompt and required-phrase checks now mirror the canonical template; if the template changes, these checks must be updated in lockstep.
- Revisit criteria: If the provider limit changes or a separate compressed provider prompt is introduced.
- Plan:
  - Goal: Align the probe prompt and required-phrase checks with the current canonical template and stay under 1024 characters.
  - Seams: ImageGenerationSeam, DriftDetectionSeam.
  - Files:
    - `probes/image-generation.probe.mjs`
    - `src/lib/adapters/image-generation.adapter.ts`
    - `src/lib/adapters/drift-detection.adapter.ts`
    - `DECISIONS.md`
  - Commands:
    - `npm test`
    - `npm run verify`
- Self-critique: The riskiest assumption is that matching casing is sufficient and won’t miss other required phrase drift; evidence will be the updated fixtures and green contract tests.

- Cipher Gate:
  - Date: 2026-01-26
  - Seams: ImageGenerationSeam
  - Evidence: docs/evidence/2026-01-26/test.txt; docs/evidence/2026-01-26/verify.txt
  - Summary: Aligned the image-generation probe prompt and required-phrase checks to the compressed canonical template to satisfy the 1024 limit.
  - Risks: Phrase checks can drift if the template changes without updating these checks.

## 2026-01-26 - Shorten canonical prompt to fit xAI 1024 limit
- Date: 2026-01-26
- Decision: Rewrite the canonical prompt template to stay under 1024 characters for typical specs and add a prompt-length guard in PromptAssemblySeam.
- Context: xAI image generation rejects prompts longer than 1024 characters; the previous template measured 1523 characters for the sample fixture.
- Alternatives: Keep the full template and add a separate compressed provider prompt, or reduce spec limits (items/labels).
- Consequences: Prompt assembly, drift detection, and fixtures must be updated together; long lists may still exceed the provider limit and will be rejected with a clear error.
- Revisit criteria: If xAI increases the limit or if we add a compressed provider prompt seam output.
- Plan:
  - Goal: Shorten the canonical prompt and enforce a 1024-char limit at prompt assembly.
  - Seams: PromptAssemblySeam, DriftDetectionSeam, ImageGenerationSeam.
  - Files:
    - `src/lib/adapters/prompt-assembly.adapter.ts`
    - `src/lib/adapters/drift-detection.adapter.ts`
    - `fixtures/prompt-assembly/sample.json`
    - `fixtures/prompt-assembly/title-only.json`
    - `fixtures/prompt-assembly/fault.json`
    - `fixtures/drift-detection/sample.json`
    - `fixtures/drift-detection/title-only.json`
    - `fixtures/drift-detection/fault.json`
    - `fixtures/image-generation/sample.json`
    - `fixtures/image-generation/dense-scene.json`
    - `tests/contract/prompt-assembly.test.ts`
    - `CHANGELOG.md`
    - `LESSONS_LEARNED.md`
    - `DECISIONS.md`
  - Commands:
    - `npm test`
    - `npm run verify`
- Self-critique: The riskiest assumption is that the shortened template still enforces all required constraints; evidence is the updated fixtures, drift detection tests, and prompt length measurement (<= 1024).

- Cipher Gate:
  - Date: 2026-01-26
  - Seams: PromptAssemblySeam, DriftDetectionSeam, ImageGenerationSeam
  - Evidence: docs/evidence/2026-01-26/test.txt; docs/evidence/2026-01-26/verify.txt
  - Summary: Shortened the canonical prompt and added a prompt-length guard to stay within the xAI 1024 limit.
  - Risks: Long lists can still exceed 1024; generation will fail fast until inputs are reduced or a compressed provider prompt is added.

## 2026-01-26 - Update xAI image model id to grok-2-image-1212
- Date: 2026-01-26
- Decision: Replace `grok-2-image` with `grok-2-image-1212` as the default image model.
- Context: Model inventory for the account lists `grok-2-image-1212` rather than `grok-2-image`.
- Alternatives: Keep `grok-2-image` until xAI confirms a stable alias.
- Consequences: Probe inputs and fixtures change; image probe may still 404 until access is confirmed.
- Revisit criteria: If the image endpoint remains 404 with the updated model id or xAI deprecates the model.
- Plan:
  - Goal: Update the xAI image model id across adapter, probes, and fixtures.
  - Seams: ProviderAdapterSeam, ImageGenerationSeam.
  - Files:
    - `src/routes/api/image-generation/+server.ts`
    - `probes/provider-adapter.probe.mjs`
    - `probes/image-generation.probe.mjs`
    - `fixtures/provider-adapter/sample.json`
    - `fixtures/provider-adapter/fault.json`
    - `fixtures/image-generation/sample.json`
    - `fixtures/image-generation/dense-scene.json`
  - Commands:
    - `npm test`
    - `npm run verify`
- Self-critique: The riskiest assumption is that `grok-2-image-1212` is accepted by the image endpoint; evidence will be the updated probe outputs and refreshed fixtures once the probe succeeds.

- Cipher Gate:
  - Date: 2026-01-26
  - Seams: ProviderAdapterSeam, ImageGenerationSeam
  - Evidence: docs/evidence/2026-01-25/test.txt; docs/evidence/2026-01-25/verify.txt; docs/evidence/2026-01-25/probe-provider-adapter.txt; docs/evidence/2026-01-25/probe-image-generation.txt
  - Summary: Updated xAI image model id to grok-2-image-1212 in server route, probes, and fixtures.
  - Risks: Image probe remains 404 until xAI image access/endpoint is confirmed.

## 2026-01-26 - Surface image probe error body
- Date: 2026-01-26
- Decision: Log the raw error body from the xAI image endpoint during probes.
- Context: The image probe returns 400 Bad Request without exposing details needed to fix the request.
- Alternatives: Manually re-run curl with the full prompt to capture the body.
- Consequences: Probe output may include large error payloads; no production behavior changes.
- Revisit criteria: Remove extra logging if probes consistently succeed.
- Plan:
  - Goal: Include response body in ImageGenerationSeam probe errors.
  - Seams: ImageGenerationSeam.
  - Files:
    - `probes/image-generation.probe.mjs`
    - `DECISIONS.md`
  - Commands:
    - `npm test`
    - `npm run verify`
- Self-critique: The riskiest assumption is that the endpoint returns a helpful error body; evidence will be the probe output containing the response body.

- Cipher Gate:
  - Date: 2026-01-26
  - Seams: ImageGenerationSeam
  - Evidence: docs/evidence/2026-01-25/test.txt; docs/evidence/2026-01-25/verify.txt; docs/evidence/2026-01-25/probe-image-generation.txt
  - Summary: Updated ImageGenerationSeam probe to surface raw error bodies for 400 responses.
  - Risks: Probe output may be verbose; image generation remains blocked until a successful probe.

## 2026-01-26 - Require plain-language definitions for jargon and flags
- Date: 2026-01-26
- Decision: Add a governance line in `AGENTS.md` requiring brief plain-language definitions when introducing jargon or flags.
- Context: Users asked for jargon and flags to be explained directly in the workflow guidance.
- Alternatives: Maintain a separate glossary only.
- Consequences: Future instructions must include short definitions for terms like deterministic or compressed provider prompt.
- Revisit criteria: If the glossary becomes large and needs its own dedicated doc.
- Plan:
  - Goal: Make jargon/flag explanations explicit in governance guidance.
  - Files: `AGENTS.md`, `DECISIONS.md`.
  - Rule change: Governance now requires plain-language definitions when introducing jargon or flags.
  - Confirm: Docs-only change with zero behavioral impact.
- Self-critique: The only risk is forgetting to add definitions in future notes; evidence is the new governance line in `AGENTS.md`.

- Cipher Gate:
  - Date: 2026-01-26
  - Seams: Governance
  - Evidence: docs/evidence/2026-01-26/test.txt; docs/evidence/2026-01-26/verify.txt
  - Summary: Added a governance rule to define jargon/flags in plain language.
  - Risks: None beyond enforcement drift if definitions are skipped.

## 2026-01-25 - Seam-Driven Development plan (probe refresh + optional features) + self-critique
- Date: 2026-01-25
- Decision: Refresh xAI probe fixtures now that network access is available; add optional features (dedication line, share exports, sparkle preview overlay) via seam-safe updates.
- Context: User requested autonomous progress and as many optional features as possible without shortcuts.
- Alternatives: Defer probes and optional features to separate changes or keep the UI minimal.
- Consequences: Multiple seam fixtures, adapters, and tests must change in lockstep; evidence must be refreshed.
- Revisit criteria: If xAI probe outputs fail to parse into contracts or share exports compromise print fidelity.
- Plan:
  - Goal: Run probes to replace stubbed fixtures, add dedication line to specs/prompt/drift checks, and add square/chat export variants plus sparkle preview overlay.
  - Seams: ProviderAdapterSeam, ChatInterpretationSeam, ImageGenerationSeam, SpecValidationSeam, PromptAssemblySeam, DriftDetectionSeam, OutputPackagingSeam.
  - Files:
    - `probes/provider-adapter.probe.mjs`
    - `probes/chat-interpretation.probe.mjs`
    - `probes/image-generation.probe.mjs`
    - `fixtures/provider-adapter/sample.json`
    - `fixtures/provider-adapter/fault.json`
    - `fixtures/chat-interpretation/sample.json`
    - `fixtures/chat-interpretation/fault.json`
    - `fixtures/image-generation/sample.json`
    - `fixtures/image-generation/fault.json`
    - `contracts/spec-validation.contract.ts`
    - `fixtures/spec-validation/sample.json`
    - `fixtures/spec-validation/fault.json`
    - `src/lib/adapters/spec-validation.adapter.ts`
    - `contracts/prompt-assembly.contract.ts`
    - `fixtures/prompt-assembly/sample.json`
    - `fixtures/prompt-assembly/fault.json`
    - `src/lib/adapters/prompt-assembly.adapter.ts`
    - `contracts/drift-detection.contract.ts`
    - `fixtures/drift-detection/sample.json`
    - `fixtures/drift-detection/fault.json`
    - `src/lib/adapters/drift-detection.adapter.ts`
    - `tests/contract/prompt-assembly.test.ts`
    - `tests/contract/drift-detection.test.ts`
    - `contracts/output-packaging.contract.ts`
    - `fixtures/output-packaging/sample.json`
    - `fixtures/output-packaging/fault.json`
    - `src/lib/mocks/output-packaging.mock.ts`
    - `src/lib/adapters/output-packaging.adapter.ts`
    - `tests/contract/output-packaging.test.ts`
    - `src/routes/+page.svelte`
    - `docs/seams.md`
    - `DECISIONS.md`
    - `CHANGELOG.md`
    - `LESSONS_LEARNED.md`
  - Commands:
    - `node probes/provider-adapter.probe.mjs`
    - `node probes/chat-interpretation.probe.mjs`
    - `node probes/image-generation.probe.mjs`
    - `npm test`
    - `npm run verify`
- Self-critique: The riskiest assumption is that share-export resizing won’t distort print-ready assets; evidence will be updated output-packaging fixtures and contract tests. Another risk is that dedication text introduces heading drift or invalid characters; evidence will be updated prompt fixtures, drift checks, and validation errors.

## 2026-01-25 - Dedication line placement
- Date: 2026-01-25
- Decision: Add dedication text as an optional layout line (no new headings) using the exact phrase `Add a small script dedication at the bottom: "Dedicated to <name>".`.
- Context: Dedication must appear on generated pages without violating the locked heading list.
- Alternatives: Add a new DEDICATION heading or repurpose footer items.
- Consequences: Prompt assembly and drift detection must include the exact dedication line when provided.
- Revisit criteria: If future template changes permit new headings without breaking drift checks.

## 2026-01-25 - Share export variants
- Date: 2026-01-25
- Decision: Add OutputPackagingSeam variants for `square` (1080x1080) and `chat` (720x720) while keeping `print` outputs unchanged.
- Context: Users need share-ready outputs without compromising print fidelity.
- Alternatives: Add separate share-export seams or generate variants in the UI.
- Consequences: OutputPackagingSeam now handles resizing in the browser and emits multiple files.
- Revisit criteria: If resizing introduces quality issues or if print fidelity is affected.

- Cipher Gate:
  - Date: 2026-01-25
  - Seams: SpecValidationSeam, PromptAssemblySeam, DriftDetectionSeam, OutputPackagingSeam
  - Evidence: docs/evidence/2026-01-25/verify.txt; docs/evidence/2026-01-25/test.txt; docs/evidence/2026-01-25/probe-provider-adapter.txt; docs/evidence/2026-01-25/probe-chat-interpretation.txt; docs/evidence/2026-01-25/probe-image-generation.txt
  - Summary: Added dedication line support and share export variants; updated prompt/drift fixtures and output packaging behavior; chat/provider probes ran, image probe returned 404.
  - Risks: Share resizing quality and blocked image generation probe until xAI endpoint access is confirmed.

## 2026-01-25 - xAI probe status update (image endpoint)
- Date: 2026-01-25
- Decision: Record probe results: chat/provider probes completed; image generation probe returned 400 with a 1024-character prompt length limit.
- Context: DNS resolution was restored on the host and probes were run with a valid API key.
- Alternatives: Ignore the 400 and continue with stubbed image fixtures.
- Consequences: ImageGenerationSeam remains blocked; fixtures stay stubbed until the endpoint or access issue is resolved.
- Revisit criteria: Adjust prompt assembly to stay within 1024 characters or select a provider with a higher prompt limit, then rerun probes.

## 2026-01-24 - Seam-Driven Development plan (xAI integration + PWA) + self-critique
- Date: 2026-01-24
- Decision: Proceed with Seam-Driven Development updates for ProviderAdapterSeam, ChatInterpretationSeam, and ImageGenerationSeam to integrate xAI chat/image calls, add probes/fixtures, and add PWA install assets.
- Context: User requires xAI-backed image generation and chat, plus Android-installable PWA and removal of hidden Meechie-only route.
- Alternatives: Keep deterministic SVG and chat stubs; defer PWA work to a separate change.
- Consequences: Network I/O moves into ProviderAdapterSeam, fixtures change to real xAI outputs, contract tests and adapters must be updated, and new PWA files/registration are added.
- Revisit criteria: If xAI responses cannot be parsed into the required contracts or PWA assets cause build issues.
- Plan:
  - Goal: Integrate xAI chat/image behind ProviderAdapterSeam and expose chat/image via server endpoints; update seam fixtures/tests; add PWA manifest/service worker; merge Meechie tools into main UI.
  - Seams: ProviderAdapterSeam, ChatInterpretationSeam, ImageGenerationSeam.
  - Files:
    - `probes/provider-adapter.probe.mjs`
    - `probes/chat-interpretation.probe.mjs`
    - `probes/image-generation.probe.mjs`
    - `fixtures/provider-adapter/sample.json`
    - `fixtures/provider-adapter/fault.json`
    - `fixtures/chat-interpretation/sample.json`
    - `fixtures/chat-interpretation/fault.json`
    - `fixtures/image-generation/sample.json`
    - `fixtures/image-generation/fault.json`
    - `fixtures/image-generation/dense-scene.json`
    - `src/lib/mocks/provider-adapter.mock.ts`
    - `src/lib/mocks/chat-interpretation.mock.ts`
    - `src/lib/mocks/image-generation.mock.ts`
    - `src/lib/adapters/provider-adapter.adapter.ts`
    - `src/lib/adapters/chat-interpretation.adapter.ts`
    - `src/lib/adapters/image-generation.adapter.ts`
    - `tests/contract/provider-adapter.test.ts`
    - `tests/contract/chat-interpretation.test.ts`
    - `tests/contract/image-generation.test.ts`
    - `src/routes/api/chat-interpretation/+server.ts`
    - `src/routes/api/image-generation/+server.ts`
    - `src/routes/+page.svelte`
    - `src/routes/+layout.svelte`
    - `src/routes/meechie/+page.svelte`
    - `src/lib/components/MeechieTools.svelte`
    - `src/app.html`
    - `src/service-worker.ts`
    - `static/manifest.webmanifest`
    - `static/icon.svg`
    - `.env.example`
    - `docs/seams.md`
    - `DECISIONS.md`
    - `CHANGELOG.md`
    - `LESSONS_LEARNED.md`
  - Commands:
    - `node probes/provider-adapter.probe.mjs`
    - `node probes/chat-interpretation.probe.mjs`
    - `node probes/image-generation.probe.mjs`
    - `npm test`
    - `npm run verify`
- Self-critique: The riskiest assumption is that xAI responses will remain parseable into strict contracts; evidence will be probe outputs, updated fixtures, and contract test results. Another risk is accidentally leaking secrets to the client; evidence will be server-only API usage and absence of API keys in client bundles or config. PWA installability could be incomplete without a service worker; evidence will be the manifest, service worker registration, and build outputs.

- Assumption:
  - Date: 2026-01-24
  - Seams: ProviderAdapterSeam, ChatInterpretationSeam, ImageGenerationSeam
  - Statement: DNS resolution is unavailable in the current environment, so xAI probe calls cannot complete and fixtures remain stubbed.
  - Validation: Restore DNS/network access and rerun `node probes/provider-adapter.probe.mjs`, `node probes/chat-interpretation.probe.mjs`, and `node probes/image-generation.probe.mjs` to refresh fixtures and evidence.
  - Status: blocked

## 2026-01-24 - xAI provider integration (chat + image)
- Date: 2026-01-24
- Decision: Use xAI endpoints via ProviderAdapterSeam, with server-side API routes for chat interpretation and image generation and client adapters calling those routes.
- Context: The app must use xAI for chat and image generation while keeping API keys off the client.
- Alternatives: Keep deterministic SVG generation and chat stubs or push xAI calls to the client.
- Consequences: ProviderAdapterSeam now owns network I/O; ImageGenerationSeam and ChatInterpretationSeam become network-backed via server routes; probes are required once DNS is available.
- Revisit criteria: If xAI responses cannot be parsed reliably or if server routing adds unacceptable latency.

## 2026-01-24 - PWA installability + Meechie embedding
- Date: 2026-01-24
- Decision: Add a PWA manifest/icon/service worker and embed Meechie tools on the main page while keeping the `/meechie` route as a deep link.
- Context: The app must be installable on Android and Meechie tools must not be hidden behind a separate URL.
- Alternatives: Defer PWA work or keep Meechie tools on a standalone route only.
- Consequences: Additional static assets and service worker registration are required; main page layout now includes Meechie tools.
- Revisit criteria: If PWA caching causes stale asset issues or if Meechie tools need separate branding.

- Cipher Gate:
  - Date: 2026-01-25
  - Seams: ProviderAdapterSeam, ChatInterpretationSeam, ImageGenerationSeam
  - Evidence: docs/evidence/2026-01-25/verify.txt; docs/evidence/2026-01-25/test.txt; docs/evidence/2026-01-24/probe-provider-adapter.txt; docs/evidence/2026-01-24/probe-chat-interpretation.txt; docs/evidence/2026-01-24/probe-image-generation.txt
  - Summary: Implemented xAI-backed provider adapter and server routes, updated client adapters/tests/fixtures, added PWA assets, and embedded Meechie tools in the main UI; probes are blocked due to DNS.
  - Risks: xAI probes failed because DNS resolution is unavailable; fixtures remain stubbed until probes can run.

## 2026-01-22 - Seam-Driven Development plan (option expansion) + self-critique
- Date: 2026-01-22
- Decision: Expand user options across spec, prompt, drift detection, renderer, packaging, and UI with full Seam-Driven Development workflow and evidence.
- Context: User approved adding all option buckets (alignment, list gutter, footer toggle, title-only mode, decorations/illustrations/shading, color, A4 size, typography).
- Alternatives: Stage the options in smaller batches or keep high-impact options out of v1.
- Consequences: Multiple seams and fixtures will change; tests and evidence must be rerun.
- Revisit criteria: If any new option cannot be enforced deterministically without violating core constraints.
- Plan:
  - Goal: add all approved options with deterministic behavior and drift enforcement.
  - Seams: SpecValidationSeam, PromptAssemblySeam, DriftDetectionSeam, ImageGenerationSeam, OutputPackagingSeam, ChatInterpretationSeam, CreationStoreSeam.
  - Files:
    - `contracts/spec-validation.contract.ts`
    - `contracts/prompt-assembly.contract.ts`
    - `contracts/drift-detection.contract.ts`
    - `contracts/image-generation.contract.ts`
    - `contracts/output-packaging.contract.ts`
    - `contracts/creation-store.contract.ts`
    - `contracts/chat-interpretation.contract.ts`
    - `fixtures/spec-validation/sample.json`
    - `fixtures/spec-validation/fault.json`
    - `fixtures/prompt-assembly/sample.json`
    - `fixtures/prompt-assembly/fault.json`
    - `fixtures/drift-detection/sample.json`
    - `fixtures/drift-detection/fault.json`
    - `fixtures/image-generation/sample.json`
    - `fixtures/image-generation/fault.json`
    - `fixtures/output-packaging/sample.json`
    - `fixtures/output-packaging/fault.json`
    - `fixtures/chat-interpretation/sample.json`
    - `fixtures/chat-interpretation/fault.json`
    - `fixtures/creation-store/sample.json`
    - `fixtures/creation-store/fault.json`
    - `src/lib/mocks/spec-validation.mock.ts`
    - `src/lib/mocks/prompt-assembly.mock.ts`
    - `src/lib/mocks/drift-detection.mock.ts`
    - `src/lib/mocks/image-generation.mock.ts`
    - `src/lib/mocks/output-packaging.mock.ts`
    - `src/lib/mocks/chat-interpretation.mock.ts`
    - `src/lib/mocks/creation-store.mock.ts`
    - `src/lib/adapters/spec-validation.adapter.ts`
    - `src/lib/adapters/prompt-assembly.adapter.ts`
    - `src/lib/adapters/drift-detection.adapter.ts`
    - `src/lib/adapters/image-generation.adapter.ts`
    - `src/lib/adapters/output-packaging.adapter.ts`
    - `src/lib/adapters/chat-interpretation.adapter.ts`
    - `src/lib/adapters/creation-store.adapter.ts`
    - `tests/contract/spec-validation.test.ts`
    - `tests/contract/prompt-assembly.test.ts`
    - `tests/contract/drift-detection.test.ts`
    - `tests/contract/image-generation.test.ts`
    - `tests/contract/output-packaging.test.ts`
    - `tests/contract/chat-interpretation.test.ts`
    - `tests/contract/creation-store.test.ts`
    - `src/routes/+page.svelte`
    - `DECISIONS.md`
    - `CHANGELOG.md`
    - `LESSONS_LEARNED.md`
  - Commands: `npm run check`, `npm test`, `npm run verify`.
- Self-critique: The riskiest assumption is that all new options can be expressed deterministically in the prompt and SVG renderer without violating the “blank space is intentional” rule; evidence will be updated fixtures, drift checks, and renderer contract tests. Another risk is option explosion causing mismatched defaults across seams; evidence will be consistent default values in contracts, adapters, fixtures, and UI.

## 2026-01-22 - Option sets and defaults (v1 expansion)
- Date: 2026-01-22
- Decision: Add v1 option enums and defaults: listMode (`list`/`title_only`), listGutter (`tight`/`normal`/`loose`), fontStyle (`rounded`/`block`/`hand`), textStrokeWidth (4–12, default 6), colorMode (`black_and_white_only`/`grayscale`/`color`), decorations (`none`/`minimal`/`dense`), illustrations (`none`/`simple`/`scene`), shading (`none`/`hatch`/`stippling`), border (`none`/`plain`/`decorative`), borderThickness (2–16, default 8).
- Context: User requested all option buckets; we need explicit, testable values.
- Alternatives: Fewer options or unbounded user-defined values.
- Consequences: Contracts, fixtures, prompt assembly, drift detection, renderer, and UI must stay in lockstep.
- Revisit criteria: If option combinations produce unreadable layouts or prompt drift becomes hard to detect.

## 2026-01-22 - A4 dimension mapping (renderer + packaging)
- Date: 2026-01-22
- Decision: Use A4 size at 300 DPI as 2480×3508 px in SVG renderer; PDF packaging uses A4 at 595×842 pt.
- Context: Page size is now a user option and must be deterministic in output.
- Alternatives: Use 2481×3507 px or derive from inches at runtime.
- Consequences: Renderer and packaging align on a fixed mapping for tests and fixtures.
- Revisit criteria: If print output shows off-by-one scaling or PDF layout mismatch.

## 2026-01-22 - Deterministic decoration + shading rendering
- Date: 2026-01-22
- Decision: Decorations/illustrations render as fixed outline shapes; shading uses hatch or stippling patterns applied only to those shapes; stroke color is driven by colorMode.
- Context: New style options must remain deterministic and testable without external dependencies.
- Alternatives: Randomized placement or rasterized shading.
- Consequences: Output remains deterministic; drift detection can enforce prompt lines without ambiguity.
- Revisit criteria: If shapes interfere with text or require a more advanced layout engine.

## 2026-01-22 - Wu-Bob roster change (micro plan + self-critique)
- Date: 2026-01-22
- Decision: Change Wu-Bob roster to Uncle Bob + RZA + Inspectah Deck.
- Context: User requested a roster change to emphasize clean-code discipline (Uncle Bob), system vision (RZA), and architectural inspection rigor (Inspectah Deck) during upcoming option expansion.
- Alternatives: Keep GZA + Ghostface Killah or defer the roster change until after option planning.
- Consequences: Wu-Bob guidance shifts toward stronger contract enforcement, structured orchestration, and audit-style reviews.
- Revisit criteria: If the work shifts toward terse execution or needs a different balance of creativity vs discipline.
- Plan (micro): Update `DECISIONS.md` and `AGENTS.md` only. Commands: `rg -n "Wu-Bob roster" AGENTS.md`, `rg -n "Wu-Bob roster change" DECISIONS.md`.
- Self-critique (micro): Risk of overemphasizing structure at the expense of rapid iteration; evidence is the updated roster entries and referenced files.

## 2026-01-22 - Wu-Bob roster change (micro plan + self-critique)
- Date: 2026-01-22
- Decision: Change Wu-Bob roster to GZA + U-God + Method Man.
- Context: User requested a roster change to emphasize concise precision (GZA), steady grounding (U-God), and pragmatic execution energy (Method Man).
- Alternatives: Keep Uncle Bob + RZA + Inspectah Deck or defer the roster change until after the current review cycle.
- Consequences: Wu-Bob guidance shifts toward terser audits, grounded priorities, and pragmatic delivery.
- Revisit criteria: If deeper architectural inspection or orchestration becomes the dominant need.
- Plan (micro): Update `DECISIONS.md` and `AGENTS.md` only. Commands: `rg -n "Wu-Bob roster" AGENTS.md`, `rg -n "Wu-Bob roster change" DECISIONS.md`.
- Self-critique (micro): Risk of reducing architectural depth; evidence is the updated roster entries and referenced files.

## 2026-01-22 - Center alignment applies to all text columns
- Date: 2026-01-22
- Decision: `alignment: "center"` centers the title and list columns; number/label columns straddle the center line with fixed half-gutter spacing. Prompt alignment lines mirror this (centered vs left-aligned).
- Context: Users must be able to align content left or center; list items are part of the content and must follow the chosen alignment.
- Alternatives: Center only the title and keep list items left-aligned; or attempt text-width measurement to center entire blocks.
- Consequences: SVG renderer positions list columns symmetrically around the center; prompt text and drift checks enforce the correct alignment wording.
- Revisit criteria: If the centered list layout is visually unbalanced for long labels or if a future text-measurement capability is introduced.

## 2026-01-22 - Wu-Bob roster change (micro plan + self-critique)
- Date: 2026-01-22
- Decision: Change Wu-Bob roster from Raekwon + Masta Killa to GZA + Ghostface Killah.
- Context: User requested a roster change to emphasize precision and raw clarity during review.
- Alternatives: Keep current roster and add these members later if needed.
- Consequences: Wu-Bob guidance shifts toward terse precision (GZA) and visceral narrative clarity (Ghostface Killah).
- Revisit criteria: If the work scope shifts away from execution precision or needs higher system-level orchestration.
- Plan (micro): Update `DECISIONS.md` and `AGENTS.md` only. Commands: `rg -n "Wu-Bob" AGENTS.md`, `rg -n "Wu-Bob roster" DECISIONS.md`.
- Self-critique (micro): Risk of over-indexing on brevity at the expense of completeness; evidence is the updated roster entries in the two files.

## 2026-01-22 - Seam-Driven Development plan (alignment + decorations consistency) + self-critique
- Date: 2026-01-22
- Decision: Align prompt assembly text with alignment settings, remove non-seam network font loading, and resolve decoration contradictions by making the prompt explicitly forbid decorations while preserving the DECORATIONS heading.
- Context: Current prompt/template conflicts with spec constraints and introduces external network I/O in the UI.
- Alternatives: Allow decorative borders in the spec or keep external font loading.
- Consequences: Prompt text changes require fixture updates; drift detection checks will include alignment phrases; UI will rely on local fonts only.
- Revisit criteria: If future requirements explicitly reintroduce decorative border instructions or bundled font assets.
- Plan:
  - Goal: eliminate contradictions and keep all network I/O behind seams with minimal behavioral change.
  - Seams: PromptAssemblySeam, DriftDetectionSeam, OutputPackagingSeam, ImageGenerationSeam.
  - Files:
    - `DECISIONS.md`
    - `src/routes/+page.svelte`
    - `src/lib/adapters/prompt-assembly.adapter.ts`
    - `src/lib/adapters/drift-detection.adapter.ts`
    - `src/lib/adapters/output-packaging.adapter.ts`
    - `tests/contract/image-generation.test.ts`
    - `fixtures/prompt-assembly/sample.json`
    - `fixtures/prompt-assembly/fault.json`
    - `fixtures/drift-detection/sample.json`
    - `fixtures/drift-detection/fault.json`
    - `fixtures/image-generation/sample.json`
    - `fixtures/image-generation/fault.json`
  - Commands: `npm run check`, `npm test`, `npm run verify`.
- Self-critique: The riskiest assumption is that prompt text changes will not invalidate downstream drift checks; evidence will be updated fixtures and contract tests. Another risk is introducing regressions in the renderer tests while adding layout assertions; evidence will be the updated ImageGenerationSeam contract test expectations.

## 2026-01-22 - Seam-Driven Development plan (pure seams) + self-critique
- Date: 2026-01-22
- Decision: Proceed with full fixture -> mock -> contract test -> adapter workflow for SpecValidationSeam, PromptAssemblySeam, DriftDetectionSeam, ImageGenerationSeam, and OutputPackagingSeam, plus probe status corrections in `docs/seams.md`.
- Context: Contracts exist and partial fixtures started; the next safe step is to complete the pure seams end-to-end before touching I/O seams.
- Alternatives: Pause and re-scope to a single seam only.
- Consequences: Multiple seam artifacts will be created and must pass contract tests before adapter logic is accepted.
- Revisit criteria: If tests reveal missing contract details or the prompt/template decisions prove unworkable.
- Plan:
  - Goal: finish pure seam artifacts and implementations with red-proof before any I/O seam work.
  - Seams: SpecValidationSeam, PromptAssemblySeam, DriftDetectionSeam, ImageGenerationSeam, OutputPackagingSeam.
  - Files:
    - `DECISIONS.md`
    - `docs/seams.md`
    - `fixtures/spec-validation/sample.json`
    - `fixtures/spec-validation/fault.json`
    - `fixtures/prompt-assembly/sample.json`
    - `fixtures/prompt-assembly/fault.json`
    - `fixtures/drift-detection/sample.json`
    - `fixtures/drift-detection/fault.json`
    - `fixtures/image-generation/sample.json`
    - `fixtures/image-generation/fault.json`
    - `fixtures/output-packaging/sample.json`
    - `fixtures/output-packaging/fault.json`
    - `src/lib/mocks/spec-validation.mock.ts`
    - `src/lib/mocks/prompt-assembly.mock.ts`
    - `src/lib/mocks/drift-detection.mock.ts`
    - `src/lib/mocks/image-generation.mock.ts`
    - `src/lib/mocks/output-packaging.mock.ts`
    - `tests/contract/spec-validation.test.ts`
    - `tests/contract/prompt-assembly.test.ts`
    - `tests/contract/drift-detection.test.ts`
    - `tests/contract/image-generation.test.ts`
    - `tests/contract/output-packaging.test.ts`
    - `src/lib/adapters/spec-validation.adapter.ts`
    - `src/lib/adapters/prompt-assembly.adapter.ts`

## 2026-01-22 - Seam-Driven Development tooling automation (chamber lock, shaolin lint, rewind)
- Date: 2026-01-22
- Decision: Add deterministic automation scripts (chamber lock, shaolin lint, rewind, verify runner) and wire them into `npm run verify`.
- Context: User requested maximum automation with enforced evidence and seam artifact checks.
- Alternatives: Keep manual evidence capture and run checks ad hoc; add only git hooks without command integration.
- Consequences: `npm run verify` now generates evidence and enforces gate checks; failures block completion until evidence is fresh.
- Revisit criteria: If automation causes false negatives or blocks valid work due to missing metadata rules.
- Plan:
  - Goal: enforce seam artifact presence and evidence freshness with deterministic reports.
  - Seams: none (tooling only).
  - Files:
    - `scripts/chamber-lock.mjs`
    - `scripts/shaolin-lint.mjs`
    - `scripts/rewind.mjs`
    - `scripts/verify-runner.mjs`
    - `package.json`
    - `docs/evidence/README.md`
    - `DECISIONS.md`
  - Commands: `npm run verify`, `node scripts/rewind.mjs --seam AuthContextSeam` (spot check).
- Self-critique: The riskiest assumption is that evidence freshness based on mtimes is sufficient; if file timestamps drift, the lint could block incorrectly. Evidence is the generated JSON reports and successful `npm run verify` output captured under `docs/evidence/YYYY-MM-DD/`.

## 2026-01-23 - Seam ledger + proof tape automation (plan + self-critique)
- Date: 2026-01-23
- Decision: Add seam ledger and proof tape scripts for deterministic seam coverage reporting and non-coder evidence summaries.
- Context: User requested more automated, human-readable proof artifacts without weakening enforcement.
- Alternatives: Keep evidence files only; manually summarize status when needed.
- Consequences: New evidence files will be generated during `npm run verify`; documentation updated to include them.
- Revisit criteria: If summaries become misleading or require heuristics beyond deterministic metadata.
- Plan:
  - Goal: generate seam coverage and proof summaries automatically alongside verification.
  - Seams: none (tooling only).
  - Files:
    - `scripts/seam-ledger.mjs`
    - `scripts/proof-tape.mjs`
    - `package.json`
    - `docs/evidence/README.md`
    - `DECISIONS.md`
  - Commands: `npm run verify`, `npm run seam:ledger`, `npm run proof:tape`.
- Self-critique: The riskiest assumption is that evidence folder selection by date is sufficient for accurate summaries; evidence will be the generated ledger and proof tape reports in `docs/evidence/YYYY-MM-DD/`.

## 2026-01-23 - Clan chain report (plan + self-critique)
- Date: 2026-01-23
- Decision: Add a clan chain report that marks seams as clean or dirty using the seam ledger output.
- Context: User requested additional Wu-Tang-specific tooling to make seam readiness visible for non-coders.
- Alternatives: Rely on seam ledger only; manually interpret status.
- Consequences: New evidence files generated alongside seam ledger and proof tape.
- Revisit criteria: If chain reports cause redundant noise or mislead without added value.
- Plan:
  - Goal: generate a clean vs dirty seam list from seam ledger output.
  - Seams: none (tooling only).
  - Files:
    - `scripts/clan-chain.mjs`
    - `package.json`
    - `docs/evidence/README.md`
    - `DECISIONS.md`
  - Commands: `npm run verify`, `npm run clan:chain`.
- Self-critique: The riskiest assumption is that seam ledger status alone is sufficient to classify readiness; evidence will be the generated `clan-chain.json` and `clan-chain.md` reports.

## 2026-01-23 - AGENTS automation instructions (micro plan + self-critique)
- Date: 2026-01-23
- Decision: Document automated tool usage in `AGENTS.md` to prevent ambiguity about required gates.
- Context: New automation scripts are wired into `npm run verify` and need explicit governance guidance.
- Alternatives: Rely on package.json scripts only; explain in README instead.
- Consequences: AGENTS now explicitly describes the automation workflow and the seam-scoped rewind command.
- Revisit criteria: If tooling changes or the verify pipeline is split into separate phases.
- Plan (micro):
  - Goal: add concise instructions for using the automation tools.
  - Seams: none (docs-only).
  - Files:
    - `AGENTS.md`
    - `DECISIONS.md`
  - Commands: none.
- Self-critique (micro): Risk of over-prescription if tooling changes; evidence is the updated `AGENTS.md` section and this decision entry.

## 2026-01-23 - AGENTS automation tools section (micro plan + self-critique)
- Date: 2026-01-23
- Decision: Add a short Automation Tools section in `AGENTS.md` listing the new scripts and their purposes.
- Context: Users asked for clear instructions on how to use the automated gates.
- Alternatives: Leave instructions only in package.json scripts; document in README instead.
- Consequences: AGENTS becomes the single source of truth for tool usage expectations.
- Revisit criteria: If tooling names change or the verify pipeline is restructured.
- Plan (micro):
  - Goal: add an automation tools list without changing workflow rules.
  - Seams: none (docs-only).
  - Files:
    - `AGENTS.md`
    - `DECISIONS.md`
  - Commands: none.
- Self-critique (micro): Risk of duplication with `package.json`; evidence is the updated `AGENTS.md` section.
    - `src/lib/adapters/drift-detection.adapter.ts`
    - `src/lib/adapters/image-generation.adapter.ts`
    - `src/lib/adapters/output-packaging.adapter.ts`
  - Commands: `npm run check`, `npm test`, `npm run verify`.
- Self-critique: The riskiest assumption is that the locked prompt template can incorporate list-based content without breaking drift rules; evidence will be contract tests for PromptAssemblySeam and DriftDetectionSeam plus fixture comparisons. Another risk is PDF packaging correctness from SVG input; evidence will be OutputPackagingSeam tests that validate non-empty base64 output and expected file naming.

## 2026-01-22 - Seam-Driven Development plan (stateful seams) + self-critique
- Date: 2026-01-22
- Decision: Proceed with fixture -> mock -> contract test -> adapter workflow for SessionSeam, AuthContextSeam, CreationStoreSeam, ChatInterpretationSeam, and ProviderAdapterSeam, including contract extension for draft storage in CreationStoreSeam.
- Context: Pure seams are in place; stateful seams are required to support persistence and chat workflow without hidden I/O.
- Alternatives: Delay stateful seams and ship a read-only UI.
- Consequences: LocalStorage-backed adapters will be browser-gated and must return explicit errors when environment is missing.
- Revisit criteria: If contract tests reveal gaps in draft storage expectations.
- Plan:
  - Goal: finish stateful seam artifacts and adapters without introducing hidden I/O.
  - Seams: SessionSeam, AuthContextSeam, CreationStoreSeam, ChatInterpretationSeam, ProviderAdapterSeam.
  - Files:
    - `DECISIONS.md`
    - `contracts/creation-store.contract.ts`
    - `fixtures/session/sample.json`
    - `fixtures/session/fault.json`
    - `fixtures/auth-context/sample.json`
    - `fixtures/auth-context/fault.json`
    - `fixtures/creation-store/sample.json`
    - `fixtures/creation-store/fault.json`
    - `fixtures/chat-interpretation/sample.json`
    - `fixtures/chat-interpretation/fault.json`
    - `fixtures/provider-adapter/sample.json`
    - `fixtures/provider-adapter/fault.json`
    - `src/lib/mocks/session.mock.ts`
    - `src/lib/mocks/auth-context.mock.ts`
    - `src/lib/mocks/creation-store.mock.ts`
    - `src/lib/mocks/chat-interpretation.mock.ts`
    - `src/lib/mocks/provider-adapter.mock.ts`
    - `tests/contract/session.test.ts`
    - `tests/contract/auth-context.test.ts`
    - `tests/contract/creation-store.test.ts`
    - `tests/contract/chat-interpretation.test.ts`
    - `tests/contract/provider-adapter.test.ts`
    - `src/lib/adapters/session.adapter.ts`
    - `src/lib/adapters/auth-context.adapter.ts`
    - `src/lib/adapters/creation-store.adapter.ts`
    - `src/lib/adapters/chat-interpretation.adapter.ts`
    - `src/lib/adapters/provider-adapter.adapter.ts`
  - Commands: `npm run check`, `npm test`, `npm run verify`.
- Self-critique: The riskiest assumption is that browser-only storage behavior can be safely gated without violating flow expectations; evidence will be adapters returning explicit `BROWSER_REQUIRED` errors in Node tests. Another risk is expanding the CreationStoreSeam contract for drafts; evidence will be updated fixtures and contract tests for draft operations.

## 2026-01-21 - Initial app and seam decisions
- Date: 2026-01-21
- Decision: Build with SvelteKit (latest stable), Vite, Vitest, strict TypeScript, and svelte-check; no `any`.
- Context: Need fast iteration with strict correctness for Seam-Driven Development.
- Alternatives: Angular.
- Consequences: SvelteKit conventions drive project layout and testing.
- Revisit criteria: Reconsider only if SvelteKit blocks required seams or testing.

- Date: 2026-01-21
- Decision: Use `DECISIONS.md` at repo root as canonical; do not move or rename.
- Context: Avoid churn and broken links; minimal diffs.
- Alternatives: `docs/decisions.md`.
- Consequences: All decision references point to repo-root `DECISIONS.md`.
- Revisit criteria: If a docs reorg is explicitly approved.

- Date: 2026-01-21
- Decision: Allow new seams only when they meet seam definition, are added to `docs/seams.md`, and follow the full workflow; pre-approved: SessionSeam, SpecValidationSeam.
- Context: Prevent seam sprawl while allowing necessary trust/side-effect boundaries.
- Alternatives: Canonical seams only.
- Consequences: Any added seam must pay full SDD cost.
- Revisit criteria: If seam list proves insufficient for side-effect isolation.

- Date: 2026-01-21
- Decision: ImageGenerationSeam and ChatInterpretationSeam use stubbed adapters in v1; no real API integration.
- Context: Avoid credentials and nondeterminism in v1.
- Alternatives: Live provider integration.
- Consequences: Determinism relies on prompt locking + evidence, not provider seeding.
- Revisit criteria: When provider integration is explicitly requested.

- Date: 2026-01-21
- Decision: DriftDetectionSeam uses a simple heuristic in v1 (rules-based over spec + prompts).
- Context: Need detectable violations without vision models.
- Alternatives: Fully mocked drift detection.
- Consequences: Rules must be explicit and testable.
- Revisit criteria: When vision-based detection is in scope.

- Date: 2026-01-21
- Decision: OutputPackagingSeam generates one PDF per image in v1.
- Context: Simpler proofs and tests than multi-page packaging.
- Alternatives: Multi-page PDF.
- Consequences: Multiple files for multi-variation outputs.
- Revisit criteria: When UX requires multi-page packaging.

- Date: 2026-01-21
- Decision: CreationStoreSeam uses browser `localStorage` for anonymous users in v1.
- Context: No auth or server persistence required; session-scoped storage.
- Alternatives: File-backed or server DB.
- Consequences: Data is per-browser and per-device.
- Revisit criteria: When authenticated persistence is in scope.

- Date: 2026-01-21
- Decision: Enforce spec constraints: items 1–20, label length 1–40, allowed chars set, numbers 1–999, strict alignment language required in prompt.
- Context: Ensure deterministic, rule-bound outputs.
- Alternatives: Looser validation.
- Consequences: Invalid input blocks generation until corrected.
- Revisit criteria: If constraints block legitimate use cases.

- Date: 2026-01-21
- Decision: UI direction defaults to clean worksheet aesthetic with a debug panel (prompt, revised prompt, violations).
- Context: Prioritize clarity and constraint visibility.
- Alternatives: Branded or decorative UI.
- Consequences: Minimal visual styling in v1.
- Revisit criteria: When brand direction is defined.

- Date: 2026-01-21
- Decision: OutputPackagingSeam runs client-side in the browser; server-side PDF generation is out of scope for v1.
- Context: Avoid unnecessary I/O and scope creep; keep side effects in the client adapter.
- Alternatives: Server-side PDF generation.
- Consequences: Packaging depends on browser capabilities; server remains out of the seam.
- Revisit criteria: If client-side packaging cannot meet requirements.

- Date: 2026-01-21
- Decision: ImageGenerationSeam uses a deterministic SVG renderer in v1 that obeys layout constraints; no static placeholder images.
- Context: A placeholder would not prove layout rules or constraint enforcement.
- Alternatives: Static placeholder image; live provider integration.
- Consequences: Renderer must encode layout constraints explicitly.
- Revisit criteria: When a real model integration is required.

- Date: 2026-01-21
- Decision: Update `docs/seams.md` before the build plan to include canonical seams plus pre-approved SessionSeam and SpecValidationSeam.
- Context: Prevent code-first drift and keep seam inventory authoritative.
- Alternatives: Update later during implementation.
- Consequences: Seam names are locked for planning.
- Revisit criteria: If seam inventory format changes.

## 2026-01-21 - Governance-only docs update (micro plan + self-critique)
- Date: 2026-01-21
- Decision: Clarify governance rules for docs-only changes and seam inventory formatting without changing SDD philosophy.
- Context: Required fixes to prevent ambiguity around plans, probes, and naming.
- Alternatives: Leave as-is and rely on interpretation.
- Consequences: Docs changes now have explicit enforcement rules and probe status constraints.
- Revisit criteria: If these governance rules block legitimate doc-only edits.
- Plan (micro): Update `AGENTS.md` and `docs/seams.md` only. Commands: `diff -u /tmp/AGENTS.md.bak /Users/hbpheonix/coloringbook/AGENTS.md`, `diff -u /tmp/seams.md.bak /Users/hbpheonix/coloringbook/docs/seams.md`.
- Self-critique (micro): Risk of misclassifying a seam as pure or blocked; evidence is the explicit notes and probe status entries in `docs/seams.md`.

## 2026-01-22 - Wu-Bob roster change (micro plan + self-critique)
- Date: 2026-01-22
- Decision: Change Wu-Bob roster to RZA + Raekwon + Inspectah Deck for spec/communication guidance.
- Context: Need stronger narrative/translation of specs without losing architectural rigor or inspection.
- Alternatives: Keep RZA + Inspectah Deck.
- Consequences: Wu-Bob guidance emphasizes narrative clarity alongside structure and inspection.
- Revisit criteria: If narrative emphasis creates ambiguity or slows enforcement.
- Plan (micro): Update `AGENTS.md` only. Rule change: Wu-Bob roster. Zero behavioral impact beyond governance configuration.
- Self-critique (micro): Risk of over-weighting narrative; mitigation is to keep enforcement language explicit.

## 2026-01-22 - xAI provider boundary decisions
- Date: 2026-01-22
- Decision: External boundary is ProviderAdapterSeam (Option B).
- Context: Keep PromptAssemblySeam pure/deterministic while isolating network/auth/retries and enabling provider swaps.
- Alternatives: Keep provider behavior inside ImageGenerationSeam.
- Consequences: ProviderAdapterSeam will own all external API I/O and be fully mocked in v1.
- Revisit criteria: If ProviderAdapterSeam adds unnecessary complexity without improving isolation.

- Date: 2026-01-22
- Decision: Use xAI chat via POST `/v1/chat/completions`.
- Context: Simplest, widely supported request shape; easiest to stub.
- Alternatives: `/v1/responses`.
- Consequences: ProviderAdapterSeam contract must match chat/completions shape.
- Revisit criteria: If `/v1/responses` becomes required or provides needed features.

- Date: 2026-01-22
- Decision: Use xAI image generation via POST `/v1/images/generations` with default `response_format="b64_json"`.
- Context: Avoid URL expiration, CORS, and external fetch complexity for download/print.
- Alternatives: `response_format="url"`.
- Consequences: ImageGenerationSeam must accept base64 payloads by default.
- Revisit criteria: If a URL-based flow becomes required.

- Date: 2026-01-22
- Decision: Do not add `scripts/xai-image-smoke.ts` in this task (no-network); if added later, it belongs under ProviderAdapterSeam probes and is gated by `XAI_API_KEY`.
- Context: Keep v1 network-free and deterministic.
- Alternatives: Add a gated smoke probe now.
- Consequences: ProviderAdapterSeam remains stubbed until explicitly expanded.
- Revisit criteria: When real provider integration is requested.

## 2026-01-22 - Autonomy lock decisions
- Date: 2026-01-22
- Decision: SVG renderer targets US Letter at 300 DPI (2550x3300 px) with 0.5 in margins (150 px), content width 2250 px, border stroke 8 px inside margin, safe text box x=150 y=150 w=2250 h=3000.
- Context: Lock deterministic layout for v1 rendering.
- Alternatives: Use relative sizing without fixed DPI.
- Consequences: Renderer layout is deterministic and testable.
- Revisit criteria: If target print sizes or DPI change.

- Date: 2026-01-22
- Decision: Typography defaults for renderer: font stack "Baloo 2", "Fredoka", "Arial Rounded MT Bold", Arial, sans-serif; title 120 px lineHeight 1.05; body 72 px lineHeight 1.20; small label 60 px lineHeight 1.20; text stroke 6 px, fill none, stroke #000.
- Context: Enforce consistent line-art text rendering.
- Alternatives: Use system defaults or webfonts.
- Consequences: Text rendering must conform to these sizes/weights.
- Revisit criteria: If font availability or legibility requires change.

- Date: 2026-01-22
- Decision: WhitespaceScale mapping uses base = bodyFontPx * bodyLineHeight; whitespacePx = round(base * (1.0 + (whitespaceScale / 100) * 2.0)).
- Context: Deterministic spacing control.
- Alternatives: Linear mapping without base or non-linear scaling.
- Consequences: Spacing is directly testable.
- Revisit criteria: If spacing feels too tight or loose in practice.

- Date: 2026-01-22
- Decision: Prompt template is locked with exact headings and required phrases, including literal bracket notes for drift checks (STYLE, TEXT (exact), TYPOGRAPHY, LAYOUT, DECORATIONS, OUTPUT, NEGATIVE PROMPT).
- Context: Prevent prompt drift and ensure detection rules are viable.
- Alternatives: Freeform prompt assembly.
- Consequences: PromptAssemblySeam must output the canonical template.
- Revisit criteria: If canonical template fails to produce acceptable outputs.

- Date: 2026-01-22
- Decision: Drift detection rules are explicit: required phrase checks, required negative lines under NEGATIVE PROMPT, and forbidden tokens for size/quality/style and extra headings; if TEXT (exact) present but quoteText missing, assembly must block.
- Context: Detect missing constraints and unsupported parameters.
- Alternatives: Heuristic-only detection without strict phrases.
- Consequences: DriftDetectionSeam must validate prompt structure deterministically.
- Revisit criteria: If rules are too brittle for real prompts.

- Date: 2026-01-22
- Decision: Creation storage uses `localStorage` key `cb_creations_v1` with rolling retention of 50, schema `{ id, createdAtISO, intent, assembledPrompt, revisedPrompt?, images?: [{b64?, url?}], favorite?: boolean }`, plus `cb_drafts_v1` for in-progress intent.
- Context: Persist anonymous creations and drafts with minimal scope.
- Alternatives: Session-only storage or server persistence.
- Consequences: Storage adapter must enforce retention and schema.
- Revisit criteria: When authenticated persistence is in scope.

- Date: 2026-01-22
- Decision: CreationStoreSeam includes draft operations (`saveDraft`, `getDraft`, `clearDraft`) with `DraftRecord` shape `{ updatedAtISO, intent, chatMessage? }`.
- Context: Drafts must be stored without bypassing seam boundaries.
- Alternatives: Store drafts directly in UI localStorage (rejected due to hidden I/O).
- Consequences: CreationStoreSeam contract and fixtures include draft handling.
- Revisit criteria: If drafts move to a dedicated seam.

- Date: 2026-01-22
- Decision: SessionSeam stores anonymous session id in localStorage under `cb_session_id_v1`, generated via `crypto.randomUUID` with a timestamp fallback.
- Context: Session identity is needed for anonymous ownership without server auth.
- Alternatives: Use cookies or server-issued ids.
- Consequences: SessionSeam adapter is browser-gated and deterministic for tests.
- Revisit criteria: If sessions move server-side.

- Date: 2026-01-22
- Decision: AuthContextSeam v1 always returns anonymous context with capabilities `generate` and `store`, and rejects session ids containing non-alphanumeric/underscore/hyphen characters.
- Context: v1 has no authentication providers but requires explicit capabilities.
- Alternatives: Allow any session id or include more capability tiers.
- Consequences: AuthContextSeam behavior is deterministic and fixture-aligned.
- Revisit criteria: When authenticated users are introduced.

- Date: 2026-01-22
- Decision: Output naming uses `coloring-page-<id>.pdf` and `coloring-page-<id>-<index>.pdf` for batches.
- Context: Deterministic export naming.
- Alternatives: Random or user-defined filenames.
- Consequences: OutputPackagingSeam must follow naming convention.
- Revisit criteria: If user-defined naming becomes required.

- Date: 2026-01-22
- Decision: Allowed third-party dependencies are limited to Zod and pdf-lib (besides SvelteKit/Vitest defaults); no others without approval.
- Context: Minimize dependency risk and keep core logic clean.
- Alternatives: Add utility libraries as needed.
- Consequences: Implement SVG rendering internally.
- Revisit criteria: If required functionality cannot be implemented without new deps.

- Date: 2026-01-22
- Decision: Autonomy boundaries: may choose PDF generation via pdf-lib and internal SVG renderer; may adjust UI within worksheet aesthetic; may add non-network scripts. Must not change seam names/paths or add network probes without explicit request.
- Context: Enable autonomous progress with guardrails.
- Alternatives: Case-by-case approvals.
- Consequences: Autonomy is constrained to non-network, SDD-compliant changes.
- Revisit criteria: If autonomy boundaries need expansion.

- Date: 2026-01-22
- Decision: Seam owners set to `hbpheonix` for all seams in `docs/seams.md` until reassigned.
- Context: Owner required before implementation begins.
- Alternatives: Assign per-seam owners later.
- Consequences: Seam inventory is unblocked for planning.
- Revisit criteria: When responsibilities are split.

- Date: 2026-01-22
- Decision: Text size mapping for deterministic SVG renderer uses body font sizes small=72px, medium=90px, large=108px; small label size scales proportionally from 60px.
- Context: Spec defines textSize but only provides a default; mapping must be explicit for deterministic output.
- Alternatives: Keep body size fixed regardless of textSize.
- Consequences: Text sizing is deterministic and testable per spec.
- Revisit criteria: If layout density or readability requires different scaling.

- Date: 2026-01-22
- Decision: Numbered list gutter uses `bodyFontPx * 1.6` and left-aligned labels at `SAFE_X + gutter`; strict alignment keeps a fixed number column, loose alignment offsets numbers slightly by digit count.
- Context: Spec requires fixed number alignment with a gutter but does not define its size.
- Alternatives: Derive gutter from text width measurements or use a fixed pixel value.
- Consequences: List layout is deterministic and alignable for strict mode.
- Revisit criteria: If list alignment looks uneven in practice.

- Date: 2026-01-22
- Decision: PDF packaging uses US Letter dimensions (612x792 pt) and scales images to fit; SVGs are converted to PNG in-browser before embedding.
- Context: pdf-lib does not embed SVG directly; client-side packaging is required.
- Alternatives: Server-side PDF generation or SVG embedding via other libraries.
- Consequences: Output packaging adapter is browser-gated for SVG conversion.
- Revisit criteria: If an SVG embedding library is approved later.

## 2026-01-22 - Docs-only autonomy updates (micro plan + self-critique)
- Date: 2026-01-22
- Decision: Record autonomy-lock decisions and assign seam owners with docs-only changes.
- Context: Establish deterministic renderer, prompt rules, storage schema, and ownership before implementation.
- Alternatives: Defer to later planning.
- Consequences: Specs and inventory are locked for SDD planning.
- Revisit criteria: If any decision blocks required functionality.
- Plan (micro): Update `DECISIONS.md` and `docs/seams.md` only. Commands: `diff -u /tmp/DECISIONS.md.bak2 /Users/hbpheonix/coloringbook/DECISIONS.md`, `diff -u /tmp/seams.md.bak2 /Users/hbpheonix/coloringbook/docs/seams.md`.
- Self-critique (micro): Risk of over-constraining layout; evidence is the explicit size, spacing, and prompt rules recorded here.

## 2026-01-22 - Terminology enforcement (micro plan + self-critique)
- Date: 2026-01-22
- Decision: Use the full term "Seam-Driven Development" in prose and avoid the acronym.
- Context: Reduce ambiguity and enforce consistent language.
- Alternatives: Allow the acronym in prose.
- Consequences: Docs and responses must use the full term.
- Revisit criteria: If the restriction creates confusion with file naming.
- Plan (micro): Update `AGENTS.md` only. Commands: `diff -u /tmp/AGENTS.md.bak3 /Users/hbpheonix/coloringbook/AGENTS.md`.
- Self-critique (micro): Risk of inconsistency when referencing filenames; mitigate by keeping file paths literal.

## 2026-01-22 - Wu-Bob roster change (micro plan + self-critique)
- Date: 2026-01-22
- Decision: Change Wu-Bob roster to Raekwon + Masta Killa.
- Context: Shift emphasis to concrete spec translation (Raekwon) and disciplined execution pace (Masta Killa).
- Alternatives: Keep RZA + Raekwon + Inspectah Deck.
- Consequences: Guidance prioritizes clarity and steady process.
- Revisit criteria: If architectural structure or inspection rigor needs stronger emphasis.
- Plan (micro): Update `AGENTS.md` only. Commands: `diff -u /tmp/AGENTS.md.bak4 /Users/hbpheonix/coloringbook/AGENTS.md`.
- Self-critique (micro): Risk of under-weighting architecture/inspection; mitigate by keeping contract checks explicit.

## 2026-01-22 - File header exception for JSON (micro plan + self-critique)
- Date: 2026-01-22
- Decision: Files that do not support comments (e.g., `package.json`) are exempt from the top-level comment requirement; no nonstandard fields will be added.
- Context: Seam-Driven Development requires top-level comments, but JSON does not allow comments.
- Alternatives: Add nonstandard comment fields or convert to JSONC.
- Consequences: JSON files remain valid for tooling; documentation stays in surrounding files.
- Revisit criteria: If tooling adds native comment support without breaking behavior.
- Plan (micro): Update `DECISIONS.md` only. Commands: `diff -u /tmp/DECISIONS.md.bak2 /Users/hbpheonix/coloringbook/DECISIONS.md`.
- Self-critique (micro): Risk of inconsistent documentation; mitigate with clear comments in adjacent files and docs.

## 2026-01-22 - Seam-Driven Development implementation plan (contracts first)
- Date: 2026-01-22
- Decision: Execute a contract-first, linear Seam-Driven Development build with explicit seams, file paths, and commands.
- Context: Ensure deterministic, evidence-based implementation with no shortcuts.
- Alternatives: Implementation-first or incremental without contracts.
- Consequences: All seams and tests are built in order; adapters come last.
- Revisit criteria: Only if a required tool/command is unavailable.
- Plan: Seams (exact): AuthContextSeam, CreationStoreSeam, PromptAssemblySeam, ChatInterpretationSeam, ImageGenerationSeam, DriftDetectionSeam, OutputPackagingSeam, SessionSeam, SpecValidationSeam, ProviderAdapterSeam.
- Plan: Files to touch (exact, by phase):
  - contracts: `contracts/auth-context.contract.ts`, `contracts/creation-store.contract.ts`, `contracts/prompt-assembly.contract.ts`, `contracts/chat-interpretation.contract.ts`, `contracts/image-generation.contract.ts`, `contracts/drift-detection.contract.ts`, `contracts/output-packaging.contract.ts`, `contracts/session.contract.ts`, `contracts/spec-validation.contract.ts`, `contracts/provider-adapter.contract.ts`.
  - fixtures: `fixtures/<seam>/sample.json`, `fixtures/<seam>/fault.json` for each seam.
  - mocks: `src/lib/mocks/<seam>.mock.ts` for each seam.
  - tests: `tests/contract/<seam>.test.ts` for each seam.
  - adapters: `src/lib/adapters/<seam>.adapter.ts` for each seam.
  - app wiring: `src/routes/+page.svelte`, `src/routes/+layout.svelte`, `src/app.html`, `src/lib/index.ts`.
  - config: `package.json`, `vite.config.ts`, `svelte.config.js`, `tsconfig.json`.
- Plan: Commands to run (exact): `npm install`, `npm run check`, `npm test`, `npm run build`, `npm run verify` (to be added).
- Self-critique: Risk of under-specifying fixtures or skipping red-proof; mitigation is to write fault fixtures first and run contract tests before adapters.

## 2026-01-23 - Cipher Gate (required proof summary)
- Date: 2026-01-23
- Decision: Require a Cipher Gate entry that summarizes seams touched and links evidence for recent changes.
- Context: User requested a proof-summary gate to reduce AI shortcutting and improve non-coder visibility.
- Alternatives: Rely on evidence files only; add notes in CHANGELOG instead.
- Consequences: Seam changes must include a cipher entry with evidence links.
- Revisit criteria: If evidence cadence changes or cipher format needs expansion.
- Cipher Gate:
  - Date: 2026-01-23
  - Seams: Tooling (no seams)
  - Evidence: docs/evidence/2026-01-23/verify.txt; docs/evidence/2026-01-23/test.txt; docs/evidence/2026-01-23/seam-ledger.json; docs/evidence/2026-01-23/proof-tape.json; docs/evidence/2026-01-23/assumption-alarm.json; docs/evidence/2026-01-23/cipher-gate.json
  - Summary: Added MeechieToolSeam with deterministic Meechie tools UI and updated seam inventory, fixtures, mocks, adapters, and tests.
  - Risks: Evidence folder selection by date could misclassify the latest run; mitigate by rerunning verify if dates drift.

## 2026-01-23 - Cipher Gate automation (plan + self-critique)
- Date: 2026-01-23
- Decision: Add a cipher gate script that enforces a proof-summary entry in `DECISIONS.md`.
- Context: User requested a synthesis-driven gate to reduce shortcutting and highlight evidence links.
- Alternatives: Rely on evidence files only; require manual checklist sign-off.
- Consequences: `npm run verify` now enforces cipher presence and freshness.
- Revisit criteria: If cipher entries become burdensome or evidence paths change.
- Plan:
  - Goal: enforce cipher format and staleness checks deterministically.
  - Seams: none (tooling only).
  - Files:
    - `scripts/cipher-gate.mjs`
    - `package.json`
    - `AGENTS.md`
    - `docs/evidence/README.md`
    - `DECISIONS.md`
  - Commands: `npm run verify`.
- Self-critique: The riskiest assumption is that date-based staleness checks align with real changes; evidence is the `cipher-gate.json` output in `docs/evidence/YYYY-MM-DD/`.

## 2026-01-23 - Assumption alarm automation (plan + self-critique)
- Date: 2026-01-23
- Decision: Add an assumption alarm script that enforces logged assumptions for blocked probes.
- Context: User requested stronger visibility for unproven seams to reduce AI shortcutting.
- Alternatives: Rely on manual notes in `DECISIONS.md` or ignore blocked probes.
- Consequences: `npm run verify` now blocks if blocked probes lack assumptions or validation plans.
- Revisit criteria: If blocked probes are removed or assumption format changes.
- Plan:
  - Goal: enforce assumption format and seam coverage deterministically.
  - Seams: none (tooling only).
  - Files:
    - `scripts/assumption-alarm.mjs`
    - `package.json`
    - `AGENTS.md`
    - `docs/evidence/README.md`
    - `DECISIONS.md`
  - Commands: `npm run verify`.
- Self-critique: The riskiest assumption is that blocked probes always require a single umbrella assumption; evidence is the `assumption-alarm.json` report.

## 2026-01-23 - Assumption (blocked probes for v1)
- Assumption:
  - Date: 2026-01-23
  - Seams: AuthContextSeam, CreationStoreSeam, ChatInterpretationSeam, ProviderAdapterSeam, SessionSeam
  - Statement: Probes are blocked in v1 due to missing credentials or environment; adapters remain stubbed and deterministic for now.
  - Validation: Run probes when credentials/environment are available; update fixtures and evidence accordingly.
  - Status: open

## 2026-01-23 - Git hooks + CI enforcement (plan + self-critique)
- Date: 2026-01-23
- Decision: Add local git hooks and CI workflow to run `npm run verify`.
- Context: User requested automatic enforcement without relying on manual commands.
- Alternatives: Manual verify only; local hooks without CI.
- Consequences: Commits and pushes are gated locally; CI blocks unverified changes.
- Revisit criteria: If verify becomes too slow for local workflows or CI cost is prohibitive.
- Plan:
  - Goal: add local hooks and a CI workflow for verification.
  - Seams: none (tooling only).
  - Files:
    - `.githooks/pre-commit`
    - `.githooks/pre-push`
    - `scripts/install-githooks.mjs`
    - `.github/workflows/verify.yml`
    - `package.json`
    - `AGENTS.md`
    - `docs/evidence/README.md`
    - `DECISIONS.md`
  - Commands: `npm run hooks:install`, `npm run verify`.
- Self-critique: The riskiest assumption is that local hooks will be enabled consistently; evidence is the hooks install output and CI workflow definition.

## 2026-01-23 - Wu-Bob response format (micro plan + self-critique)
- Date: 2026-01-23
- Decision: Require Wu-Bob responses to include separate Wu-Tang and Uncle Bob lenses plus a synthesis.
- Context: User requested explicit Uncle Bob commentary alongside Wu-Tang perspectives.
- Alternatives: Keep mixed responses without explicit separation.
- Consequences: Wu-Bob responses will always show clean-code critique separately.
- Revisit criteria: If this format becomes too verbose for routine replies.
- Plan (micro):
  - Goal: add a response format rule in `AGENTS.md`.
  - Seams: none (docs-only).
  - Files:
    - `AGENTS.md`
    - `DECISIONS.md`
  - Commands: none.
- Self-critique (micro): Risk of verbosity; evidence is the updated rule in `AGENTS.md`.

## 2026-01-23 - Wu-Bob response format (combined voice) (micro plan + self-critique)
- Date: 2026-01-23
- Decision: Wu-Bob responses must be a single combined voice that blends Wu-Tang roster input with Uncle Bob’s clean-code lens.
- Context: User requested preserving synthesis and avoiding separated sections.
- Alternatives: Keep the three-section format or add a separate Uncle Bob appendix.
- Consequences: Wu-Bob feedback stays unified while still covering clean-code concerns.
- Revisit criteria: If combined responses hide clean-code accountability or become too vague.
- Plan (micro):
  - Goal: update Wu-Bob response guidance in `AGENTS.md`.
  - Seams: none (docs-only).
  - Files:
    - `AGENTS.md`
    - `DECISIONS.md`
  - Commands: none.
- Self-critique (micro): Risk of losing explicit separation; evidence is the updated rule in `AGENTS.md`.

## 2026-01-23 - README context update (micro plan + self-critique)
- Date: 2026-01-23
- Decision: Replace the default README with project-specific Seam-Driven Development and Wu-Tang coding context plus local commands.
- Context: User requested that the 70% problem explanation be captured for non-coders.
- Alternatives: Keep default Svelte README; store explanation only in docs.
- Consequences: README becomes the primary project overview and command reference.
- Revisit criteria: If onboarding needs a longer tutorial or separate docs structure.
- Plan (micro):
  - Goal: add a concise explanation and standard commands.
  - Seams: none (docs-only).
  - Files:
    - `README.md`
    - `DECISIONS.md`
  - Commands: none.
- Self-critique (micro): Risk of oversimplifying the workflow; evidence is the updated README content.

## 2026-01-23 - Meechie tools (plan + self-critique)
- Date: 2026-01-23
- Decision: Add a MeechieToolSeam with deterministic templates plus a UI page for the proposed humor tools.
- Context: User requested ranking and implementation of multiple Meechie feature ideas while away.
- Alternatives: Keep ideas as presets only or defer to a separate repo.
- Consequences: New seam artifacts, UI route, and documentation updates are required.
- Revisit criteria: If the tool set grows beyond deterministic templates or requires external APIs.
- Plan:
  - Goal: implement the nine Meechie features as deterministic tools behind a new seam and expose them in UI.
  - Seams: MeechieToolSeam.
  - Files:
    - `contracts/meechie-tool.contract.ts`
    - `fixtures/meechie-tool/sample.json`
    - `fixtures/meechie-tool/fault.json`
    - `src/lib/mocks/meechie-tool.mock.ts`
    - `src/lib/adapters/meechie-tool.adapter.ts`
    - `tests/contract/meechie-tool.test.ts`
    - `docs/seams.md`
    - `src/routes/meechie/+page.svelte`
    - `src/routes/+layout.svelte`
    - `CHANGELOG.md`
    - `LESSONS_LEARNED.md`
    - `DECISIONS.md`
  - Commands: `npm run verify`, `npm test`.
- Self-critique: The riskiest assumption is that deterministic templates are sufficient to represent the comedic tone without LLM help; evidence will be contract tests, fixtures, and UI wiring.
## 2026-01-27 - Alignment phrase consistency (plan + self-critique)
- Date: 2026-01-27
- Decision: Keep the alignment sentence identical across PromptAssemblySeam and DriftDetectionSeam by introducing a shared helper so prompt generation, validation, fixtures, and probes stay in sync.
- Context: The alignment language informs the prompt assembly template and the drift detection checks; duplication risked drift or new failure modes when the provider limit shifted or the spec changed.
- Alternatives: Maintain separate strings per seam or allow the sentence to evolve independently; both choices would require repeated fixture/probe audits and raise the likelihood of missing a violation.
- Consequences: Added `src/lib/utils/alignment-line.ts`, reused it in both adapters, and updated prompt/drift fixtures plus the image-generation probe so they all emit “all numbers vertically aligned; all text left-aligned; treat blank space as intentional; do not fill empty space.”
- Revisit criteria: Revisit if alignment rules need to diverge per list mode, page size, or localized languages so the helper can be extended responsibly.
- Plan:
  - Goal: Synchronize the deterministic alignment clause across prompt assembly, drift detection, fixtures, and probes so the same sentence is generated and verified.
  - Seams: PromptAssemblySeam, DriftDetectionSeam.
  - Files:
    - `src/lib/utils/alignment-line.ts`
    - `src/lib/adapters/prompt-assembly.adapter.ts`
    - `src/lib/adapters/drift-detection.adapter.ts`
    - `fixtures/prompt-assembly/sample.json`
    - `fixtures/prompt-assembly/title-only.json`
    - `fixtures/drift-detection/sample.json`
    - `fixtures/drift-detection/title-only.json`
    - `fixtures/drift-detection/fault.json`
    - `fixtures/image-generation/sample.json`
    - `fixtures/image-generation/dense-scene.json`
    - `probes/image-generation.probe.mjs`
  - Commands: `npm test`, `npm run verify`.
- Self-critique: The riskiest assumption was that every artifact would be updated; evidence is the uniform sentence in fixtures/probes and the passing verify outputs showing no drift between prompt assembly and the drift detection scan.

## 2026-01-27 - Plan checklist + evidence refresh
- Date: 2026-01-27
- Decision: Capture the detailed remaining-work checklist and tie it to the latest `docs/evidence/2026-01-27` proof so the governance plan stays auditable.
- Context: After editing prompt/governance docs, the checklist needed a granular rewrite that the Cipher Gate could track.
- Alternatives: Keep the checklist informal or rely on the previous cipher entry; both would leave the newest docs without a matching proof.
- Consequences: Future doc updates now require new cipher entries and linked evidence entries.
- Revisit criteria: Add a new entry whenever the checklist/plan or evidence path changes.
- Plan:
  - Goal: Log the checklist updates and point the cipher entry to the new evidence artifacts.
  - Seams: Governance.
  - Files: `DECISIONS.md`, `docs/CHECKLIST.md`, `CHANGELOG.md`, `LESSONS_LEARNED.md`, `AGENTS.md`.
  - Commands: `npm test`, `npm run verify`.
- Self-critique: The risk is forgetting to refresh this entry after future docs-only edits; evidence is this entry and the verify outputs under `docs/evidence/2026-01-27`.

- Cipher Gate:
  - Date: 2026-01-27
  - Seams: Governance
  - Evidence: docs/evidence/2026-01-27/test.txt; docs/evidence/2026-01-27/verify.txt; docs/evidence/2026-01-27/chamber-lock.json; docs/evidence/2026-01-27/seam-ledger.json
  - Summary: Documented the granular checklist update and tied the latest verify evidence to the gate.
  - Risks: Must update this cipher entry whenever governance docs change again.

## 2026-01-27 - Manual/chat builder + storage + PWA enforcement
- Date: 2026-01-27
- Decision: Gate the UI around the full seam loop, persist creations/drafts under the new storage keys, and polish the PWA manifest/icons so the Meechie coloring experience stays deterministic and installable.
- Context: To keep the product autonomous, we needed the manual + chat builders to trigger all seams without shortcuts, ensure creation storage/drafts remain deterministic, and deliver Android install metadata without introducing accidental I/O.
- Alternatives: Let the UI skip validation on Generate, store creations in uncontrolled storage, or defer the PWA polish until later; all would break Seam-Driven Development compliance.
- Consequences: `Generate` now waits for `SpecValidationSeam`, the UI surfaces prompts/violations, creation favorites/deletion operate through `CreationStoreSeam`, drafts persist via `cb_drafts_v1`, and the manifest now lists PNG/maskable icons for Android install.
- Revisit criteria: Only revisit if new storage requirements, creation features, or PWA expectations arise.
- Plan:
  - Goal: Enforce the entire seam loop in the main page, extend creation/draft persistence, and deliver Android-ready PWA metadata.
  - Seams: SpecValidationSeam, PromptAssemblySeam, DriftDetectionSeam, CreationStoreSeam, SessionSeam, OutputPackagingSeam.
  - Files:
    - `src/routes/+page.svelte`
    - `contracts/spec-validation.contract.ts`
    - `fixtures/spec-validation/*`
    - `tests/contract/spec-validation.test.ts`
    - `src/lib/adapters/spec-validation.adapter.ts`
    - `src/lib/adapters/creation-store.adapter.ts`
    - `static/manifest.webmanifest`
    - `static/icons/icon-192.png`
    - `static/icons/icon-512.png`
    - `static/icons/icon-maskable.png`
    - `docs/evidence/2026-01-27/npm-test-2026-01-27-0330.txt`
    - `docs/evidence/2026-01-27/npm-verify-2026-01-27-0340.txt`
    - `docs/evidence/2026-01-27/npm-build-2026-01-27-0350.txt`
  - Commands: `npm test`, `npm run verify`, `npm run build`.
- Self-critique: The risk was that Surface-bias in the UI might tempt us to skip validation or storage; we guard by gating the Generate button on validation results and persisting everything through the adapters plus evidence logs.
- Cipher Gate:
  - Date: 2026-01-27
  - Seams: SpecValidationSeam, PromptAssemblySeam, DriftDetectionSeam, CreationStoreSeam, SessionSeam, OutputPackagingSeam
  - Evidence: docs/evidence/2026-01-27/npm-test-2026-01-27-0330.txt; docs/evidence/2026-01-27/npm-verify-2026-01-27-0340.txt; docs/evidence/2026-01-27/npm-build-2026-01-27-0350.txt
  - Summary: Added validation gating, creation favorite/delete controls, indefinite draft persistence, and Android-ready manifest/icons while proving the flow with full `npm test`/`npm run verify`/`npm run build` evidence.
  - Risks: Need to rerun the gate if we alter any seam that touches validation, storage, or packaging again.

- Cipher Gate:
  - Date: 2026-02-01
  - Seams: ProviderAdapterSeam
  - Evidence: docs/evidence/2026-02-01/rewind-ProviderAdapterSeam.txt; docs/evidence/2026-02-01/npm-test.txt; docs/evidence/2026-02-01/npm-verify.txt; docs/evidence/2026-02-01/probe-provider-adapter.txt; docs/evidence/2026-02-01/probe-chat-interpretation.txt; docs/evidence/2026-02-01/probe-image-generation.txt
  - Summary: Refreshed provider/chat/image probes and aligned ProviderAdapterSeam fault status handling with probe-backed fixtures.
  - Risks: Provider error status codes can change; fixtures and test stubs must be refreshed when probes change.
