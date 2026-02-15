<!--
Purpose: Preserve the agreed remediation task list before implementation begins.
Why: Keep scope, seams, files, and verification commands explicit and recoverable.
Info flow: User request -> documented plan -> implementation -> evidence commands.
-->
# Next Steps Plan (2026-02-14)

## Scope note
This document now tracks both planning and Gemini-step ROI triage. Some listed high-ROI items have been moved to implementation.

## UI Retarget Plan (2026-02-14, adult street-glam audience)
### Plan
- Goal: Retarget the visual language and copy for an adult streetwise woman who may not be highly technical, while preserving current generation behavior.
- Seams: None (UI/copy only, no seam contracts or adapter logic touched).
- Files to touch: `src/routes/+layout.svelte`, `src/routes/+page.svelte`, `src/lib/components/MeechieTools.svelte`.
- Exact commands:
  1. `npm run check`
  2. `npm test`

### Self-critique
1. What could be wrong: Tone update could become too aggressive or unclear for first-time users.
2. What must be proven: Primary actions and labels are easier to understand without technical context.
3. Riskiest assumption: A darker, bolder visual direction improves clarity rather than reducing readability.
4. Evidence to prove/disprove: Successful compile/test run plus direct diff review of copy hierarchy and interaction labels.

## Full Redesign + Meechie Voice Refresh (2026-02-14, autonomous pass)
### Plan
- Goal: Fully redesign the interface to modern/sleek/clean with strong visual polish, and refresh Meechie writing to the latest voice pattern across UI and seam-backed outputs.
- Seams: `MeechieVoiceSeam`, `MeechieToolSeam`.
- Files to touch:
  - `src/routes/+layout.svelte`
  - `src/routes/+page.svelte`
  - `src/lib/components/MeechieTools.svelte`
  - `src/routes/meechie/+page.svelte`
  - `src/lib/adapters/meechie-voice.adapter.ts`
  - `fixtures/meechie-voice/sample.json`
  - `fixtures/meechie-tool/sample.json`
  - `CHANGELOG.md`
  - `DECISIONS.md`
- Exact commands:
  1. `npm run check`
  2. `npm test`
  3. `npm run verify`

### Self-critique
1. What could be wrong: Visual redesign can increase style but reduce clarity if hierarchy and contrast are not tightly controlled.
2. What must be proven: Interface remains usable on desktop/mobile and seam-backed voice output remains deterministic.
3. Riskiest assumption: Voice escalation can stay on-brand without crossing into unreadable or unsafe copy.
4. Evidence to prove/disprove: Green `npm test` + `npm run verify`, updated seam fixtures, and direct file diff for typography/layout/copy hierarchy.

## Gemini Findings Audit (ROI-sorted, current status)
| ROI Rank | Gemini Finding | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| 1 | Unsafe backdoor: Meechie tools bypass safety policy | Fixed | `src/routes/api/tools/+server.ts`, `src/lib/components/MeechieTools.svelte`, `tests/unit/api-tools.test.ts` | Keep endpoint test coverage as tools expand. |
| 2 | Orphaned endpoint: frontend ignores `/api/generate` | Fixed | `src/routes/api/generate/+server.ts`, `src/routes/+page.svelte`, `contracts/generate.contract.ts`, `tests/unit/api-generate.test.ts` | Consolidate any remaining client-side orchestration into this endpoint if new steps are added. |
| 3 | Leaky abstraction: provider adapter imports framework env | Fixed | `src/lib/adapters/provider-adapter.adapter.ts`, `tests/contract/provider-adapter.test.ts` | Keep config injection pattern for future provider changes. |
| 4 | Mock-reality drift in prompt phrases | Fixed | `src/lib/core/constants.ts`, `src/lib/seams/prompt-compiler-seam/mock.ts`, `src/lib/seams/prompt-compiler-seam/fixtures.ts`, `src/lib/adapters/prompt-assembly.adapter.ts`, `src/lib/adapters/drift-detection.adapter.ts` | Keep required phrases sourced from shared constants only. |
| 5 | Hidden censorship in chat interpretation adapter | Fixed | `src/lib/adapters/chat-interpretation.adapter.ts`, `tests/contract/chat-interpretation.test.ts`, `fixtures/chat-interpretation/fault.json` | Preserve contract-based validation and avoid silent client-side blocks. |
| 6 | Magic string sprawl across multiple files | Partial | `src/lib/core/constants.ts`, `src/lib/adapters/prompt-assembly.adapter.ts`, `src/lib/adapters/drift-detection.adapter.ts` | Move remaining repeated prompt formatting lines into a shared prompt-template module if drift appears again. |
| 7 | Ghost workflow: `generation-workflow.ts` not on active UI path | Fixed (2026-02-15) | Removed `src/lib/core/generation-workflow.ts`, `src/lib/core/types.ts`, `src/lib/composition/deps.mock.ts`, `src/lib/composition/deps.server.ts`, `tests/unit/generation-workflow.test.ts` | Keep runtime orchestration constrained to active route pipelines only. |

