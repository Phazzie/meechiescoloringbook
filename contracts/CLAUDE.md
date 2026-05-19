<!--
Purpose: Note that contract files here belong to the legacy flat seam layout.
Why: Prevent new seams from being added here; new seams use src/lib/seams/<name>/.
Info flow: contracts/<seam>.contract.ts -> src/lib/mocks/ -> tests/contract/ -> src/lib/adapters/
-->
# Legacy flat-layout seams

Contract files in this folder belong to the **legacy flat layout**. Each one has companions at:

- Mock: `src/lib/mocks/<seam>.mock.ts`
- Adapter: `src/lib/adapters/<seam>.adapter.ts`
- Tests: `tests/contract/<seam>.test.ts`
- Fixtures: `fixtures/<seam>/` (JSON files)

**Do not add new contracts here.** New seams go under `src/lib/seams/<seam-name>/` using the self-contained layout — see `src/lib/seams/CLAUDE.md`.

See `docs/seams.md` for the full seam registry with probe status and owners.

## Migration status

The following contracts have been **migrated** to the self-contained layout and are now **re-export shims** pointing to their canonical location under `src/lib/seams/`:

| File | Canonical location |
|------|--------------------|
| `drift-detection.contract.ts` | `src/lib/seams/drift-detection-seam/` |
| `meechie-tool.contract.ts` | `src/lib/seams/meechie-tool-seam/` |
| `meechie-voice.contract.ts` | `src/lib/seams/meechie-voice-seam/` |
| `output-packaging.contract.ts` | `src/lib/seams/output-packaging-seam/` |
| `prompt-assembly.contract.ts` | `src/lib/seams/prompt-assembly-seam/` |
| `spec-validation.contract.ts` | `src/lib/seams/spec-validation-seam/` |

The following contracts remain in the **legacy flat layout** (migration pending):

`auth-context.contract.ts`, `chat-interpretation.contract.ts`, `creation-store.contract.ts`, `image-generation.contract.ts`, `meechie-studio-text.contract.ts`, `provider-adapter.contract.ts`, `session.contract.ts`
