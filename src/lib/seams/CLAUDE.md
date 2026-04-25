<!--
Purpose: Explain the self-contained seam folder structure used by all new seams.
Why: Co-locating all seam artifacts reduces navigation cost and drift risk.
Info flow: contract.ts -> fixtures.ts -> mock.ts -> probe.ts -> test.ts -> validators.ts -> adapter
-->
# Seam folder structure

Each folder here is a fully self-contained seam. The Seam-Driven Development workflow (from `AGENTS.md`) maps to these files:

| File | Workflow step | Role |
|------|--------------|------|
| `contract.ts` | Step 1 | Types, Zod schema, explicit failure modes |
| `fixtures.ts` | Step 3 | In-module sample + fault data (no JSON files needed) |
| `mock.ts` | Step 4 | Loads fixtures by scenario; zero invented data |
| `probe.ts` | Step 2 | Captures real external behavior; run manually to refresh |
| `test.ts` | Step 5 | Contract tests — mock first, fault fixture must fail |
| `validators.ts` | — | Zod validators exported for adapter and test reuse |

Adapter lives at `src/lib/adapters/<seam-name>/index.ts` (real I/O only, async, JailedFs).

## Current seams

| Folder | What it covers |
|--------|----------------|
| `app-config-seam/` | Reads env-var-based app configuration at runtime |
| `prompt-compiler-seam/` | Deterministic canonical + compressed prompt compilation |
| `safety-policy-seam/` | Content guardrail enforcement (pure, no external I/O) |
| `gallery-store-seam/` | Saved generations, favorites, drafts |
| `telemetry-seam/` | Telemetry event contract (pure) |
| `image-generation-seam/` | xAI image provider calls |

For probe status and last-probed dates, see `docs/seams.md`.
