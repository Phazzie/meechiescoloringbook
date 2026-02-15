<!--
Purpose: Provide a shareable ROI-sorted status table for Gemini audit findings.
Why: Keep architectural findings, current status, and evidence traceable in one place.
Info flow: Gemini findings -> implementation status -> evidence paths -> next actions.
-->
# Gemini Findings Status (2026-02-15)

| ROI Rank | Finding | Status | Evidence | Next action |
| --- | --- | --- | --- | --- |
| 1 | Unsafe backdoor: Meechie tools bypass safety checks | Fixed | `src/lib/core/tools-pipeline.ts`, `src/routes/api/tools/+server.ts`, `tests/unit/api-tools.test.ts` | Keep expanding test coverage as new tools are added. |
| 2 | Orphaned endpoint: frontend bypasses `/api/generate` | Fixed | `src/routes/+page.svelte`, `src/routes/api/generate/+server.ts`, `src/lib/core/generate-pipeline.ts`, `tests/unit/api-generate.test.ts` | Keep all future generation orchestration in the generate pipeline. |
| 3 | Leaky abstraction: provider adapter framework coupling | Fixed | `src/lib/adapters/provider-adapter.adapter.ts`, `tests/contract/provider-adapter.test.ts` | Keep provider configuration via injected args or `process.env`, not framework imports. |
| 4 | Mock-reality drift in prompt constraints | Fixed | `src/lib/core/constants.ts`, `src/lib/core/prompt-template.ts`, `src/lib/seams/prompt-compiler-seam/mock.ts`, `src/lib/adapters/drift-detection.adapter.ts` | Keep prompt-required phrases sourced from shared constants/template helpers only. |
| 5 | Hidden censorship in chat interpretation | Fixed | `src/lib/adapters/chat-interpretation.adapter.ts`, `src/lib/core/chat-interpretation-pipeline.ts`, `src/routes/api/chat-interpretation/+server.ts`, `tests/unit/api-chat-interpretation.test.ts` | Preserve contract/server validation and avoid arbitrary preflight blocking. |
| 6 | Magic string sprawl across route/mock/adapter files | Mostly fixed | `src/lib/core/constants.ts`, `src/lib/core/prompt-template.ts`, `src/lib/core/chat-interpretation-pipeline.ts`, `src/lib/core/tools-pipeline.ts` | Continue migrating remaining repeated literals into shared modules during future refactors. |
| 7 | Ghost workflow: legacy generation workflow path not on active UI path | Fixed | Removed `src/lib/core/generation-workflow.ts`, `src/lib/core/types.ts`, `src/lib/composition/deps.mock.ts`, `src/lib/composition/deps.server.ts`, and `tests/unit/generation-workflow.test.ts`; updated `docs/seams.md` | Keep runtime orchestration in the active endpoint pipelines only. |
