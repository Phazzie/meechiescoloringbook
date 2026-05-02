<!--
Purpose: Capture the current Seam-Driven Development implementation plan with explicit seams, files, tests, commands, risks, and phased execution order.
Why: Enforce deterministic planning and evidence-first execution before any behavior-changing work.
Info flow: Request -> seam inventory -> inspect/modify/test plan -> command evidence -> implementation phases.
-->
# Plan (2026-05-01)

## Explicit Goal
Prepare a governance-compliant, execution-ready plan that maps future work to exact existing seam names, exact files to inspect/modify, exact tests to add/update, exact verification commands, and proof-oriented self-critique before implementation begins.

## Exact Seam Names (from `docs/seams.md`)
- AppConfigSeam
- PromptCompilerSeam
- SafetyPolicySeam
- GalleryStoreSeam
- TelemetrySeam
- AuthContextSeam
- CreationStoreSeam
- PromptAssemblySeam
- ChatInterpretationSeam
- ImageGenerationSeam
- DriftDetectionSeam
- MeechieVoiceSeam
- MeechieToolSeam
- ProviderAdapterSeam
- OutputPackagingSeam
- SessionSeam
- SpecValidationSeam

## Exact Inspect/Modify Files
### Inspect (no edits planned in this pass)
- `AGENTS.md`
- `docs/seams.md`
- `docs/CHECKLIST.md`

### Modify (this pass)
- `plan.md`

## Exact Tests to Add/Update
- No test file changes in this pass (docs/planning-only change).
- Seam-scoped updates that follow from this plan must add/update tests in exact seam paths listed in `docs/seams.md`.
  - Legacy contract tests use kebab-case filenames, not PascalCase seam names.
    - Pattern: `tests/contract/<seam-kebab>.test.ts`
    - Concrete examples (existing): `tests/contract/auth-context.test.ts`, `tests/contract/image-generation.test.ts`.
  - New self-contained seam tests live under `src/lib/seams/<seam-kebab>/test.ts`.

## Exact Command List
1. `npm run check`
2. `npm test`
3. `npm run verify`
4. Optional seam rewind command pattern:
   - `npm run rewind -- --seam <SeamName>`
   - Initial seam candidates for focused rewind: `SessionSeam`, `AuthContextSeam`, `CreationStoreSeam`, `ProviderAdapterSeam`, `ChatInterpretationSeam`, `ImageGenerationSeam`.

## Self-Critique
- **Risk:** A plan can appear complete but still be invalid if seam names, test targets, or evidence paths drift from `docs/seams.md`.
- **Assumption:** Existing seam inventory in `docs/seams.md` is the authoritative source of seam names and mapped test paths.
- **What must be proven:**
- **What must be proven:**
  1. Seam names used during implementation exactly match `docs/seams.md` PascalCase names.
  2. Any seam change includes contract-first verification evidence.
  3. `npm run check`, `npm test`, and `npm run verify` outputs are captured and green.
- **Proof evidence expected:**
  - Canonical evidence file names are defined in `docs/evidence/README.md`.
  - `docs/evidence/YYYY-MM-DD/verify.txt` (output of `npm run verify`)
  - `docs/evidence/YYYY-MM-DD/test.txt` (output of `npm test`)
  - Optional seam rewind outputs such as `docs/evidence/YYYY-MM-DD/rewind-<seam>.txt`.

## Phased Implementation Order (Maps to `docs/CHECKLIST.md` Phase 0–9)
This plan follows the repo checklist’s phase numbering (Phase 0 through Phase 9). The steps below are a narrative version of the same gates.

### Phase 0 - Orientation + Governance Read
- Confirm instructions in `AGENTS.md`, `DECISIONS.md`, `docs/seams.md`, and `docs/CHECKLIST.md`.
- Confirm Wu-Bob roster: GZA, U-God, Method Man (+ Robert C. Martin lens).

### Phase 1 - Seam Inventory Lock
- Copy exact seam names from `docs/seams.md` into the working plan/task context.
- Reject any seam naming that does not exactly match the inventory.

### Phase 2 - File Scope Lock
- Declare exact inspect files and exact modify files before edits.
- Keep scope minimal; if scope expands, update this plan first.

### Phase 3 - Contract/Test Mapping
- Map each targeted seam to exact contract path, mock path, adapter path, and test path from `docs/seams.md`.
- Define precise tests to add/update before code edits.

### Phase 4 - Probe/Fixture Strategy
- For world-touching seams, define required probes and fixture refresh paths.
- If blocked, record an Assumption entry in `DECISIONS.md` and run `npm run assumption:alarm`.

### Phase 5 - Implementation
- Execute changes seam-by-seam in contract-first order.
- Keep changes deterministic and aligned with fixture-backed mocks.

### Phase 6 - Seam Verification
- Run optional focused rewinds per changed seam using `npm run rewind -- --seam <SeamName>`.
- Ensure red/green proof expectations are satisfied for modified seam contracts.

### Phase 7 - Full Verification
- Run `npm run check`, `npm run test`, and `npm run verify`.
- Store outputs under `docs/evidence/YYYY-MM-DD/`.

### Phase 8 - Documentation + Final Status
- Update `DECISIONS.md` (Cipher Gate and/or Assumption entries as required), plus other governance docs when applicable.
- Capture final repository status and prepare commit/PR summary tied to evidence paths.

### Phase 9 - Final Status
- Capture final repository status and prepare commit/PR summary tied to evidence paths.
