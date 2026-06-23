// Purpose: Unit tests for the enforceAiRateLimit server helper.
// Why: Verify allow/deny responses and 429 Retry-After shape without depending on real env vars or clock.
// Info flow: fake getClientAddress + injected RateLimitSeam/config/clock -> enforceAiRateLimit -> Response | null.
import { describe, expect, it } from 'vitest';
import { enforceAiRateLimit, readRateLimitConfig } from '../../src/lib/server/rate-limiter';
import { createRateLimitSeam } from '../../src/lib/seams/rate-limit-seam/policy';

const getConfig = () => ({ rateLimitMaxRequests: 2, rateLimitWindowMs: 60_000 });

describe('enforceAiRateLimit', () => {
	it('returns null (allowed) while under the limit', () => {
		const rateLimitSeam = createRateLimitSeam();
		const result = enforceAiRateLimit(() => '203.0.113.5', {
			rateLimitSeam,
			getConfig,
			now: () => 1_000
		});
		expect(result).toBeNull();
	});

	it('returns a 429 Response with Retry-After once the limit is exceeded', async () => {
		const rateLimitSeam = createRateLimitSeam();
		const deps = { rateLimitSeam, getConfig, now: () => 1_000 };

		expect(enforceAiRateLimit(() => '203.0.113.5', deps)).toBeNull();
		expect(enforceAiRateLimit(() => '203.0.113.5', deps)).toBeNull();

		const denied = enforceAiRateLimit(() => '203.0.113.5', deps);
		expect(denied).not.toBeNull();
		expect(denied?.status).toBe(429);
		expect(denied?.headers.get('Retry-After')).toBe('60');

		const payload = await denied?.json();
		expect(payload).toEqual({
			ok: false,
			error: { code: 'RATE_LIMIT_EXCEEDED', message: expect.any(String) }
		});
	});

	it('tracks separate clients independently', () => {
		const rateLimitSeam = createRateLimitSeam();
		const deps = { rateLimitSeam, getConfig, now: () => 1_000 };

		expect(enforceAiRateLimit(() => '203.0.113.5', deps)).toBeNull();
		expect(enforceAiRateLimit(() => '203.0.113.5', deps)).toBeNull();
		expect(enforceAiRateLimit(() => '203.0.113.5', deps)).not.toBeNull();

		expect(enforceAiRateLimit(() => '198.51.100.1', deps)).toBeNull();
	});

	it('falls back to a fixed key instead of throwing when getClientAddress throws', () => {
		const rateLimitSeam = createRateLimitSeam();
		const deps = { rateLimitSeam, getConfig, now: () => 1_000 };
		const throwingGetClientAddress = () => {
			throw new Error('could not determine client address');
		};

		expect(() => enforceAiRateLimit(throwingGetClientAddress, deps)).not.toThrow();
		expect(enforceAiRateLimit(throwingGetClientAddress, deps)).toBeNull();
		expect(enforceAiRateLimit(throwingGetClientAddress, deps)).not.toBeNull();
	});

	it('treats a negative env value as unset and falls back to the default', () => {
		expect(readRateLimitConfig({ RATE_LIMIT_MAX_REQUESTS: '-5' })).toEqual({
			rateLimitMaxRequests: 20,
			rateLimitWindowMs: 60_000
		});
	});

	it('falls back to default config instead of throwing when env values are out of range', () => {
		const getConfigFromEnv = () => readRateLimitConfig({ RATE_LIMIT_MAX_REQUESTS: '99999' });

		expect(getConfigFromEnv).not.toThrow();
		expect(getConfigFromEnv()).toEqual({ rateLimitMaxRequests: 20, rateLimitWindowMs: 60_000 });

		const rateLimitSeam = createRateLimitSeam();
		const result = enforceAiRateLimit(() => '203.0.113.5', {
			rateLimitSeam,
			getConfig: getConfigFromEnv,
			now: () => 1_000
		});
		expect(result).toBeNull();
	});
});
