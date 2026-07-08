// Purpose: Contract tests for RateLimitSeam.
// Why: Enforce mock adherence to the seam contract and prove the fault fixture fails before
//      relying on the adapter, plus prove the adapter's fixed-window algorithm itself.
// Info flow: tests -> mock/adapter -> contract assertions.
import { describe, expect, it } from 'vitest';
import { createRateLimitSeam } from '../../adapters/rate-limit-seam';
import { rateLimitExceededFixture, sampleConfig, sampleKey } from './fixtures';
import { createMockRateLimitSeam } from './mock';
import { validateRateLimitConfig, validateRateLimitKey } from './validators';

describe('RateLimitSeam mock contract', () => {
	it('allows requests under the limit in sample scenario', () => {
		const seam = createMockRateLimitSeam('sample');
		const result = seam.consume(sampleKey, sampleConfig);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.remaining).toBe(sampleConfig.limit - 1);
	});

	it('sample scenario returns RATE_LIMIT_EXCEEDED once the same key exhausts its quota', () => {
		const seam = createMockRateLimitSeam('sample');

		for (let i = 0; i < sampleConfig.limit; i += 1) {
			expect(seam.consume(sampleKey, sampleConfig).ok).toBe(true);
		}
		const overLimit = seam.consume(sampleKey, sampleConfig);

		expect(overLimit.ok).toBe(false);
		if (overLimit.ok) return;
		expect(overLimit.error.code).toBe('RATE_LIMIT_EXCEEDED');
	});

	it('fault fixture returns RATE_LIMIT_EXCEEDED before adapter work', () => {
		const seam = createMockRateLimitSeam('fault');
		const result = seam.consume(sampleKey, sampleConfig);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe(rateLimitExceededFixture.code);
	});

	it('rejects an empty key before consuming quota', () => {
		const seam = createMockRateLimitSeam('sample');
		const result = seam.consume('', sampleConfig);

		expect(result.ok).toBe(false);
	});

	it('validators reject empty keys and non-positive config', () => {
		expect(() => validateRateLimitKey('')).toThrow();
		expect(() => validateRateLimitKey(42)).toThrow();
		expect(() => validateRateLimitConfig({ limit: 0, windowMs: 1000 })).toThrow();
		expect(() => validateRateLimitConfig({ limit: 5, windowMs: 0 })).toThrow();
		expect(() => validateRateLimitConfig({ limit: 1.5, windowMs: 1000 })).toThrow();
	});
});

describe('RateLimitSeam adapter (fixed-window counter)', () => {
	it('allows up to the configured limit within a window', () => {
		let clock = 0;
		const seam = createRateLimitSeam(() => clock);
		const config = { limit: 3, windowMs: 1000 };

		const first = seam.consume('k', config);
		const second = seam.consume('k', config);
		const third = seam.consume('k', config);

		expect(first.ok).toBe(true);
		expect(second.ok).toBe(true);
		expect(third.ok).toBe(true);
		if (!third.ok) return;
		expect(third.value.remaining).toBe(0);
	});

	it('denies the request that exceeds the limit and reports retryAfterMs', () => {
		let clock = 0;
		const seam = createRateLimitSeam(() => clock);
		const config = { limit: 2, windowMs: 1000 };

		seam.consume('k', config);
		seam.consume('k', config);
		clock = 400;
		const denied = seam.consume('k', config);

		expect(denied.ok).toBe(false);
		if (denied.ok) return;
		expect(denied.error.code).toBe('RATE_LIMIT_EXCEEDED');
		expect(denied.error.retryAfterMs).toBe(600);
	});

	it('resets the window once windowMs elapses', () => {
		let clock = 0;
		const seam = createRateLimitSeam(() => clock);
		const config = { limit: 1, windowMs: 1000 };

		seam.consume('k', config);
		clock = 1000;
		const afterReset = seam.consume('k', config);

		expect(afterReset.ok).toBe(true);
		if (!afterReset.ok) return;
		expect(afterReset.value.remaining).toBe(0);
	});

	it('tracks separate keys independently', () => {
		let clock = 0;
		const seam = createRateLimitSeam(() => clock);
		const config = { limit: 1, windowMs: 1000 };

		const a1 = seam.consume('a', config);
		const b1 = seam.consume('b', config);
		const a2 = seam.consume('a', config);

		expect(a1.ok).toBe(true);
		expect(b1.ok).toBe(true);
		expect(a2.ok).toBe(false);
	});

	it('rejects invalid config before touching internal state, distinct from quota exhaustion', () => {
		const seam = createRateLimitSeam(() => 0);
		const result = seam.consume('k', { limit: -1, windowMs: 1000 });

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe('RATE_LIMIT_CONFIG_INVALID');
	});

	it('prunes fully expired windows past the size threshold without disturbing active windows', () => {
		let clock = 0;
		const seam = createRateLimitSeam(() => clock);
		const shortConfig = { limit: 1, windowMs: 100 };
		const longConfig = { limit: 1, windowMs: 100_000 };

		// A still-active window that must survive the prune sweep below.
		seam.consume('active', longConfig);

		// Push the map past the internal prune threshold with short-lived windows.
		for (let i = 0; i < 1001; i += 1) {
			seam.consume(`stale-${i}`, shortConfig);
		}

		// stale-* windows (100ms) are now expired; 'active' (100_000ms) is not.
		clock = 200;
		seam.consume('trigger-prune', shortConfig);

		const stillActive = seam.consume('active', longConfig);

		expect(stillActive.ok).toBe(false);
		if (stillActive.ok) return;
		expect(stillActive.error.code).toBe('RATE_LIMIT_EXCEEDED');
	});
});
