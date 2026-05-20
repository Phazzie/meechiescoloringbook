<!--
Purpose: Document the remaining non-seam wire-format contracts in this folder.
Why: Prevent new seams from being added here; all seams are now self-contained.
Info flow: contracts/<wire-format>.contract.ts -> core pipelines -> routes
-->
# Wire-format contracts

All legacy flat-layout seam contracts have been migrated to `src/lib/seams/<name>-seam/` (migration completed 2026-05-18). The remaining files in this folder are **wire-format contracts** used directly by API route handlers and core pipelines — they are not seam boundaries:

| File | Purpose |
|------|---------|
| `shared.contract.ts` | Shared Zod helpers (`resultSchema`, `NonEmptyStringSchema`, `ScenarioSchema`, etc.) |
| `generate.contract.ts` | `/api/generate` request/response wire format |
| `image-generation.contract.ts` | `/api/image-generation` wire format (GeneratedImage with format/mimeType/data/encoding); kept separate from `image-generation-seam/contract.ts` which uses a different internal type |
| `wig-try-on.contract.ts` | `/api/wig-try-on` request/response wire format |

**Do not add new seam contracts here.** New seams go under `src/lib/seams/<seam-name>-seam/` using the self-contained layout — see `src/lib/seams/CLAUDE.md`.

See `docs/seams.md` for the full seam registry with probe status and owners.
