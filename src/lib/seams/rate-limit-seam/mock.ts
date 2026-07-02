// Purpose: Provide a test-facing RateLimitSeam factory.
// Why: Keep the mock aligned with the real deterministic limiter implementation.
// Info flow: tests -> mock factory -> in-memory limiter implementation.
export { createRateLimitSeam as createMockRateLimitSeam } from './limiter';
