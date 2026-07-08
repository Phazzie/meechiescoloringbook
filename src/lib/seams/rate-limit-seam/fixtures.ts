// Purpose: Provide fixture data for RateLimitSeam tests.
// Why: Ensure deterministic mock and test inputs without relying on real wall-clock timing.
// Info flow: fixtures -> mock/tests.

export const sampleKey = 'generate:203.0.113.7';
export const sampleConfig = { limit: 3, windowMs: 60_000 };

export const rateLimitExceededFixture = {
	code: 'RATE_LIMIT_EXCEEDED' as const,
	message: 'Too many requests. Please slow down and try again shortly.',
	retryAfterMs: 60_000
};