## Task list
| # | Task | Seams | Files to touch | What will be done | Why |
| --- | --- | --- | --- | --- | --- |
| 1 | Make contract tests part of the real gate | ImageGenerationSeam, ProviderAdapterSeam, OutputPackagingSeam | `vite.config.ts` | Add contract test glob(s) so `npm test` and `npm run verify` execute contract suites. | Current verify can pass while contract failures exist. |
| 2 | Fix `ImageGenerationSeam` contract/fixture mismatch | ImageGenerationSeam | `fixtures/image-generation/sample.json`, `src/lib/adapters/image-generation.adapter.ts`, `tests/contract/image-generation.test.ts` | Normalize empty `revisedPrompt` handling so contract, fixture, and adapter output agree. | Fixture parse currently fails before test assertions run. |
| 3 | Fix `ProviderAdapterSeam` contract/fixture mismatch | ProviderAdapterSeam | `fixtures/provider-adapter/sample.json`, `src/lib/adapters/provider-adapter.adapter.ts`, `tests/contract/provider-adapter.test.ts` | Apply the same `revisedPrompt` normalization for provider image output and fixture. | Same parse failure class as task 2. |
| 4 | Fix brittle browser/canvas contract test | OutputPackagingSeam | `tests/contract/output-packaging.test.ts` (and only if needed `src/lib/adapters/output-packaging.adapter.ts`) | Make svg conversion test deterministic in jsdom (mock canvas or assert expected limitation path). | Test currently expects browser success where canvas is unavailable. |
| 5 | Harden generate flow error handling | ImageGenerationSeam, DriftDetectionSeam, OutputPackagingSeam, CreationStoreSeam (UI orchestration) | `src/routes/+page.svelte` | Ensure `isGenerating` resets via robust async control and make failure states explicit. | Prevent stuck busy state and ambiguous partial success. |
| 6 | Remove mobile action duplication / simplify flow | UI layer (no seam contract change) | `src/routes/+page.svelte` | Keep one clear primary action pattern on mobile and reduce duplicated controls. | Improve ease of use and reduce decision friction. |
| 7 | Make session status truthful | SessionSeam, AuthContextSeam (display only) | `src/routes/+page.svelte` | Replace static ready text with real runtime state labels. | Avoid misleading status messaging. |
| 8 | Finish Meechie tone abstraction | MeechieVoiceSeam, MeechieToolSeam | `src/lib/adapters/meechie-voice.adapter.ts`, `fixtures/meechie-voice/sample.json`, `fixtures/meechie-voice/fault.json`, `docs/meechie-voice-pack.md`, `tests/contract/meechie-voice.test.ts` | Complete voice-pack-as-data path so tone is auditable and deterministic across seams. | Current abstraction is partial. |
| 9 | Record governance evidence and decisions | Governance | `DECISIONS.md`, `CHANGELOG.md` | Add Cipher Gate entry and tradeoff notes for seam-impacting decisions. | Required by repo governance. |
| 10 | Capture final visual evidence | Evidence | `docs/evidence/2026-02-13/` (new screenshots) | Capture desktop and mobile screenshots after fixes. | Provides traceable UX proof. |

## Exact commands to run
1. `npm run rewind -- --seam ImageGenerationSeam`
2. `npm run rewind -- --seam ProviderAdapterSeam`
3. `npm run rewind -- --seam OutputPackagingSeam`
4. `npm run check`
5. `npm test`
6. `npm run verify`
7. `npx playwright screenshot ... docs/evidence/2026-02-13/ui-home-desktop-postfix.png`
8. `npx playwright screenshot ... docs/evidence/2026-02-13/ui-home-mobile-postfix.png`

## Self-critique before implementation
1. Riskiest assumption: whether blank `revisedPrompt` should be treated as absent (`undefined`) or as valid empty content.
2. What must be proven: contract tests pass without weakening contract intent.
3. Failure mode to avoid: loosening schema too broadly to force green tests.
4. Required evidence: green seam-scoped rewinds for affected seams, then green `npm test` and green `npm run verify`, plus updated evidence files.

## Seam-Driven Development wording note
All implementation steps above that touch seams must follow full Seam-Driven Development workflow and evidence capture.
