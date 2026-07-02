// Purpose: Contract tests for RateLimitSeam.
// Why: Enforce mock adherence to the seam contract and prove window/reset behavior deterministically.
// Info flow: tests -> mock -> contract assertions.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sampleConsumeInput } from './fixtures';
import { createMockRateLimitSeam } from './mock';
import { validateRateLimitResult } from './validators';

describe('RateLimitSeam mock contract', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('allows requests under the limit and decrements remaining', () => {
		const seam = createMockRateLimitSeam();

		const first = seam.consume(sampleConsumeInput);
		expect(first).toEqual({ ok: true, remaining: 2, resetAtMs: sampleConsumeInput.windowMs });
		expect(validateRateLimitResult(first)).toEqual(first);

		const second = seam.consume(sampleConsumeInput);
		expect(second).toEqual({ ok: true, remaining: 1, resetAtMs: sampleConsumeInput.windowMs });
	});

	it('rejects requests once the limit is exceeded within a window', () => {
		const seam = createMockRateLimitSeam();

		seam.consume(sampleConsumeInput);
		seam.consume(sampleConsumeInput);
		seam.consume(sampleConsumeInput);
		const fourth = seam.consume(sampleConsumeInput);

		expect(fourth.ok).toBe(false);
		expect(validateRateLimitResult(fourth)).toEqual(fourth);
		if (!fourth.ok) {
			expect(fourth.error.code).toBe('RATE_LIMITED');
			expect(fourth.error.retryAfterMs).toBe(sampleConsumeInput.windowMs);
		}
	});

	it('tracks independent keys separately', () => {
		const seam = createMockRateLimitSeam();

		seam.consume(sampleConsumeInput);
		seam.consume(sampleConsumeInput);
		seam.consume(sampleConsumeInput);
		const otherKeyResult = seam.consume({ ...sampleConsumeInput, key: 'test-route:10.0.0.1' });

		expect(otherKeyResult).toEqual({ ok: true, remaining: 2, resetAtMs: sampleConsumeInput.windowMs });
	});

	it('resets the window after windowMs has elapsed', () => {
		const seam = createMockRateLimitSeam();

		seam.consume(sampleConsumeInput);
		seam.consume(sampleConsumeInput);
		seam.consume(sampleConsumeInput);
		const blocked = seam.consume(sampleConsumeInput);
		expect(blocked.ok).toBe(false);

		vi.setSystemTime(sampleConsumeInput.windowMs);
		const afterReset = seam.consume(sampleConsumeInput);

		expect(afterReset).toEqual({ ok: true, remaining: 2, resetAtMs: sampleConsumeInput.windowMs * 2 });
	});
});
