// Purpose: Mock RateLimitSeam behavior using fixed scenarios.
// Why: Let route tests force an allowed/blocked decision without waiting on real timers.
// Info flow: scenario -> fixed Result -> callers.
import type { RateLimitSeam } from './contract';

export const createMockRateLimitSeam = (scenario: 'allow' | 'block' = 'allow'): RateLimitSeam => ({
	checkAndConsume: () =>
		scenario === 'block'
			? {
					ok: false,
					error: {
						code: 'RATE_LIMIT_EXCEEDED',
						message: 'Too many requests. Please try again shortly.',
						retryAfterMs: 30_000
					}
				}
			: { ok: true, value: undefined }
});
