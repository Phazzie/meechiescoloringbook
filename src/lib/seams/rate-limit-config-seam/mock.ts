// Purpose: Mock RateLimitConfigSeam behavior using fixtures.
// Why: Keep tests deterministic without live env reads.
// Info flow: tests -> mock -> fixtures.
import type { RateLimitConfigSeam } from './contract';
import { getRateLimitConfigFixture } from './fixtures';

export const createMockRateLimitConfigSeam = (
	scenario: 'sample' | 'fault' = 'sample'
): RateLimitConfigSeam => ({
	// Fresh copy each call: getRateLimitConfigFixture returns the module-scoped fixture by
	// reference, so handing it out directly would let one test's mutation of the returned
	// object leak into every later call.
	getConfig: () => ({ ...getRateLimitConfigFixture(scenario) })
});
