// Purpose: Unit tests for the RateLimitSeam adapter's env-driven configuration.
// Why: Ensure RATE_LIMIT_MAX_REQUESTS / RATE_LIMIT_WINDOW_MS are parsed safely with sane defaults.
// Info flow: env -> createRateLimitSeam -> RateLimitDecision assertions.
import { describe, expect, it } from 'vitest';
import { createRateLimitSeam } from '../../src/lib/adapters/rate-limit-seam';

describe('RateLimitSeam adapter', () => {
	it('uses default limits when env vars are absent', () => {
		const seam = createRateLimitSeam({});
		const result = seam.checkAndConsume({ key: 'ip:198.51.100.1', nowMs: 0 });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.limit).toBe(20);
		}
	});

	it('parses RATE_LIMIT_MAX_REQUESTS and RATE_LIMIT_WINDOW_MS from env', () => {
		const seam = createRateLimitSeam({
			RATE_LIMIT_MAX_REQUESTS: '2',
			RATE_LIMIT_WINDOW_MS: '5000'
		});

		const first = seam.checkAndConsume({ key: 'ip:198.51.100.2', nowMs: 0 });
		const second = seam.checkAndConsume({ key: 'ip:198.51.100.2', nowMs: 0 });
		const third = seam.checkAndConsume({ key: 'ip:198.51.100.2', nowMs: 0 });

		expect(first.ok && first.value.allowed).toBe(true);
		expect(second.ok && second.value.allowed).toBe(true);
		expect(third.ok && third.value.allowed).toBe(false);
	});

	it('falls back to defaults when env values are non-numeric', () => {
		const seam = createRateLimitSeam({
			RATE_LIMIT_MAX_REQUESTS: 'abc',
			RATE_LIMIT_WINDOW_MS: ''
		});
		const result = seam.checkAndConsume({ key: 'ip:198.51.100.3', nowMs: 0 });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.limit).toBe(20);
		}
	});

	it('falls back to defaults when env values are zero or negative', () => {
		const seam = createRateLimitSeam({
			RATE_LIMIT_MAX_REQUESTS: '0',
			RATE_LIMIT_WINDOW_MS: '-5'
		});
		const result = seam.checkAndConsume({ key: 'ip:198.51.100.4', nowMs: 0 });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.limit).toBe(20);
		}
	});
});
