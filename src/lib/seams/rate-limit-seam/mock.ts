// Purpose: Provide a test-facing RateLimitSeam factory.
// Why: Keep mock imports stable while sharing the deterministic in-memory limiter implementation.
// Info flow: tests -> mock factory -> pure fixed-window limiter implementation.
export { createRateLimitSeam as createMockRateLimitSeam } from './policy';
