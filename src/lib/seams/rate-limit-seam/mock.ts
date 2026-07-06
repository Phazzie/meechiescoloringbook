// Purpose: Provide a test-facing RateLimitSeam factory.
// Why: Keep mock imports stable while sharing the deterministic in-memory limiter implementation.
// Info flow: tests -> mock factory -> pure fixed-window limiter implementation.
//
// Unlike RateLimitConfigSeam's mock (which reads env-like config once at construction time and
// therefore needs a scenario switch to pick which canned config to return), RateLimitSeam is
// pure and dependency-injected: every fixture in fixtures.ts (sample/fault/backward-clock/
// fractional/infinite/NaN) is a full RateLimitCheckInput passed directly to checkAndConsume() as
// a per-call argument in test.ts, not a constructor-time selection. There is no live I/O to swap
// out and no hidden state a scenario string would need to select between — the real
// implementation from policy.ts already is the deterministic, fixture-driven behavior, so
// re-exporting it here (rather than adding an unused scenario parameter) is correct, not a
// shortcut.
export { createRateLimitSeam as createMockRateLimitSeam } from './policy';
