// Purpose: Contract tests for RateLimitSeam.
// Why: Prove the sliding-window limiter enforces budgets correctly and that invalid input
//      fails before any state is recorded.
// Info flow: tests -> mock (= real limiter, no I/O to fake) -> contract assertions.
import { describe, expect, it } from 'vitest';
import { invalidCheckInputFixtures, sampleCheckInput, sampleKey } from './fixtures';
import { createMockRateLimitSeam } from './mock';

describe('RateLimitSeam mock contract', () => {
	it('allows requests under the limit and decrements remaining', () => {
		const seam = createMockRateLimitSeam();

		const first = seam.checkAndConsume(sampleCheckInput);
		expect(first.ok).toBe(true);
		if (!first.ok) return;
		expect(first.value).toEqual({
			limit: 3,
			remaining: 2,
			resetAtMs: sampleCheckInput.nowMs + sampleCheckInput.windowMs
		});

		const second = seam.checkAndConsume({ ...sampleCheckInput, nowMs: sampleCheckInput.nowMs + 1 });
		expect(second.ok).toBe(true);
		if (!second.ok) return;
		expect(second.value.remaining).toBe(1);
	});

	it('blocks the request that exceeds the limit', () => {
		const seam = createMockRateLimitSeam();
		seam.checkAndConsume(sampleCheckInput);
		seam.checkAndConsume({ ...sampleCheckInput, nowMs: sampleCheckInput.nowMs + 1 });
		seam.checkAndConsume({ ...sampleCheckInput, nowMs: sampleCheckInput.nowMs + 2 });

		const fourth = seam.checkAndConsume({ ...sampleCheckInput, nowMs: sampleCheckInput.nowMs + 3 });

		expect(fourth.ok).toBe(false);
		if (fourth.ok) return;
		expect(fourth.error.code).toBe('RATE_LIMIT_EXCEEDED');
		if (fourth.error.code !== 'RATE_LIMIT_EXCEEDED') return;
		expect(fourth.error.resetAtMs).toBe(sampleCheckInput.nowMs + sampleCheckInput.windowMs);
	});

	it('keeps blocking just before the window fully elapses', () => {
		const seam = createMockRateLimitSeam();
		for (let i = 0; i < 3; i += 1) {
			seam.checkAndConsume({ ...sampleCheckInput, nowMs: sampleCheckInput.nowMs + i });
		}

		const result = seam.checkAndConsume({
			...sampleCheckInput,
			nowMs: sampleCheckInput.nowMs + sampleCheckInput.windowMs - 1
		});

		expect(result.ok).toBe(false);
	});

	it('allows requests again once the oldest hit has fully expired', () => {
		const seam = createMockRateLimitSeam();
		for (let i = 0; i < 3; i += 1) {
			seam.checkAndConsume({ ...sampleCheckInput, nowMs: sampleCheckInput.nowMs + i });
		}

		// All 3 hits were recorded within a 2ms span (nowMs..nowMs+2), so the window must
		// elapse relative to the *last* hit (nowMs+2), not just the first, before all 3 expire.
		const result = seam.checkAndConsume({
			...sampleCheckInput,
			nowMs: sampleCheckInput.nowMs + sampleCheckInput.windowMs + 3
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.remaining).toBe(2);
	});

	it('tracks independent budgets per key', () => {
		const seam = createMockRateLimitSeam();
		for (let i = 0; i < 3; i += 1) {
			seam.checkAndConsume({ ...sampleCheckInput, nowMs: sampleCheckInput.nowMs + i });
		}

		const otherKeyResult = seam.checkAndConsume({
			...sampleCheckInput,
			key: 'generate:198.51.100.7',
			nowMs: sampleCheckInput.nowMs + 3
		});

		expect(otherKeyResult.ok).toBe(true);
		if (!otherKeyResult.ok) return;
		expect(otherKeyResult.value.remaining).toBe(2);
	});

	it('state is isolated per seam instance', () => {
		const seamA = createMockRateLimitSeam();
		const seamB = createMockRateLimitSeam();
		for (let i = 0; i < 3; i += 1) {
			seamA.checkAndConsume({ ...sampleCheckInput, nowMs: sampleCheckInput.nowMs + i });
		}

		const resultOnB = seamB.checkAndConsume({ ...sampleCheckInput, nowMs: sampleCheckInput.nowMs + 3 });

		expect(resultOnB.ok).toBe(true);
	});

	it.each(invalidCheckInputFixtures)(
		'fault fixture %j fails with RATE_LIMIT_INPUT_INVALID before recording a hit',
		(invalidInput) => {
			const seam = createMockRateLimitSeam();
			const result = seam.checkAndConsume(invalidInput as never);

			expect(result.ok).toBe(false);
			if (result.ok) return;
			expect(result.error.code).toBe('RATE_LIMIT_INPUT_INVALID');

			// Confirm the rejected call left no state: a valid call right after still has a full budget.
			const followUp = seam.checkAndConsume(sampleCheckInput);
			expect(followUp.ok).toBe(true);
			if (!followUp.ok) return;
			expect(followUp.value.remaining).toBe(2);
		}
	);

	it('uses the caller-built key verbatim', () => {
		const seam = createMockRateLimitSeam();
		const result = seam.checkAndConsume(sampleCheckInput);
		expect(result.ok).toBe(true);
		expect(sampleCheckInput.key).toBe(sampleKey);
	});
});
