// Purpose: Verify the shared per-route rate-limit guard used by AI-provider-backed endpoints.
// Why: Prove the 429 response shape, Retry-After header, and per-route-key isolation once,
//      instead of relying on each route test file to exercise the guard indirectly.
// Info flow: guardRateLimit(routeName, clientAddress, config) -> allow | 429 Response.
import { describe, expect, it } from 'vitest';
import { guardRateLimit } from '$lib/server/rate-limit-guard';

describe('guardRateLimit', () => {
	it('allows requests under the configured limit', () => {
		const result = guardRateLimit('guard-test-allow', '198.51.100.1', {
			limit: 2,
			windowMs: 60_000
		});

		expect(result.ok).toBe(true);
	});

	it('returns a 429 with a Retry-After header once the limit is exceeded', async () => {
		const routeName = 'guard-test-deny';
		const address = '198.51.100.2';
		const config = { limit: 1, windowMs: 60_000 };

		const first = guardRateLimit(routeName, address, config);
		const second = guardRateLimit(routeName, address, config);

		expect(first.ok).toBe(true);
		expect(second.ok).toBe(false);
		if (second.ok) return;
		expect(second.response.status).toBe(429);
		expect(second.response.headers.get('Retry-After')).not.toBeNull();
		const payload = await second.response.json();
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('RATE_LIMIT_EXCEEDED');
	});

	it('keeps quota separate per route name for the same client address', () => {
		const address = '198.51.100.3';
		const config = { limit: 1, windowMs: 60_000 };

		const routeA = guardRateLimit('guard-test-route-a', address, config);
		const routeB = guardRateLimit('guard-test-route-b', address, config);

		expect(routeA.ok).toBe(true);
		expect(routeB.ok).toBe(true);
	});

	it('accepts a getClientAddress function reference and resolves it lazily', () => {
		const result = guardRateLimit('guard-test-fn-address', () => '198.51.100.4', {
			limit: 2,
			windowMs: 60_000
		});

		expect(result.ok).toBe(true);
	});

	it('falls back to a stable bucket instead of crashing when getClientAddress throws', () => {
		const throwingAddress = () => {
			throw new Error('getClientAddress unavailable on this platform');
		};

		const result = guardRateLimit('guard-test-throwing-address', throwingAddress, {
			limit: 1,
			windowMs: 60_000
		});

		expect(result.ok).toBe(true);
	});

	it('returns a 500 (not 429) when the config itself is invalid', async () => {
		const result = guardRateLimit('guard-test-bad-config', '198.51.100.5', {
			limit: -1,
			windowMs: 60_000
		});

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.response.status).toBe(500);
		expect(result.response.headers.get('Retry-After')).toBeNull();
		const payload = await result.response.json();
		expect(payload.error.code).toBe('RATE_LIMIT_CONFIG_INVALID');
	});
});
