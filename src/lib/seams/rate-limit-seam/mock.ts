// Purpose: Implement deterministic RateLimitSeam scenarios from fixtures.
// Why: Consumers need stable allow/store-failure behavior without a Redis connection.
// Info flow: scenario + consume input -> fixture-backed Result.
import type { RateLimitSeam } from './contract';
import {
	getRateLimitFixture,
	type RateLimitFixtureScenario
} from './fixtures';

export const createMockRateLimitSeam = (
	scenario: RateLimitFixtureScenario = 'sample'
): RateLimitSeam => ({
	consume: async () => {
		const fixture = getRateLimitFixture(scenario);
		return 'code' in fixture
			? { ok: false, error: fixture }
			: { ok: true, value: fixture };
	}
});
