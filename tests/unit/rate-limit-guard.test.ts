// Purpose: Unit tests for the checkRateLimit guard.
// Why: Verify pass-through under the limit and the shaped 429 response once exceeded.
// Info flow: guard options (injected seam + now) -> checkRateLimit -> RateLimitGuardResult.
import { describe, expect, it } from 'vitest';
import { checkRateLimit } from '../../src/lib/server/rate-limit-guard';
import { createRateLimitSeam } from '../../src/lib/seams/rate-limit-seam/policy';

const baseOptions = {
	routeName: 'test-route',
	limit: 2,
	windowMs: 60_000,
	getClientAddress: () => '127.0.0.1'
};

describe('checkRateLimit', () => {
	it('allows requests under the limit', () => {
		const seam = createRateLimitSeam();
		const result = checkRateLimit({ ...baseOptions, seam, now: 0 });
		expect(result.ok).toBe(true);
	});

	it('returns a 429 response with a Retry-After header once the limit is exceeded', async () => {
		const seam = createRateLimitSeam();
		checkRateLimit({ ...baseOptions, seam, now: 0 });
		checkRateLimit({ ...baseOptions, seam, now: 1_000 });

		const result = checkRateLimit({ ...baseOptions, seam, now: 2_000 });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.response.status).toBe(429);
			expect(result.response.headers.get('Retry-After')).toBe('58');
			const payload = await result.response.json();
			expect(payload.error.code).toBe('RATE_LIMITED');
		}
	});

	it('keys requests per route and client address', () => {
		const seam = createRateLimitSeam();
		checkRateLimit({ ...baseOptions, seam, now: 0 });
		checkRateLimit({ ...baseOptions, seam, now: 1_000 });

		const otherClient = checkRateLimit({
			...baseOptions,
			seam,
			now: 2_000,
			getClientAddress: () => '10.0.0.9'
		});
		expect(otherClient.ok).toBe(true);

		const otherRoute = checkRateLimit({
			...baseOptions,
			seam,
			now: 2_000,
			routeName: 'other-route'
		});
		expect(otherRoute.ok).toBe(true);
	});
});
