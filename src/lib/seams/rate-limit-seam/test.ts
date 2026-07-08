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
	it('allows requests under the limit in sample scenario', async () => {
		const seam = createMockRateLimitSeam('sample');
		const result = await seam.consume(sampleKey, sampleConfig);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.remaining).toBe(sampleConfig.limit - 1);
	});

	it('sample scenario returns RATE_LIMIT_EXCEEDED once the same key exhausts its quota', async () => {
		const seam = createMockRateLimitSeam('sample');

		for (let i = 0; i < sampleConfig.limit; i += 1) {
			expect((await seam.consume(sampleKey, sampleConfig)).ok).toBe(true);
		}
		const overLimit = await seam.consume(sampleKey, sampleConfig);

		expect(overLimit.ok).toBe(false);
		if (overLimit.ok) return;
		expect(overLimit.error.code).toBe('RATE_LIMIT_EXCEEDED');
	});

	it('sample scenario resets the window and quota once windowMs elapses', async () => {
		let clock = 0;
		const seam = createMockRateLimitSeam('sample', () => clock);
		const config = { limit: 1, windowMs: 1000 };

		await seam.consume('k', config);
		const stillDenied = await seam.consume('k', config);
		clock = 1000;
		const afterReset = await seam.consume('k', config);

		expect(stillDenied.ok).toBe(false);
		expect(afterReset.ok).toBe(true);
		if (!afterReset.ok) return;
		expect(afterReset.value.remaining).toBe(0);
	});

	it('fault fixture returns RATE_LIMIT_EXCEEDED before adapter work', async () => {
		const seam = createMockRateLimitSeam('fault');
		const result = await seam.consume(sampleKey, sampleConfig);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe(rateLimitExceededFixture.code);
	});

	it('rejects an empty key before consuming quota', async () => {
		const seam = createMockRateLimitSeam('sample');
		const result = await seam.consume('', sampleConfig);

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
	it('allows up to the configured limit within a window', async () => {
		let clock = 0;
		const seam = createRateLimitSeam(() => clock);
		const config = { limit: 3, windowMs: 1000 };

		const first = await seam.consume('k', config);
		const second = await seam.consume('k', config);
		const third = await seam.consume('k', config);

		expect(first.ok).toBe(true);
		expect(second.ok).toBe(true);
		expect(third.ok).toBe(true);
		if (!third.ok) return;
		expect(third.value.remaining).toBe(0);
	});

	it('denies the request that exceeds the limit and reports retryAfterMs', async () => {
		let clock = 0;
		const seam = createRateLimitSeam(() => clock);
		const config = { limit: 2, windowMs: 1000 };

		await seam.consume('k', config);
		await seam.consume('k', config);
		clock = 400;
		const denied = await seam.consume('k', config);

		expect(denied.ok).toBe(false);
		if (denied.ok) return;
		expect(denied.error.code).toBe('RATE_LIMIT_EXCEEDED');
		expect(denied.error.retryAfterMs).toBe(600);
	});

	it('resets the window once windowMs elapses', async () => {
		let clock = 0;
		const seam = createRateLimitSeam(() => clock);
		const config = { limit: 1, windowMs: 1000 };

		await seam.consume('k', config);
		clock = 1000;
		const afterReset = await seam.consume('k', config);

		expect(afterReset.ok).toBe(true);
		if (!afterReset.ok) return;
		expect(afterReset.value.remaining).toBe(0);
	});

	it('tracks separate keys independently', async () => {
		let clock = 0;
		const seam = createRateLimitSeam(() => clock);
		const config = { limit: 1, windowMs: 1000 };

		const a1 = await seam.consume('a', config);
		const b1 = await seam.consume('b', config);
		const a2 = await seam.consume('a', config);

		expect(a1.ok).toBe(true);
		expect(b1.ok).toBe(true);
		expect(a2.ok).toBe(false);
	});

	it('rejects invalid config before touching internal state, distinct from quota exhaustion', async () => {
		const seam = createRateLimitSeam(() => 0);
		const result = await seam.consume('k', { limit: -1, windowMs: 1000 });

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe('RATE_LIMIT_CONFIG_INVALID');
	});

	it('prunes fully expired windows past the size threshold without disturbing active windows', async () => {
		let clock = 0;
		const seam = createRateLimitSeam(() => clock);
		const shortConfig = { limit: 1, windowMs: 100 };
		const longConfig = { limit: 1, windowMs: 100_000 };

		// A still-active window that must survive the prune sweep below.
		await seam.consume('active', longConfig);

		// Push the map past the internal prune threshold with short-lived windows.
		for (let i = 0; i < 1001; i += 1) {
			await seam.consume(`stale-${i}`, shortConfig);
		}

		// stale-* windows (100ms) are now expired; 'active' (100_000ms) is not.
		clock = 200;
		await seam.consume('trigger-prune', shortConfig);

		const stillActive = await seam.consume('active', longConfig);

		expect(stillActive.ok).toBe(false);
		if (stillActive.ok) return;
		expect(stillActive.error.code).toBe('RATE_LIMIT_EXCEEDED');
	});

	it('refuses new keys at hard capacity instead of evicting an active key’s exhausted quota', async () => {
		const seam = createRateLimitSeam(() => 0);
		// A window long enough that nothing here ever expires or gets pruned by age alone.
		const config = { limit: 1, windowMs: 100_000 };

		for (let i = 0; i < 5000; i += 1) {
			await seam.consume(`k${i}`, config);
		}

		// A brand-new key past the hard ceiling is refused, not admitted by evicting someone else.
		const newKeyAtCapacity = await seam.consume('k5000', config);
		expect(newKeyAtCapacity.ok).toBe(false);
		if (newKeyAtCapacity.ok) return;
		expect(newKeyAtCapacity.error.code).toBe('RATE_LIMIT_EXCEEDED');

		// The oldest tracked key (k0) is still within its unexpired window, still exhausted --
		// flooding many new distinct keys must not reset it early.
		const stillExhausted = await seam.consume('k0', config);
		expect(stillExhausted.ok).toBe(false);
	});
});
