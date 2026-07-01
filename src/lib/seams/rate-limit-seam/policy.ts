// Purpose: Implement the deterministic RateLimitSeam fixed-window limiter.
// Why: Cap abuse of paid AI-calling routes without any external store dependency.
// Info flow: route -> rate limiter helper -> policy.checkAndConsume -> RateLimitResult.
import type { RateLimitCheckInput, RateLimitResult, RateLimitSeam } from './contract';

type WindowState = {
	count: number;
	windowStart: number;
	// The policy this window was opened under. If a later call for the same key arrives
	// under a different maxRequests/windowMs, the accumulated count/windowStart belong to a
	// policy that no longer applies — reusing them would let one caller's quota bleed into
	// another's, or apply a stale windowMs to eviction/reset decisions.
	maxRequests: number;
	windowMs: number;
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
			// The contract type doesn't statically enforce positive, finite, integer
			// bounds, so a caller passing a non-integer, non-positive, or non-finite
			// maxRequests/windowMs/now (misconfigured env, future direct use of this
			// policy) must fail closed rather than allow unlimited requests
			// (maxRequests <= 0, or Infinity, would never block), divide by a
			// degenerate window, or return fractional/negative remaining/resetAt
			// values that violate the RateLimitResult integer contract.
			if (
				!Number.isInteger(maxRequests) ||
				maxRequests < 1 ||
				!Number.isInteger(windowMs) ||
				windowMs < 1 ||
				!Number.isInteger(now) ||
				now < 0
			) {
				// windowMs/now may themselves be the non-finite/non-integer/invalid
				// value, so neither can be reused verbatim to build the result — contract
				// validators (e.g. the rateLimitErrorSchema int bounds) require a finite,
				// integer, non-negative result, so each fallback is independently clamped
				// rather than passed through as-is.
				const fallbackRetryAfterMs = Number.isFinite(windowMs) ? Math.floor(Math.max(0, windowMs)) : 0;
				const fallbackNow = Number.isInteger(now) && now >= 0 ? now : 0;
				return {
					ok: false,
					error: {
						code: 'RATE_LIMIT_EXCEEDED',
						message: 'Rate limit configuration is invalid; failing closed.',
						retryAfterMs: fallbackRetryAfterMs,
						resetAt: fallbackNow + fallbackRetryAfterMs
					}
				};
			}
			evictExpired(now, windowMs);
			const existing = windows.get(key);
			// A backward clock step (e.g. an NTP correction) can land `now` behind
			// `existing.windowStart`, making `now - existing.windowStart` negative —
			// never >= windowMs — so the stale, possibly-exhausted window would be
			// reused instead of reset, inflating retryAfterMs/resetAt for the client.
			// A policy change (different maxRequests/windowMs than the window was opened
			// under) also forces a fresh window — the existing count was accumulated
			// under a quota that no longer applies to this call.
			const isFreshWindow =
				!existing ||
				existing.maxRequests !== maxRequests ||
				existing.windowMs !== windowMs ||
				now - existing.windowStart >= windowMs ||
				now < existing.windowStart;
			const state: WindowState = isFreshWindow
				? { count: 0, windowStart: now, maxRequests, windowMs }
				: existing;

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
