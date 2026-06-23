// Purpose: Provide a deterministic RateLimitSeam mock for tests.
// Why: src/lib/seams/AGENTS.md requires mock.ts to load fixtures under specific scenarios rather
//      than bypass them. This seam has no external I/O to fake — the "real" implementation is
//      pure sliding-window arithmetic — so the 'sample' scenario runs that algorithm directly,
//      while 'fault' returns the fixed RATE_LIMIT_EXCEEDED fixture regardless of input, for
//      exercising consumer error handling (e.g. rate-limit-guard.ts) without driving a real budget.
// Info flow: tests/consumers -> mock -> fixtures (fault) | limiter (sample).
import type { RateLimitResult, RateLimitSeam } from './contract';
import { createRateLimitSeam } from './limiter';
import { rateLimitFaultFixture } from './fixtures';

export const createMockRateLimitSeam = (scenario: 'sample' | 'fault' = 'sample'): RateLimitSeam => {
	if (scenario === 'fault') {
		return {
			checkAndConsume: (): RateLimitResult => ({
				ok: false,
				error: structuredClone(rateLimitFaultFixture)
			})
		};
	}
	return createRateLimitSeam();
};
