// Purpose: Provide fixture data for RateLimitSeam.
// Why: Ensure deterministic mock and test inputs for the pure sliding-window evaluation.
// Info flow: fixtures -> mocks/tests.
import type { RateLimitError, RateLimitRule } from './contract';

export const sampleRuleFixture: RateLimitRule = {
	limit: 3,
	windowMs: 60_000
};

export const rateLimitExceededFixture: RateLimitError = {
	code: 'RATE_LIMIT_EXCEEDED',
	message: 'Too many requests. Please try again shortly.',
	retryAfterMs: 30_000
};

export const emptyTimestampsFixture: number[] = [];

export const underLimitTimestampsFixture: number[] = [1_000, 2_000];

export const atLimitTimestampsFixture: number[] = [1_000, 2_000, 3_000];

export const expiredTimestampsFixture: number[] = [1_000, 2_000, 3_000];
export const expiredTimestampsNowFixture = 3_000 + sampleRuleFixture.windowMs + 1;
