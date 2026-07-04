// Purpose: Contract tests for RateLimitSeam.
// Why: Enforce mock adherence to the seam contract.
// Info flow: tests -> mock -> contract assertions.
import { describe, expect, it } from 'vitest';
import {
	backwardClockRateLimitCheckFixture,
	baseRateLimitCheckFixture,
	exceededRateLimitCheckFixture,
	fractionalMaxRequestsRateLimitCheckFixture,
	fractionalNowRateLimitCheckFixture,
	fractionalWindowMsRateLimitCheckFixture,
	infiniteMaxRequestsRateLimitCheckFixture,
	infiniteNowRateLimitCheckFixture,
	infiniteWindowMsRateLimitCheckFixture,
	invalidMaxRequestsRateLimitCheckFixture,
	invalidWindowMsRateLimitCheckFixture,
	nanNowRateLimitCheckFixture,
	negativeNowRateLimitCheckFixture,
	nextWindowRateLimitCheckFixture
} from './fixtures';
import { createMockRateLimitSeam } from './mock';
import { validateRateLimitResult } from './validators';

describe('RateLimitSeam mock contract', () => {
	it('allows requests under the limit and decrements remaining', () => {
		const seam = createMockRateLimitSeam();
		const first = validateRateLimitResult(seam.checkAndConsume(baseRateLimitCheckFixture));
		expect(first).toEqual({
			ok: true,
			remaining: baseRateLimitCheckFixture.maxRequests - 1,
			resetAt: baseRateLimitCheckFixture.now + baseRateLimitCheckFixture.windowMs
		});
	});

	it('denies requests once the window is exhausted', () => {
		const seam = createMockRateLimitSeam();
		const { maxRequests } = baseRateLimitCheckFixture;
		for (let i = 0; i < maxRequests; i += 1) {
			expect(seam.checkAndConsume(baseRateLimitCheckFixture).ok).toBe(true);
		}

		const denied = validateRateLimitResult(seam.checkAndConsume(exceededRateLimitCheckFixture));
		expect(denied.ok).toBe(false);
		if (!denied.ok) {
			expect(denied.error.code).toBe('RATE_LIMIT_EXCEEDED');
			expect(denied.error.retryAfterMs).toBeGreaterThanOrEqual(0);
		}
	});

	it('isolates limits per key', () => {
		const seam = createMockRateLimitSeam();
		const { maxRequests } = baseRateLimitCheckFixture;
		for (let i = 0; i < maxRequests; i += 1) {
			expect(seam.checkAndConsume(baseRateLimitCheckFixture).ok).toBe(true);
		}
		expect(seam.checkAndConsume(exceededRateLimitCheckFixture).ok).toBe(false);

		const otherKeyResult = seam.checkAndConsume({ ...baseRateLimitCheckFixture, key: 'other-key' });
		expect(otherKeyResult.ok).toBe(true);
	});

	it('resets the count once a new window starts', () => {
		const seam = createMockRateLimitSeam();
		const { maxRequests } = baseRateLimitCheckFixture;
		for (let i = 0; i < maxRequests; i += 1) {
			expect(seam.checkAndConsume(baseRateLimitCheckFixture).ok).toBe(true);
		}
		expect(seam.checkAndConsume(exceededRateLimitCheckFixture).ok).toBe(false);

		const nextWindow = validateRateLimitResult(
			seam.checkAndConsume(nextWindowRateLimitCheckFixture)
		);
		expect(nextWindow).toEqual({
			ok: true,
			remaining: maxRequests - 1,
			resetAt: nextWindowRateLimitCheckFixture.now + nextWindowRateLimitCheckFixture.windowMs
		});
	});

	it('fails closed when maxRequests is non-positive', () => {
		const seam = createMockRateLimitSeam();
		const result = validateRateLimitResult(
			seam.checkAndConsume(invalidMaxRequestsRateLimitCheckFixture)
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('RATE_LIMIT_EXCEEDED');
		}
	});

	it('fails closed when windowMs is non-positive', () => {
		const seam = createMockRateLimitSeam();
		const result = validateRateLimitResult(
			seam.checkAndConsume(invalidWindowMsRateLimitCheckFixture)
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('RATE_LIMIT_EXCEEDED');
		}
	});

	it('fails closed when maxRequests is Infinity', () => {
		const seam = createMockRateLimitSeam();
		const result = validateRateLimitResult(
			seam.checkAndConsume(infiniteMaxRequestsRateLimitCheckFixture)
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('RATE_LIMIT_EXCEEDED');
			expect(Number.isFinite(result.error.retryAfterMs)).toBe(true);
			expect(Number.isFinite(result.error.resetAt)).toBe(true);
		}
	});

	it('fails closed when windowMs is Infinity', () => {
		const seam = createMockRateLimitSeam();
		const result = validateRateLimitResult(
			seam.checkAndConsume(infiniteWindowMsRateLimitCheckFixture)
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('RATE_LIMIT_EXCEEDED');
			expect(result.error.retryAfterMs).toBe(0);
			expect(result.error.resetAt).toBe(infiniteWindowMsRateLimitCheckFixture.now);
		}
	});

	it('fails closed when maxRequests is fractional', () => {
		const seam = createMockRateLimitSeam();
		const result = validateRateLimitResult(
			seam.checkAndConsume(fractionalMaxRequestsRateLimitCheckFixture)
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('RATE_LIMIT_EXCEEDED');
		}
	});

	it('fails closed when windowMs is fractional', () => {
		const seam = createMockRateLimitSeam();
		const result = validateRateLimitResult(
			seam.checkAndConsume(fractionalWindowMsRateLimitCheckFixture)
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('RATE_LIMIT_EXCEEDED');
		}
	});

	it('fails closed when now is fractional', () => {
		const seam = createMockRateLimitSeam();
		const result = validateRateLimitResult(seam.checkAndConsume(fractionalNowRateLimitCheckFixture));
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('RATE_LIMIT_EXCEEDED');
		}
	});

	it('fails closed when now is negative', () => {
		const seam = createMockRateLimitSeam();
		const result = validateRateLimitResult(seam.checkAndConsume(negativeNowRateLimitCheckFixture));
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('RATE_LIMIT_EXCEEDED');
			expect(result.error.resetAt).toBeGreaterThanOrEqual(0);
		}
	});

	it('fails closed when now is Infinity', () => {
		const seam = createMockRateLimitSeam();
		const result = validateRateLimitResult(seam.checkAndConsume(infiniteNowRateLimitCheckFixture));
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('RATE_LIMIT_EXCEEDED');
			expect(Number.isFinite(result.error.resetAt)).toBe(true);
		}
	});

	it('fails closed when now is NaN', () => {
		const seam = createMockRateLimitSeam();
		const result = validateRateLimitResult(seam.checkAndConsume(nanNowRateLimitCheckFixture));
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('RATE_LIMIT_EXCEEDED');
			expect(Number.isFinite(result.error.resetAt)).toBe(true);
		}
	});

	it('resets the window instead of extending the lockout when the clock steps backward', () => {
		const seam = createMockRateLimitSeam();
		const { maxRequests } = baseRateLimitCheckFixture;
		for (let i = 0; i < maxRequests; i += 1) {
			expect(seam.checkAndConsume(baseRateLimitCheckFixture).ok).toBe(true);
		}
		expect(seam.checkAndConsume(exceededRateLimitCheckFixture).ok).toBe(false);

		const afterClockRollback = validateRateLimitResult(
			seam.checkAndConsume(backwardClockRateLimitCheckFixture)
		);
		expect(afterClockRollback).toEqual({
			ok: true,
			remaining: maxRequests - 1,
			resetAt: backwardClockRateLimitCheckFixture.now + backwardClockRateLimitCheckFixture.windowMs
		});
	});

	it('keeps a bucket on its own windowMs when the same key is later checked under a different policy', () => {
		const seam = createMockRateLimitSeam();
		const key = 'shared-key';
		const start = seam.checkAndConsume({ key, maxRequests: 1, windowMs: 100, now: 0 });
		expect(start.ok).toBe(true);

		// Same key, different (larger) windowMs, well before the original 100ms window
		// would have expired. If this call's windowMs leaked into the stored bucket's
		// freshness check, the bucket would look fresh under the *new* 10_000ms window
		// and silently reset instead of correctly still being within the original window.
		const stillWithinOriginalWindow = validateRateLimitResult(
			seam.checkAndConsume({ key, maxRequests: 1, windowMs: 10_000, now: 50 })
		);
		expect(stillWithinOriginalWindow.ok).toBe(false);
		if (!stillWithinOriginalWindow.ok) {
			expect(stillWithinOriginalWindow.error.resetAt).toBe(100);
		}

		// Past the original 100ms window: the bucket resets on its own stored windowMs,
		// independent of whatever windowMs this later call happens to pass.
		const afterOriginalWindow = validateRateLimitResult(
			seam.checkAndConsume({ key, maxRequests: 1, windowMs: 10_000, now: 150 })
		);
		expect(afterOriginalWindow).toEqual({ ok: true, remaining: 0, resetAt: 10_150 });
	});

	it('reset() clears all tracked keys', () => {
		const seam = createMockRateLimitSeam();
		const { maxRequests } = baseRateLimitCheckFixture;
		for (let i = 0; i < maxRequests; i += 1) {
			expect(seam.checkAndConsume(baseRateLimitCheckFixture).ok).toBe(true);
		}
		expect(seam.checkAndConsume(exceededRateLimitCheckFixture).ok).toBe(false);

		seam.reset();
		expect(seam.checkAndConsume(baseRateLimitCheckFixture).ok).toBe(true);
	});
});
