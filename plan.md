## Goal
Reduce production fragility in AI text generation and UI behavior while restoring full Seam-Driven Development proof discipline across the impacted seams.

## Exact seams
- MeechieStudioTextSeam
- ProviderAdapterSeam
- MeechieToolSeam
- PromptAssemblySeam
- ImageGenerationSeam
- CreationStoreSeam / SessionSeam

## Exact file paths to touch
- src/lib/core/meechie-studio-text-pipeline.ts
- src/lib/adapters/meechie-tool.adapter.ts
- src/lib/components/MeechieTools.svelte
- tests/unit/meechie-studio-text.test.ts (or pipeline tests)
- tests/unit/meechie-tool-adapter.test.ts
- tests/contract/meechie-tool.test.ts
- DECISIONS.md

## Exact commands
1. git status --short
2. date -u +"%Y-%m-%d"
3. sed -n '1,260p' docs/seams.md
4. sed -n '1,260p' DECISIONS.md
5. sed -n '1,260p' plan.md
6. npm run rewind -- --seam MeechieStudioTextSeam
7. npm run rewind -- --seam MeechieToolSeam
8. npm run rewind -- --seam ProviderAdapterSeam
9. npm run verify
10. npm test

## Self-critique
- Riskiest assumption: Retrying parsing by catching bounded exceptions and executing another LLM call is fast enough, and the JSON boundary extraction regex is robust against arbitrary fenced responses.
- Proof needed: Tests showing that JSON wrapped in markdown fences parses properly on the first try, tests proving the bounded retry is called once and then yields a deterministic error on total failure. Tests proving random_meechie is deterministic. Tests proving UI race conditions and enum parities are resolved.
