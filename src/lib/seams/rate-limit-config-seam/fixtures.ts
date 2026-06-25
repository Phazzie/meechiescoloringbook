// Purpose: Provide fixture data for RateLimitConfigSeam.
// Why: Ensure deterministic mock and test inputs.
// Info flow: fixtures -> mocks/tests.
import { rateLimitConfigSchema } from './validators';
import type { RateLimitConfig } from './contract';

// Parsed at module load so schema drift surfaces as a ZodError immediately.
export const rateLimitConfigFixture: RateLimitConfig = rateLimitConfigSchema.parse({
	rateLimitMaxRequests: 20,
	rateLimitWindowMs: 60_000
});

// Intentionally invalid: a fractional rateLimitMaxRequests fails the int contract.
// Not parsed at module load — doing so would throw at import time and break all consumers.
export const rateLimitConfigFaultFixture = {
	rateLimitMaxRequests: 1.5,
	rateLimitWindowMs: 60_000
} as unknown as RateLimitConfig;

export const getRateLimitConfigFixture = (scenario: 'sample' | 'fault' = 'sample') =>
	scenario === 'fault' ? rateLimitConfigFaultFixture : rateLimitConfigFixture;
