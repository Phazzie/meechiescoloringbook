# Decisions

## 2025-01-22 — Stack choice
- **Decision:** Use SvelteKit + TypeScript, Vitest, and Playwright.
- **Why:** SvelteKit provides fast iteration and server routes, TS gives strict typing for seam contracts, Vitest covers unit/contract tests, and Playwright supports end-to-end smoke tests.

## 2025-01-22 — Seam-driven architecture
- **Decision:** Implement seams for AppConfig, PromptCompiler, SafetyPolicy, ImageGeneration, GalleryStore, and Telemetry with mock/fixtures/tests.
- **Why:** This isolates external dependencies, keeps core workflow adapter-free, and allows deterministic testing.

## 2025-01-22 — Prompt enforcement strategy
- **Decision:** Prompt compiler always injects outline-only, no-color constraints plus glam style guidance.
- **Why:** This ensures the coloring-book style is enforced even before image generation.

## 2025-01-22 — Safety policy approach
- **Decision:** Use rules-based validation in the safety seam with explicit error codes.
- **Why:** Deterministic checks prevent disallowed content and missing outline constraints with user-friendly error messages.

## 2025-01-22 — xAI image model configuration
- **Decision:** Default to `grok-2-image` with base URL `https://api.x.ai/v1` and endpoint path `/images/generations`; model is environment-configurable.
- **Why:** These values are from xAI image generation docs; keeping them in config allows swapping without code changes.

## 2025-01-22 — Integration test gating
- **Decision:** Integration tests run only when `FEATURE_INTEGRATION_TESTS=true` and `XAI_API_KEY` is present.
- **Why:** This prevents external API calls in default offline test runs.
