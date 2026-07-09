// Purpose: Unit tests for the pure fixed-window rate limit algorithm.
// Why: Lock allow/deny/reset/remaining behavior independent of any seam wiring.
// Info flow: store + input -> evaluateRateLimit -> decision assertions.
import { describe, expect, it } from 'vitest';
import {
	MAX_RATE_LIMIT_STORE_ENTRIES,
	evaluateRateLimit,
	type RateLimitStore
} from '../../src/lib/core/rate-limit';

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

	it('never grows the store past the cap, preferring to evict an already-expired entry', () => {
		const store: RateLimitStore = new Map();
		for (let i = 0; i < MAX_RATE_LIMIT_STORE_ENTRIES; i++) {
			evaluateRateLimit(store, { key: `expired-${i}`, limit: 1, windowMs: 1000, now: 0 });
		}
		expect(store.size).toBe(MAX_RATE_LIMIT_STORE_ENTRIES);

		// All prior entries are now outside their window; a new key should evict one of them
		// rather than growing the store past the cap.
		evaluateRateLimit(store, { key: 'new-key', limit: 1, windowMs: 1000, now: 5000 });
		expect(store.size).toBe(MAX_RATE_LIMIT_STORE_ENTRIES);
		expect(store.has('new-key')).toBe(true);
	});

	it('falls back to FIFO eviction of the oldest key when every entry is still active', () => {
		const store: RateLimitStore = new Map();
		for (let i = 0; i < MAX_RATE_LIMIT_STORE_ENTRIES; i++) {
			evaluateRateLimit(store, { key: `active-${i}`, limit: 100, windowMs: 60_000, now: 0 });
		}
		expect(store.size).toBe(MAX_RATE_LIMIT_STORE_ENTRIES);
		expect(store.has('active-0')).toBe(true);

		// Still within every existing entry's window, so nothing is expired; the oldest
		// (first-inserted) key must be evicted to make room instead of growing unbounded.
		evaluateRateLimit(store, { key: 'active-new', limit: 100, windowMs: 60_000, now: 1 });
		expect(store.size).toBe(MAX_RATE_LIMIT_STORE_ENTRIES);
		expect(store.has('active-0')).toBe(false);
		expect(store.has('active-new')).toBe(true);
	});

	it('does not evict anything when updating an existing key at capacity', () => {
		const store: RateLimitStore = new Map();
		for (let i = 0; i < MAX_RATE_LIMIT_STORE_ENTRIES; i++) {
			evaluateRateLimit(store, { key: `active-${i}`, limit: 100, windowMs: 60_000, now: 0 });
		}
		evaluateRateLimit(store, { key: 'active-0', limit: 100, windowMs: 60_000, now: 1 });
		expect(store.size).toBe(MAX_RATE_LIMIT_STORE_ENTRIES);
		expect(store.has('active-0')).toBe(true);
	});
});
