// Purpose: Contract tests for RateLimitSeam.
// Why: Enforce mock adherence to the seam contract and prove window/reset behavior deterministically.
// Info flow: tests -> mock -> contract assertions.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { faultConsumeInput, sampleConsumeInput } from './fixtures';
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

	it('red proof: the fault fixture fails on its first, stateless use', () => {
		const seam = createMockRateLimitSeam();

		const result = seam.consume(faultConsumeInput);

		expect(result.ok).toBe(false);
		expect(validateRateLimitResult(result)).toEqual(result);
		if (!result.ok) {
			expect(result.error.code).toBe('RATE_LIMITED');
			expect(result.error.retryAfterMs).toBe(faultConsumeInput.windowMs);
		}
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

	it('tracks the number of keys currently held via size()', () => {
		const seam = createMockRateLimitSeam();
		expect(seam.size()).toBe(0);

		seam.consume(sampleConsumeInput);
		expect(seam.size()).toBe(1);

		seam.consume({ ...sampleConsumeInput, key: 'test-route:10.0.0.1' });
		expect(seam.size()).toBe(2);
	});

	it('evicts expired entries once the tracked key count exceeds the sweep threshold', () => {
		const seam = createMockRateLimitSeam();
		const windowMs = 1000;

		for (let i = 0; i < 1001; i += 1) {
			seam.consume({ key: `sweep-key-${i}`, limit: 1, windowMs });
		}
		expect(seam.size()).toBe(1001);

		vi.setSystemTime(windowMs + 1);
		seam.consume({ key: 'sweep-trigger', limit: 1, windowMs });

		expect(seam.size()).toBe(1);
	});

	it('caps memory growth under a flood of always-fresh distinct keys (e.g. varying attacker IPs)', () => {
		const seam = createMockRateLimitSeam();
		const windowMs = 10 * 60_000;
		const floodSize = 6000;

		for (let i = 0; i < floodSize; i += 1) {
			seam.consume({ key: `flood-key-${i}`, limit: 1, windowMs });
		}

		expect(seam.size()).toBeLessThan(floodSize);
		expect(seam.size()).toBeLessThanOrEqual(5001);
	});
});
