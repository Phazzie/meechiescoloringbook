// Purpose: Provide a test-facing RateLimitSeam factory.
// Why: Keep mock-import naming consistent with other seams while sharing the one
//      deterministic limiter implementation (no separate I/O exists to mock).
// Info flow: tests -> mock factory -> pure sliding-window limiter implementation.
export { createRateLimitSeam as createMockRateLimitSeam } from './limiter';
