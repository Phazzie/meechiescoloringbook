// Purpose: Deterministic sample/fault fixtures for RateLimitSeam contract tests.
// Why: Keep mock behavior fixture-backed instead of ad hoc test literals.
// Info flow: fixtures -> mock/tests -> assertions.
import type { RateLimitCheckInput } from './contract';

export const rateLimitSampleInput: RateLimitCheckInput = {
	key: 'sample-route:127.0.0.1',
	limit: 3,
	windowMs: 60_000
};

// Fault fixture: a zero limit is invalid (every route must allow at least 1 request per window).
export const rateLimitFaultInput = {
	key: 'sample-route:127.0.0.1',
	limit: 0,
	windowMs: 60_000
};
