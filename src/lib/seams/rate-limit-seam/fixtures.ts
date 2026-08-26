// Purpose: Provide deterministic sample and fault fixtures for RateLimitSeam.
// Why: Contract mocks and tests must use shared reality-shaped values instead of invented data.
// Info flow: fixture scenario -> mock/contract test -> schema validation.
import type {
	RateLimitConsumeInput,
	RateLimitDecision,
	RateLimitError
} from './contract';

const FIXTURE_DIGEST = 'a'.repeat(64);

export const rateLimitConsumeFixture: RateLimitConsumeInput = {
	identityKey: `rl:client:${FIXTURE_DIGEST}`,
	bucket: 'text',
	limit: 20,
	windowMs: 60_000,
	cost: 1
};

export const rateLimitDecisionFixture: RateLimitDecision = {
	allowed: true,
	limit: 20,
	used: 1,
	remaining: 19,
	resetAtMs: 60_000
};

// Intentionally inconsistent: used=1 requires remaining=19, not 20.
export const rateLimitDecisionFaultFixture = {
	allowed: true,
	limit: 20,
	used: 1,
	remaining: 20,
	resetAtMs: 60_000
} as unknown as RateLimitDecision;

export const rateLimitStoreErrorFixture: RateLimitError = {
	code: 'RATE_LIMIT_STORE_ERROR',
	message: 'Rate limit storage is unavailable.'
};

export type RateLimitFixtureScenario = 'sample' | 'invalid_decision' | 'store_error';

export const getRateLimitFixture = (scenario: RateLimitFixtureScenario) => {
	if (scenario === 'invalid_decision') return rateLimitDecisionFaultFixture;
	if (scenario === 'store_error') return rateLimitStoreErrorFixture;
	return rateLimitDecisionFixture;
};
