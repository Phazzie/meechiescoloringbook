// Purpose: Mock RateLimitConfigSeam behavior using fixtures.
// Why: Keep tests deterministic without live env reads.
// Info flow: tests -> mock -> fixtures.
import type { RateLimitConfigSeam } from './contract';
import { getRateLimitConfigFixture } from './fixtures';

export const createMockRateLimitConfigSeam = (
	scenario: 'sample' | 'fault' = 'sample'
): RateLimitConfigSeam => ({
	getConfig: () => getRateLimitConfigFixture(scenario)
});
