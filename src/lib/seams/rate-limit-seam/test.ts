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

	it('starts a fresh window when the same key is checked under a different policy', () => {
		const seam = createMockRateLimitSeam();
		const { key, now } = baseRateLimitCheckFixture;

		// Exhaust a tight quota (1 request per window) for this key.
		const tightPolicy = { key, maxRequests: 1, windowMs: baseRateLimitCheckFixture.windowMs, now };
		expect(seam.checkAndConsume(tightPolicy).ok).toBe(true);
		expect(seam.checkAndConsume(tightPolicy).ok).toBe(false);

		// The same key, immediately after, under a much larger quota must not inherit the
		// exhausted count from the other policy's window.
		const loosePolicy = { key, maxRequests: 20, windowMs: baseRateLimitCheckFixture.windowMs, now };
		const result = validateRateLimitResult(seam.checkAndConsume(loosePolicy));
		expect(result).toEqual({
			ok: true,
			remaining: 19,
			resetAt: now + baseRateLimitCheckFixture.windowMs
		});
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
