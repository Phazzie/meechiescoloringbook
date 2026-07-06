// Purpose: Contract tests for RateLimitSeam.
// Why: Prove the sliding-window algorithm, the stateful adapter, and the mock all honor the
//      same allow/block contract.
// Info flow: tests -> fixtures/adapter/mock -> contract assertions.
import { describe, expect, it } from 'vitest';
import { createRateLimitSeam } from '../../adapters/rate-limit-seam';
import {
	atLimitTimestampsFixture,
	emptyTimestampsFixture,
	expiredTimestampsFixture,
	expiredTimestampsNowFixture,
	sampleRuleFixture,
	underLimitTimestampsFixture
} from './fixtures';
import { createMockRateLimitSeam } from './mock';
import { evaluate } from './window';

describe('RateLimitSeam window evaluation (pure)', () => {
	it('allows calls under the limit and records the new timestamp', () => {
		const { result, nextTimestamps } = evaluate(emptyTimestampsFixture, sampleRuleFixture, 500);
		expect(result).toEqual({ ok: true, value: undefined });
		expect(nextTimestamps).toEqual([500]);
	});

	it('allows a call that reaches the limit for the first time', () => {
		const { result, nextTimestamps } = evaluate(underLimitTimestampsFixture, sampleRuleFixture, 3_000);
		expect(result).toEqual({ ok: true, value: undefined });
		expect(nextTimestamps).toEqual([1_000, 2_000, 3_000]);
	});

	it('blocks a call once the window already holds `limit` timestamps', () => {
		const { result, nextTimestamps } = evaluate(atLimitTimestampsFixture, sampleRuleFixture, 3_500);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('RATE_LIMIT_EXCEEDED');
			expect(result.error.retryAfterMs).toBe(sampleRuleFixture.windowMs - (3_500 - 1_000));
		}
		expect(nextTimestamps).toEqual(atLimitTimestampsFixture);
	});

	it('prunes timestamps once they fall outside the window and allows the next call', () => {
		const { result, nextTimestamps } = evaluate(
			expiredTimestampsFixture,
			sampleRuleFixture,
			expiredTimestampsNowFixture
		);
		expect(result).toEqual({ ok: true, value: undefined });
		expect(nextTimestamps).toEqual([expiredTimestampsNowFixture]);
	});
});

describe('RateLimitSeam adapter (stateful)', () => {
	it('allows up to the rule limit per key, then blocks with a positive retryAfterMs', () => {
		const seam = createRateLimitSeam({ limit: 2, windowMs: 1_000 });

		expect(seam.checkAndConsume('client-a', 0)).toEqual({ ok: true, value: undefined });
		expect(seam.checkAndConsume('client-a', 100)).toEqual({ ok: true, value: undefined });

		const blocked = seam.checkAndConsume('client-a', 200);
		expect(blocked.ok).toBe(false);
		if (!blocked.ok) {
			expect(blocked.error.code).toBe('RATE_LIMIT_EXCEEDED');
			expect(blocked.error.retryAfterMs).toBeGreaterThan(0);
		}
	});

	it('tracks separate keys independently', () => {
		const seam = createRateLimitSeam({ limit: 1, windowMs: 1_000 });

		expect(seam.checkAndConsume('client-a', 0)).toEqual({ ok: true, value: undefined });
		expect(seam.checkAndConsume('client-b', 0)).toEqual({ ok: true, value: undefined });
		expect(seam.checkAndConsume('client-a', 1).ok).toBe(false);
	});

	it('allows calls again once the window has fully elapsed', () => {
		const seam = createRateLimitSeam({ limit: 1, windowMs: 1_000 });

		expect(seam.checkAndConsume('client-a', 0)).toEqual({ ok: true, value: undefined });
		expect(seam.checkAndConsume('client-a', 1_500)).toEqual({ ok: true, value: undefined });
	});
});

describe('RateLimitSeam mock', () => {
	it('always allows in the "allow" scenario', () => {
		const seam = createMockRateLimitSeam('allow');
		expect(seam.checkAndConsume('any-key', 0)).toEqual({ ok: true, value: undefined });
	});

	it('always blocks in the "block" scenario', () => {
		const seam = createMockRateLimitSeam('block');
		const result = seam.checkAndConsume('any-key', 0);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('RATE_LIMIT_EXCEEDED');
			expect(result.error.retryAfterMs).toBeGreaterThan(0);
		}
	});
});
