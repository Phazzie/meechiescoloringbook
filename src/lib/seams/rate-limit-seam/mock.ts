// Purpose: Provide a test-facing RateLimitSeam factory.
// Why: Keep existing mock imports stable while sharing the deterministic sliding-window implementation.
// Info flow: tests -> mock factory -> pure rate-limit implementation.
export { createRateLimitSeam as createMockRateLimitSeam } from './policy';
