// Purpose: Unit tests for the pure fixed-window rate limit algorithm.
// Why: Lock allow/deny/reset/remaining behavior independent of any seam wiring.
// Info flow: store + input -> evaluateRateLimit -> decision assertions.
import { describe, expect, it } from 'vitest';
import { evaluateRateLimit, type RateLimitStore } from '../../src/lib/core/rate-limit';

describe('evaluateRateLimit', () => {
	it('allows the first request in a fresh window and decrements remaining', () => {
		const store: RateLimitStore = new Map();
		const decision = evaluateRateLimit(store, { key: 'k', limit: 2, windowMs: 1000, now: 0 });
		expect(decision).toEqual({ allowed: true, remaining: 1, resetAt: 1000 });
	});

	it('denies once the limit is exhausted within the same window', () => {
		const store: RateLimitStore = new Map();
		evaluateRateLimit(store, { key: 'k', limit: 2, windowMs: 1000, now: 0 });
		evaluateRateLimit(store, { key: 'k', limit: 2, windowMs: 1000, now: 100 });
		const third = evaluateRateLimit(store, { key: 'k', limit: 2, windowMs: 1000, now: 200 });
		expect(third).toEqual({ allowed: false, remaining: 0, resetAt: 1000 });
	});

	it('resets the count once the window elapses', () => {
		const store: RateLimitStore = new Map();
		evaluateRateLimit(store, { key: 'k', limit: 1, windowMs: 1000, now: 0 });
		const beforeReset = evaluateRateLimit(store, { key: 'k', limit: 1, windowMs: 1000, now: 999 });
		expect(beforeReset.allowed).toBe(false);

		const afterReset = evaluateRateLimit(store, { key: 'k', limit: 1, windowMs: 1000, now: 1000 });
		expect(afterReset).toEqual({ allowed: true, remaining: 0, resetAt: 2000 });
	});

	it('tracks separate keys independently in the same store', () => {
		const store: RateLimitStore = new Map();
		evaluateRateLimit(store, { key: 'a', limit: 1, windowMs: 1000, now: 0 });
		const other = evaluateRateLimit(store, { key: 'b', limit: 1, windowMs: 1000, now: 0 });
		expect(other.allowed).toBe(true);
	});
});
