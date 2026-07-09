// Purpose: Contract tests for RateLimitSeam.
// Why: Enforce mock adherence to the seam contract; red proof that fault fixture fails validation;
//      lock the fixed-window allow/deny/reset behavior.
// Info flow: tests -> mock/adapter -> contract assertions.
import { describe, expect, it } from 'vitest';
import { createRateLimitSeam } from '../../adapters/rate-limit-seam';
import { rateLimitFaultInput, rateLimitSampleInput } from './fixtures';
import { createMockRateLimitSeam } from './mock';

describe('RateLimitSeam mock contract', () => {
	it('allows requests under the limit and reports remaining budget', () => {
		const seam = createMockRateLimitSeam(0);
		const result = seam.checkLimit(rateLimitSampleInput);
		expect(result).toEqual({
			ok: true,
			value: { allowed: true, remaining: 2, resetAt: 60_000 }
		});
	});

	it('denies requests once the limit is reached within the same window', () => {
		const seam = createMockRateLimitSeam(0);
		seam.checkLimit(rateLimitSampleInput);
		seam.checkLimit(rateLimitSampleInput);
		seam.checkLimit(rateLimitSampleInput);
		const fourth = seam.checkLimit(rateLimitSampleInput);
		expect(fourth).toEqual({
			ok: true,
			value: { allowed: false, remaining: 0, resetAt: 60_000 }
		});
	});

	it('fault fixture fails validation (red proof)', () => {
		const seam = createMockRateLimitSeam(0);
		const result = seam.checkLimit(rateLimitFaultInput);
		expect(result).toEqual({
			ok: false,
			error: {
				code: 'RATE_LIMIT_INVALID_INPUT',
				message: 'Rate limit check input failed validation.'
			}
		});
	});

	it('different keys are tracked independently', () => {
		const seam = createMockRateLimitSeam(0);
		seam.checkLimit(rateLimitSampleInput);
		seam.checkLimit(rateLimitSampleInput);
		seam.checkLimit(rateLimitSampleInput);
		const otherKey = seam.checkLimit({ ...rateLimitSampleInput, key: 'other-route:127.0.0.1' });
		expect(otherKey).toEqual({
			ok: true,
			value: { allowed: true, remaining: 2, resetAt: 60_000 }
		});
	});
});

describe('RateLimitSeam adapter', () => {
	it('uses an injected clock and a fresh store per instance', () => {
		let now = 1_000;
		const seam = createRateLimitSeam(new Map(), () => now);
		const first = seam.checkLimit({ key: 'adapter-route:1.2.3.4', limit: 1, windowMs: 10_000 });
		expect(first).toEqual({ ok: true, value: { allowed: true, remaining: 0, resetAt: 11_000 } });

		const second = seam.checkLimit({ key: 'adapter-route:1.2.3.4', limit: 1, windowMs: 10_000 });
		expect(second).toEqual({ ok: true, value: { allowed: false, remaining: 0, resetAt: 11_000 } });

		now = 11_000;
		const thirdAfterWindow = seam.checkLimit({
			key: 'adapter-route:1.2.3.4',
			limit: 1,
			windowMs: 10_000
		});
		expect(thirdAfterWindow).toEqual({
			ok: true,
			value: { allowed: true, remaining: 0, resetAt: 21_000 }
		});
	});

	it('returns a validation error result instead of throwing on malformed input', () => {
		const seam = createRateLimitSeam(new Map(), () => 0);
		const result = seam.checkLimit({ key: '', limit: 5, windowMs: 1_000 });
		expect(result.ok).toBe(false);
	});
});
