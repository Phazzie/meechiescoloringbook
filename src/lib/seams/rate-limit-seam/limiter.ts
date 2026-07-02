// Purpose: Implement a deterministic in-process fixed-window rate limiter.
// Why: Serverless functions have no external store by default; an in-memory window still bounds
//      abusive bursts within a warm instance without adding new infrastructure dependencies.
// Info flow: route call -> consume(key) -> per-key window Map -> RateLimitResult.
import type { RateLimitConsumeInput, RateLimitResult, RateLimitSeam } from './contract';

type WindowState = { count: number; windowStart: number; windowMs: number };

// Sweep for expired entries once the tracked key count passes this size, instead of on every
// call, so eviction overhead stays negligible under normal (bounded) traffic.
const EVICTION_SWEEP_THRESHOLD = 1000;

// Hard ceiling on distinct tracked keys. Expired-entry eviction alone cannot bound memory
// against a flood of always-fresh distinct keys (e.g. an attacker varying source IPs), since
// none of those entries are ever "expired" while the attack is in progress. Once this cap is
// hit, the oldest windows are evicted regardless of expiry so memory stays bounded even under
// sustained high-cardinality abuse.
const HARD_CAP = 5000;

export const createRateLimitSeam = (now: () => number = () => Date.now()): RateLimitSeam => {
	const windows = new Map<string, WindowState>();

	const evictExpiredEntries = (currentTime: number) => {
		for (const [entryKey, state] of windows) {
			if (currentTime - state.windowStart >= state.windowMs) {
				windows.delete(entryKey);
			}
		}
	};

	const evictOldestUntilUnderCap = () => {
		if (windows.size <= HARD_CAP) return;
		const oldestFirst = [...windows.entries()].sort(
			(a, b) => a[1].windowStart - b[1].windowStart
		);
		const overflow = windows.size - HARD_CAP;
		for (let i = 0; i < overflow; i += 1) {
			windows.delete(oldestFirst[i][0]);
		}
	};

	const consume = ({ key, limit, windowMs }: RateLimitConsumeInput): RateLimitResult => {
		const currentTime = now();
		if (windows.size > EVICTION_SWEEP_THRESHOLD) {
			evictExpiredEntries(currentTime);
			evictOldestUntilUnderCap();
		}

		const existing = windows.get(key);
		const isSameWindow = existing !== undefined && currentTime - existing.windowStart < windowMs;
		const windowStart = isSameWindow ? existing.windowStart : currentTime;
		const count = (isSameWindow ? existing.count : 0) + 1;
		windows.set(key, { count, windowStart, windowMs });
		const resetAtMs = windowStart + windowMs;

		if (count > limit) {
			return {
				ok: false,
				error: {
					code: 'RATE_LIMITED',
					message: 'Too many requests. Please slow down and try again shortly.',
					retryAfterMs: Math.max(0, resetAtMs - currentTime)
				}
			};
		}

		return { ok: true, remaining: Math.max(0, limit - count), resetAtMs };
	};

	return { consume, size: () => windows.size };
};
