<!--
Purpose: Provide a self-contained autonomous execution plan for the Meechie Voice Engine overhaul.
Why: Ensure Seam-Driven Development compliance, deterministic behavior, and verifiable evidence before and during implementation.
Info flow: Product goals + seam inventory -> phased execution -> tests/verification -> check-ins -> self-review -> PR evidence.
-->
# Autonomous Execution Plan — Meechie Voice Engine + Mode Exposure (2026-05-01)

## 1) Goal
Ship a deterministic, testable Meechie Voice Engine upgrade that:
- replaces weak generic voice copy with canon-aligned voice,
- adds structured quote metadata,
- enforces third-person usage as **sometimes** (not banned, not forced),
- adds deterministic quote quality scoring with penalties for generic drift,
- improves tool outputs for major Meechie modes,
- exposes major supported modes in UI,
- updates product-fit filtering so normal jail/prison/court/street-life context is not blocked,
- preserves coloring-page prompt constraints and generation behavior.

## 2) Exact Seam Names Involved (from `docs/seams.md`)
- `MeechieVoiceSeam`
- `MeechieToolSeam`
- `PromptAssemblySeam`
- `DriftDetectionSeam`
- `SpecValidationSeam`

## 3) Exact Files To Inspect
- `AGENTS.md`
- `CLAUDE.md`
- `docs/seams.md`
- `DECISIONS.md`
- `CHANGELOG.md`
- `contracts/meechie-voice.contract.ts`
- `contracts/meechie-tool.contract.ts`
- `src/lib/adapters/meechie-voice.adapter.ts`
- `src/lib/adapters/meechie-tool.adapter.ts`
- `src/lib/core/tools-pipeline.ts`
- `src/lib/core/constants.ts`
- `src/lib/core/generate-pipeline.ts`
- `src/routes/api/tools/+server.ts`
- `src/routes/api/generate/+server.ts`
- `src/routes/+page.svelte`
- `src/routes/who-fucked-up/+page.svelte`
- `src/routes/rate-his-excuse/+page.svelte`
- `src/routes/random/+page.svelte`
- `src/routes/meechie/+page.svelte`
- Existing test files under `tests/contract/` and `tests/unit/` for tools/generation pipelines

## 4) Exact Files To Modify (execution target)
### Contracts
- `contracts/meechie-voice.contract.ts` (quote metadata schema + third-person usage enum)
- `contracts/meechie-tool.contract.ts` (tool shape adjustments if needed for `who_fucked_up`)

### Core / adapters
- `src/lib/adapters/meechie-voice.adapter.ts` (canon quote pack + metadata + corrected third-person guidance)
- `src/lib/adapters/meechie-tool.adapter.ts` (deterministic mode behavior refresh)
- `src/lib/core/tools-pipeline.ts` (product-fit filtering adjustments)
- `src/lib/core/constants.ts` (disallowed keyword policy; remove `illegal` keyword block)
- `src/lib/core/generate-pipeline.ts` (only if needed to preserve generation wording checks)
- `src/lib/core/meechie-quote-scoring.ts` (new deterministic scoring module)

### UI
- `src/routes/+page.svelte` (mode exposure for major contract-supported tools)
- Optional: add reusable mode route/component if duplication appears

### Tests
- `tests/contract/meechie-voice.test.ts`
- `tests/contract/meechie-tool.test.ts`
- `tests/unit/api-tools.test.ts`
- `tests/unit/*tools*` (or create focused deterministic scoring tests)
- `tests/unit/*generate*` (phrase-preservation assertion if needed)

### Docs/Evidence
- `plan.md`
- `DECISIONS.md` (Cipher Gate + tradeoffs)
- `CHANGELOG.md` (user-visible updates)
- `docs/seams.md` (only if seam inventory changes)
- `docs/evidence/YYYY-MM-DD/*` (verify/test outputs)

## 5) Exact Tests To Add Or Update
1. Voice pack contract validation with metadata fields.
2. Approved keeper quotes present in voice pack.
3. Third-person policy explicitly allows “sometimes”.
4. Banned weak phrases are penalized by deterministic scorer.
5. Default random mode excludes non-default/raw-only entries.
6. `rate_excuse` deterministic ratings for known excuses.
7. `apology_translator` deterministic translation for weak apology inputs.
8. Who-fault tool behavior deterministic and mode-correct.
9. Tools pipeline accepts jail/prison/court/probation/parole context.
10. Tools pipeline still rejects truly disallowed categories.
11. Generation prompt still includes required phrases:
   - `Black-and-white coloring book page`
   - `outline-only`
   - `easy to color`
   - `Crisp vector-like linework`
   - `NEGATIVE PROMPT:`

## 6) Exact Commands To Run
- `npm run check`
- `npm run lint`
- `npm run test`
- `npm run test:unit`
- `npm run verify`
- `npm run rewind -- --seam MeechieVoiceSeam`
- `npm run rewind -- --seam MeechieToolSeam`
- `git status`
- `git add -A`
- `git commit -m "<scoped message>"`

## 7) Periodic Check-In Cadence (autonomous work checkpoints)
- **Check-in A (after Phase 1 audit):** confirm baseline behavior and seam impact map.
- **Check-in B (after contract/scoring implementation):** confirm schema and scorer determinism via focused tests.
- **Check-in C (after adapter + pipeline updates):** confirm voice outputs and filtering behavior.
- **Check-in D (after UI mode exposure):** confirm route UX matches contract modes.
- **Check-in E (final verification):** summarize check/test/verify outputs + evidence paths + risks.

## 8) Self-Critique
### What could be wrong
- Overfitting scoring heuristics to canned phrases rather than durable voice traits.
- Accidentally changing output contracts consumed by routes/UI.
- Breaking generation prompt phrase guarantees while touching voice/tool logic.
- Introducing nondeterminism in random quote selection or tool behavior.

### What must be proven
- Contract validity + deterministic outputs under repeated identical inputs.
- Product-fit filtering accepts app-world contexts without opening unrelated categories.
- Required prompt constraints remain intact post-change.
- Verify chain evidence is captured and traceable.

### Riskiest assumption
- That filtering can be safely narrowed by removing `illegal` keyword matching without degrading expected rejection behavior for truly disallowed content.

### Evidence to prove/disprove
- Passing targeted unit/contract tests for tools + scorer + voice pack.
- Passing `npm run check`, `npm run test`, and `npm run verify` outputs.
- Evidence artifacts under `docs/evidence/2026-05-01/`.

## 9) Phased Implementation Order
### Phase 1 — Audit + baseline tests
Capture current behavior and failing points.

### Phase 2 — Voice contract metadata
Add structured quote schema and enums; update types.

### Phase 3 — Deterministic quote scoring
Create pure scoring module + tests + penalty bands.

### Phase 4 — Voice pack replacement
Load canon quotes with metadata and corrected third-person guidance.

### Phase 5 — Tool adapter behavior upgrade
Improve mode outputs and deterministic selection logic.

### Phase 6 — Product-fit filtering update
Remove blunt `illegal` blocking and tighten disallowed policy scope.

### Phase 7 — UI mode exposure alignment
Expose major modes from contract in home UX/pathing.

### Phase 8 — Full test + verify pass
Run check/test/verify + seam rewinds; capture evidence outputs.

### Phase 9 — Docs + release notes + PR prep
Update DECISIONS/CHANGELOG/plan to match actuals and summarize risks/remaining work.

## 10) Immediate delta completed in this pass
- Updated disallowed keywords policy to remove blanket `illegal` keyword blocking from:
  - `src/lib/core/constants.ts`

