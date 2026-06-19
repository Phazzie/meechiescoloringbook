// Purpose: Provide fixture data for RateLimitSeam.
// Why: Ensure deterministic mock and test inputs.
// Info flow: fixtures -> mocks/tests.
import type { RateLimitCheckRequest, RateLimitConfig } from './contract';

export const rateLimitConfigFixture: RateLimitConfig = {
	maxRequests: 3,
	windowMs: 60_000
};

export const rateLimitCheckRequestFixture: RateLimitCheckRequest = {
	key: 'ip:203.0.113.5',
	nowMs: 1_000
};

// Intentionally invalid: empty key fails rateLimitCheckRequestSchema's min(1) check.
export const rateLimitCheckRequestFaultFixture: unknown = {
	key: '',
	nowMs: 1_000
};
