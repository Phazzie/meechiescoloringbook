<!--
Purpose: Explain the self-contained seam folder structure used by all new seams.
Why: Co-locating all seam artifacts reduces navigation cost and drift risk.
Info flow: contract.ts -> probe.ts -> fixtures.ts -> mock.ts -> test.ts -> adapter
           (validators.ts is shared glue — not a sequential step; consumed by contract, tests, and adapter)
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
| `auth-context-seam/` | Auth context and capability detection |
| `cache-seam/` | Web Cache API wrapper for PWA service worker |
| `chat-interpretation-seam/` | Chat input to structured spec translation |
| `creation-store-seam/` | Persist and retrieve generated creations in localStorage |
| `drift-detection-seam/` | Detect prompt drift between assembled and revised prompts (pure) |
| `gallery-store-seam/` | Saved generations, favorites, drafts |
| `image-generation-seam/` | xAI image provider calls |
| `image-provider-config-seam/` | Narrow config: only xAI image-provider env keys |
| `meechie-studio-text-seam/` | AI-backed Meechie voice text generation |
| `meechie-tool-seam/` | Meechie tool dispatch (all 11 tool types) |
| `meechie-voice-seam/` | Meechie voice pack data (deterministic, pure) |
| `output-packaging-seam/` | Package generated images into downloadable PDF/PNG artifacts |
| `prompt-assembly-seam/` | Assemble canonical and compressed prompts (pure) |
| `prompt-compiler-seam/` | Deterministic canonical + compressed prompt compilation |
| `provider-adapter-seam/` | xAI provider chat/image completion adapter |
| `safety-policy-seam/` | Content guardrail enforcement (pure, no external I/O) |
| `session-seam/` | Browser session ID management |
| `spec-validation-seam/` | ColoringPageSpec validation and normalization (pure) |
| `telemetry-seam/` | Telemetry event contract (pure) |
| `wig-catalog-seam/` | Static wig catalog reads |
| `wig-try-on-seam/` | Gemini portrait generation from selfie and wig image |
