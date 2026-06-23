// Purpose: Provide fixture data for RateLimitSeam.
// Why: Ensure deterministic mock and test inputs.
// Info flow: fixtures -> mocks/tests.
import type { RateLimitCheckInput } from './contract';

export const baseRateLimitCheckFixture: RateLimitCheckInput = {
	key: '203.0.113.10',
	maxRequests: 3,
	windowMs: 60_000,
	now: 1_000_000
};

export const exceededRateLimitCheckFixture: RateLimitCheckInput = {
	...baseRateLimitCheckFixture,
	now: baseRateLimitCheckFixture.now + 1
};

export const nextWindowRateLimitCheckFixture: RateLimitCheckInput = {
	...baseRateLimitCheckFixture,
	now: baseRateLimitCheckFixture.now + baseRateLimitCheckFixture.windowMs
};
