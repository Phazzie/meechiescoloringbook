// Purpose: Provide fixture data for RateLimitSeam.
// Why: Ensure deterministic test inputs across contract tests.
// Info flow: fixtures -> tests.
import type { RateLimitConsumeInput } from './contract';

export const sampleConsumeInput: RateLimitConsumeInput = {
	key: 'test-route:127.0.0.1',
	limit: 3,
	windowMs: 60_000
};
