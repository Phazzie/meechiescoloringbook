// Purpose: Mock RateLimitConfigSeam behavior using fixtures.
// Why: Keep tests deterministic without live env reads.
// Info flow: tests -> mock -> fixtures.
import type { RateLimitConfigSeam } from './contract';
import { getRateLimitConfigFixture } from './fixtures';

export const createMockRateLimitConfigSeam = (
	scenario: 'sample' | 'fault' = 'sample'
): RateLimitConfigSeam => ({
	// Fresh copy per call: the fixture is a module-scoped object, and callers must not be
	// able to leak a mutation into a later getConfig() call by mutating what they got back.
	getConfig: () => ({ ...getRateLimitConfigFixture(scenario) })
});
