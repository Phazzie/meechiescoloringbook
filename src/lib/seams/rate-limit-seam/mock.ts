// Purpose: Provide a test-facing RateLimitSeam factory.
// Why: Keep existing mock imports stable while sharing the deterministic limiter implementation.
// Info flow: tests -> mock factory -> pure fixed-window limiter implementation.
export { createRateLimitSeam as createMockRateLimitSeam } from './limiter';
