// Purpose: Contract tests for RateLimitSeam.
// Why: Enforce mock adherence to the seam contract.
// Info flow: tests -> mock -> contract assertions.
import { describe, expect, it } from 'vitest';
import {
	baseRateLimitCheckFixture,
	exceededRateLimitCheckFixture,
	invalidMaxRequestsRateLimitCheckFixture,
	invalidWindowMsRateLimitCheckFixture,
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
