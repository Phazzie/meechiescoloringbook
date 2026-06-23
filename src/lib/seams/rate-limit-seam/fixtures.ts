// Purpose: Provide fixture data for RateLimitSeam tests.
// Why: Ensure deterministic mock/test inputs without depending on wall-clock time.
// Info flow: fixtures -> mock/tests.
import type { RateLimitCheckInput, RateLimitError } from './contract';

export const sampleKey = 'generate:203.0.113.10';

export const sampleCheckInput: RateLimitCheckInput = {
	key: sampleKey,
	limit: 3,
	windowMs: 60_000,
	nowMs: 1_000_000
};

export const invalidCheckInputFixtures: unknown[] = [
	{ ...sampleCheckInput, key: '' },
	{ ...sampleCheckInput, limit: 0 },
	{ ...sampleCheckInput, limit: -1 },
	{ ...sampleCheckInput, limit: 1.5 },
	{ ...sampleCheckInput, windowMs: 0 },
	{ ...sampleCheckInput, windowMs: -500 },
	{ ...sampleCheckInput, nowMs: Number.NaN },
	{ ...sampleCheckInput, nowMs: -100 },
	{ ...sampleCheckInput, limit: Number.POSITIVE_INFINITY },
	{ ...sampleCheckInput, windowMs: Number.POSITIVE_INFINITY },
	{ ...sampleCheckInput, nowMs: Number.POSITIVE_INFINITY },
	'not-an-object'
];

// Used by the mock's 'fault' scenario: a fixed RATE_LIMIT_EXCEEDED response, independent of
// whatever input the caller passes, for exercising consumer error handling without driving the
// real algorithm through a full budget.
export const rateLimitFaultFixture: RateLimitError = {
	code: 'RATE_LIMIT_EXCEEDED',
	message: `Rate limit of ${sampleCheckInput.limit} requests per ${sampleCheckInput.windowMs}ms exceeded.`,
	resetAtMs: sampleCheckInput.nowMs + sampleCheckInput.windowMs
};
