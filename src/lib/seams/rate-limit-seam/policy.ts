// Purpose: Implement the deterministic RateLimitSeam fixed-window limiter.
// Why: Cap abuse of paid AI-calling routes without any external store dependency.
// Info flow: route -> rate limiter helper -> policy.checkAndConsume -> RateLimitResult.
import type { RateLimitCheckInput, RateLimitResult, RateLimitSeam } from './contract';

type WindowState = {
	count: number;
	windowStart: number;
};

const CLEANUP_THRESHOLD = 1000;

export const createRateLimitSeam = (): RateLimitSeam => {
	const windows = new Map<string, WindowState>();
	let lastCleanupAt = 0;

	// Once the map is large, scanning it on every single request is an O(N)
	// cost paid per request. Throttling the scan to at most once per window
	// keeps the amortized cost near O(1) without changing eviction semantics
	// (stale entries are still removed before they could accumulate further).
	const evictExpired = (now: number, windowMs: number): void => {
		if (windows.size <= CLEANUP_THRESHOLD) return;
		// A backward clock step (e.g. an NTP correction) makes `now - lastCleanupAt`
		// negative, which would otherwise stay below `windowMs` and suppress every
		// sweep until real time catches back up to the pre-rollback baseline.
		if (now >= lastCleanupAt && now - lastCleanupAt < windowMs) return;
		lastCleanupAt = now;
		for (const [staleKey, staleState] of windows) {
			if (now - staleState.windowStart >= windowMs) windows.delete(staleKey);
		}
	};

	return {
		checkAndConsume: ({ key, maxRequests, windowMs, now }: RateLimitCheckInput): RateLimitResult => {
			// The contract type doesn't statically enforce positive, finite bounds,
			// so a caller passing a non-positive or non-finite maxRequests/windowMs
			// (misconfigured env, future direct use of this policy) must fail closed
			// rather than allow unlimited requests (maxRequests <= 0, or Infinity,
			// would never block) or divide by a degenerate window.
			if (
				!Number.isFinite(maxRequests) ||
				maxRequests < 1 ||
				!Number.isFinite(windowMs) ||
				windowMs < 1
			) {
				// windowMs itself may be the non-finite/invalid value, so it cannot be
				// reused to size the retry hint — contract validators (e.g. the
				// rateLimitErrorSchema int bounds) require a finite, bounded result.
				const fallbackRetryAfterMs = Number.isFinite(windowMs) ? Math.max(0, windowMs) : 0;
				return {
					ok: false,
					error: {
						code: 'RATE_LIMIT_EXCEEDED',
						message: 'Rate limit configuration is invalid; failing closed.',
						retryAfterMs: fallbackRetryAfterMs,
						resetAt: now + fallbackRetryAfterMs
					}
				};
			}
			evictExpired(now, windowMs);
			const existing = windows.get(key);
			const isFreshWindow = !existing || now - existing.windowStart >= windowMs;
			const state: WindowState = isFreshWindow ? { count: 0, windowStart: now } : existing;

			if (state.count >= maxRequests) {
				windows.set(key, state);
				const resetAt = state.windowStart + windowMs;
				return {
					ok: false,
					error: {
						code: 'RATE_LIMIT_EXCEEDED',
						message: 'Too many requests. Please try again later.',
						retryAfterMs: Math.max(0, resetAt - now),
						resetAt
					}
				};
			}

			state.count += 1;
			windows.set(key, state);
			return {
				ok: true,
				remaining: maxRequests - state.count,
				resetAt: state.windowStart + windowMs
			};
		},
		reset: () => windows.clear()
	};
};
