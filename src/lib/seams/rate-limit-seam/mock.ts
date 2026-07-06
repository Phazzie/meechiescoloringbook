// Purpose: Mock RateLimitSeam behavior using fixed scenarios.
// Why: Let route tests force an allowed/blocked decision without waiting on real timers.
// Info flow: scenario -> fixed Result -> callers.
import type { RateLimitSeam } from './contract';
import { rateLimitExceededFixture } from './fixtures';

export const createMockRateLimitSeam = (scenario: 'allow' | 'block' = 'allow'): RateLimitSeam => ({
	checkAndConsume: () =>
		scenario === 'block'
			? { ok: false, error: rateLimitExceededFixture }
			: { ok: true, value: undefined }
});
