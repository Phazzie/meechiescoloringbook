<!--
Purpose: Explain the self-contained seam folder structure used by all new seams.
Why: Co-locating all seam artifacts reduces navigation cost and drift risk.
Info flow: contract.ts -> probe.ts -> fixtures.ts -> mock.ts -> test.ts -> validators.ts -> adapter
-->
# Seam folder structure

Each folder here contains the core artifacts for a seam (contract, mock, tests, fixtures). The adapter lives separately at `src/lib/adapters/<seam-name>/index.ts`. The Seam-Driven Development workflow (from `AGENTS.md`) maps to these files:

| File | Workflow step | Role |
|------|--------------|------|
| `contract.ts` | Step 1 | Types, Zod schema, explicit failure modes |
| `fixtures.ts` | Step 3 | Sample + fault data — defined in-module or backed by co-located JSON files |
| `mock.ts` | Step 4 | Loads fixture scenarios from `fixtures.ts` (and any co-located JSON assets); zero invented data |
| `probe.ts` | Step 2 | Captures real external behavior; run manually to refresh |
| `test.ts` | Step 5 | Contract tests — mock first, fault fixture must fail |
| `validators.ts` | — | Zod validators exported for adapter and test reuse |

Some seams are pure or dependency-injected and have no separate adapter. When an adapter exists, it lives at `src/lib/adapters/<seam-name>/index.ts`; it may be sync or async depending on the contract.

## Current seams

> **Non-authoritative snapshot** — for paths, probe status, and owner, see `docs/seams.md`.

| Folder | What it covers |
|--------|----------------|
| `app-config-seam/` | Reads env-var-based app configuration at runtime |
| `prompt-compiler-seam/` | Deterministic canonical + compressed prompt compilation |
| `safety-policy-seam/` | Content guardrail enforcement (pure, no external I/O) |
| `gallery-store-seam/` | Saved generations, favorites, drafts |
| `telemetry-seam/` | Telemetry event contract (pure) |
| `image-generation-seam/` | xAI image provider calls |
