// Purpose: Contract tests for RateLimitSeam.
// Why: Enforce mock adherence to the seam contract.
// Info flow: tests -> mock -> contract assertions.
import { describe, expect, it } from 'vitest';
import type { RateLimitCheckRequest } from './contract';
import {
	rateLimitCheckRequestFaultFixture,
	rateLimitCheckRequestFixture,
	rateLimitConfigFixture
} from './fixtures';
import { createMockRateLimitSeam } from './mock';
import { validateRateLimitDecision } from './validators';

describe('RateLimitSeam mock contract', () => {
	it('allows requests under the limit and decrements remaining', () => {
		const seam = createMockRateLimitSeam(rateLimitConfigFixture);

		const first = seam.checkAndConsume(rateLimitCheckRequestFixture);
		expect(first.ok).toBe(true);
		if (first.ok) {
			expect(first.value.allowed).toBe(true);
			expect(first.value.remaining).toBe(
				rateLimitConfigFixture.maxRequests - 1
			);
			expect(validateRateLimitDecision(first.value)).toEqual(first.value);
		}

		const second = seam.checkAndConsume(rateLimitCheckRequestFixture);
		if (second.ok) {
			expect(second.value.remaining).toBe(
				rateLimitConfigFixture.maxRequests - 2
			);
		}
	});

	it('denies requests once the limit is exceeded within the same window', () => {
		const seam = createMockRateLimitSeam(rateLimitConfigFixture);

		for (let i = 0; i < rateLimitConfigFixture.maxRequests; i += 1) {
			seam.checkAndConsume(rateLimitCheckRequestFixture);
		}

		const denied = seam.checkAndConsume(rateLimitCheckRequestFixture);
		expect(denied.ok).toBe(true);
		if (denied.ok) {
			expect(denied.value.allowed).toBe(false);
			expect(denied.value.remaining).toBe(0);
			expect(denied.value.retryAfterMs).toBeGreaterThan(0);
			expect(validateRateLimitDecision(denied.value)).toEqual(denied.value);
		}
	});

	it('resets the count once the window has elapsed', () => {
		const seam = createMockRateLimitSeam(rateLimitConfigFixture);
		for (let i = 0; i < rateLimitConfigFixture.maxRequests; i += 1) {
			seam.checkAndConsume(rateLimitCheckRequestFixture);
		}

		const nextWindow = seam.checkAndConsume({
			...rateLimitCheckRequestFixture,
			nowMs:
				rateLimitCheckRequestFixture.nowMs + rateLimitConfigFixture.windowMs
		});
		expect(nextWindow.ok).toBe(true);
		if (nextWindow.ok) {
			expect(nextWindow.value.allowed).toBe(true);
			expect(nextWindow.value.remaining).toBe(
				rateLimitConfigFixture.maxRequests - 1
			);
		}
	});

	it('tracks separate keys independently', () => {
		const seam = createMockRateLimitSeam(rateLimitConfigFixture);
		for (let i = 0; i < rateLimitConfigFixture.maxRequests; i += 1) {
			seam.checkAndConsume(rateLimitCheckRequestFixture);
		}

		const otherKey = seam.checkAndConsume({
			...rateLimitCheckRequestFixture,
			key: 'ip:198.51.100.9'
		});
		expect(otherKey.ok).toBe(true);
		if (otherKey.ok) {
			expect(otherKey.value.allowed).toBe(true);
		}
	});

	it('evicts expired windows once the map grows past the cleanup threshold without breaking active keys', () => {
		const seam = createMockRateLimitSeam(rateLimitConfigFixture);
		const expiredWindowStart = rateLimitCheckRequestFixture.nowMs;

		for (let i = 0; i < 1001; i += 1) {
			seam.checkAndConsume({
				key: `ip:cleanup-${i}`,
				nowMs: expiredWindowStart
			});
		}

		const afterCleanup = seam.checkAndConsume({
			key: 'ip:cleanup-fresh',
			nowMs: expiredWindowStart + rateLimitConfigFixture.windowMs
		});
		expect(afterCleanup.ok).toBe(true);
		if (afterCleanup.ok) {
			expect(afterCleanup.value.allowed).toBe(true);
			expect(afterCleanup.value.remaining).toBe(
				rateLimitConfigFixture.maxRequests - 1
			);
		}
	});

	it('fault fixture (empty key) fails contract-level validation', () => {
		const seam = createMockRateLimitSeam(rateLimitConfigFixture);
		const result = seam.checkAndConsume(
			rateLimitCheckRequestFaultFixture as RateLimitCheckRequest
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('RATE_LIMIT_INVALID_KEY');
		}
	});
});
