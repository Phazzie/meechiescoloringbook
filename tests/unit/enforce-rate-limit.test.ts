// Purpose: Unit tests for the enforceRateLimit route helper.
// Why: Verify pass-through under the limit and a 429 + Retry-After response once exceeded.
// Info flow: enforceRateLimit(routeName, clientAddress) -> RateLimitCheck.
import { describe, expect, it } from 'vitest';
import { SYSTEM_CONSTANTS } from '../../src/lib/core/constants';
import { enforceRateLimit } from '../../src/lib/server/enforce-rate-limit';

describe('enforceRateLimit', () => {
	it('allows requests up to the configured limit for a given route+client key', () => {
		const routeName = 'test-route-allow';
		for (let i = 0; i < SYSTEM_CONSTANTS.RATE_LIMIT.MAX_REQUESTS; i += 1) {
			const check = enforceRateLimit(routeName, '198.51.100.1');
			expect(check.ok).toBe(true);
		}
	});

	it('returns a 429 with a Retry-After header once the limit is exceeded', async () => {
		const routeName = 'test-route-block';
		for (let i = 0; i < SYSTEM_CONSTANTS.RATE_LIMIT.MAX_REQUESTS; i += 1) {
			enforceRateLimit(routeName, '198.51.100.2');
		}

		const check = enforceRateLimit(routeName, '198.51.100.2');
		expect(check.ok).toBe(false);
		if (check.ok) return;
		expect(check.response.status).toBe(429);
		expect(check.response.headers.get('Retry-After')).not.toBeNull();
		const payload = await check.response.json();
		expect(payload.error.code).toBe('RATE_LIMITED');
	});

	it('tracks different client addresses independently for the same route', () => {
		const routeName = 'test-route-independent';
		for (let i = 0; i < SYSTEM_CONSTANTS.RATE_LIMIT.MAX_REQUESTS; i += 1) {
			enforceRateLimit(routeName, '198.51.100.3');
		}

		const otherClient = enforceRateLimit(routeName, '198.51.100.4');
		expect(otherClient.ok).toBe(true);
	});

	it('tracks different routes independently for the same client address', () => {
		const clientAddress = '198.51.100.5';
		for (let i = 0; i < SYSTEM_CONSTANTS.RATE_LIMIT.MAX_REQUESTS; i += 1) {
			enforceRateLimit('test-route-a', clientAddress);
		}

		const otherRoute = enforceRateLimit('test-route-b', clientAddress);
		expect(otherRoute.ok).toBe(true);
	});
});
