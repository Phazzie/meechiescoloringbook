// Purpose: Provide fixture data for RateLimitSeam.
// Why: Ensure deterministic test inputs across contract tests.
// Info flow: fixtures -> tests.
import type { RateLimitConsumeInput } from './contract';

export const sampleConsumeInput: RateLimitConsumeInput = {
	key: 'test-route:127.0.0.1',
	limit: 3,
	windowMs: 60_000
};

// A zero-limit consume input deterministically triggers RATE_LIMITED on the very first call
// (count 1 > limit 0), so it exercises the fault path without depending on call history.
export const faultConsumeInput: RateLimitConsumeInput = {
	key: 'test-route:203.0.113.1',
	limit: 0,
	windowMs: 60_000
};
