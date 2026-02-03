<!--
Purpose: Inventory of seams and their contracts.
Why: Keep seam coverage visible and auditable.
Info flow: Seam list -> planning -> probe/test updates.
-->
# Seams

## Template
| Seam | Contract | Probe | Fixtures | Mock | Tests | Adapter | Owner | Last probe | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| example | contracts/example.contract.ts | probes/example.probe.ts | fixtures/example/ | src/lib/mocks/example.mock.ts | tests/contract/example.test.ts | src/lib/adapters/example.adapter.ts | name | YYYY-MM-DD | short note |

## Notes
- Seam names are exact PascalCase (e.g., AuthContextSeam). Only file names are kebab-case.
- Probe status: use `N/A (pure)` for pure seams; use `TBD (blocked)` only when real-world probing is required but credentials/environment are missing.
- File paths listed here are provisional until the contract exists; update during the explicit contract step.
- Owner must be set before implementation begins for that seam.
- Last probe applies only to seams that touch the world; pure seams use `N/A`.

## Current seams
| Seam | Contract | Probe | Fixtures | Mock | Tests | Adapter | Owner | Last probe | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AuthContextSeam | contracts/auth-context.contract.ts | TBD (blocked) | fixtures/auth-context/ | src/lib/mocks/auth-context.mock.ts | tests/contract/auth-context.test.ts | src/lib/adapters/auth-context.adapter.ts | hbpheonix | TBD | adapter/mock/tests present; probe blocked |
| CreationStoreSeam | contracts/creation-store.contract.ts | TBD (blocked) | fixtures/creation-store/ | src/lib/mocks/creation-store.mock.ts | tests/contract/creation-store.test.ts | src/lib/adapters/creation-store.adapter.ts | hbpheonix | TBD | adapter/mock/tests present; verify pending |
| PromptAssemblySeam | contracts/prompt-assembly.contract.ts | N/A (pure) | fixtures/prompt-assembly/ | src/lib/mocks/prompt-assembly.mock.ts | tests/contract/prompt-assembly.test.ts | src/lib/adapters/prompt-assembly.adapter.ts | hbpheonix | N/A | adapter/mock/tests present; verify pending |
| ChatInterpretationSeam | contracts/chat-interpretation.contract.ts | probes/chat-interpretation.probe.mjs | fixtures/chat-interpretation/ | src/lib/mocks/chat-interpretation.mock.ts | tests/contract/chat-interpretation.test.ts | src/lib/adapters/chat-interpretation.adapter.ts | hbpheonix | 2026-02-01 | adapter/mock/tests present; probe ok; fixtures updated |
| ImageGenerationSeam | contracts/image-generation.contract.ts | probes/image-generation.probe.mjs | fixtures/image-generation/ | src/lib/mocks/image-generation.mock.ts | tests/contract/image-generation.test.ts | src/lib/adapters/image-generation.adapter.ts | hbpheonix | 2026-02-01 | adapter/mock/tests present; probe ok; fixtures updated |
| DriftDetectionSeam | contracts/drift-detection.contract.ts | N/A (pure) | fixtures/drift-detection/ | src/lib/mocks/drift-detection.mock.ts | tests/contract/drift-detection.test.ts | src/lib/adapters/drift-detection.adapter.ts | hbpheonix | N/A | adapter/mock/tests present; verify pending |
| MeechieToolSeam | contracts/meechie-tool.contract.ts | N/A (pure) | fixtures/meechie-tool/ | src/lib/mocks/meechie-tool.mock.ts | tests/contract/meechie-tool.test.ts | src/lib/adapters/meechie-tool.adapter.ts | hbpheonix | N/A | adapter/mock/tests present; verify pending |
| ProviderAdapterSeam | contracts/provider-adapter.contract.ts | probes/provider-adapter.probe.mjs | fixtures/provider-adapter/ | src/lib/mocks/provider-adapter.mock.ts | tests/contract/provider-adapter.test.ts | src/lib/adapters/provider-adapter.adapter.ts | hbpheonix | 2026-02-01 | adapter/mock/tests present; probe ok; fixtures updated |
| OutputPackagingSeam | contracts/output-packaging.contract.ts | N/A (pure) | fixtures/output-packaging/ | src/lib/mocks/output-packaging.mock.ts | tests/contract/output-packaging.test.ts | src/lib/adapters/output-packaging.adapter.ts | hbpheonix | N/A | adapter/mock/tests present; verify pending |
| SessionSeam | contracts/session.contract.ts | TBD (blocked) | fixtures/session/ | src/lib/mocks/session.mock.ts | tests/contract/session.test.ts | src/lib/adapters/session.adapter.ts | hbpheonix | TBD | adapter/mock/tests present; probe blocked |
| SpecValidationSeam | contracts/spec-validation.contract.ts | N/A (pure) | fixtures/spec-validation/ | src/lib/mocks/spec-validation.mock.ts | tests/contract/spec-validation.test.ts | src/lib/adapters/spec-validation.adapter.ts | hbpheonix | N/A | adapter/mock/tests present; verify pending |
