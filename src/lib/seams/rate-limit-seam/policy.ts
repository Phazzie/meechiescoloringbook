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

	const evictExpired = (now: number, windowMs: number): void => {
		if (windows.size <= CLEANUP_THRESHOLD) return;
		for (const [staleKey, staleState] of windows) {
			if (now - staleState.windowStart >= windowMs) windows.delete(staleKey);
		}
	};

	return {
		checkAndConsume: ({ key, maxRequests, windowMs, now }: RateLimitCheckInput): RateLimitResult => {
			// The contract type doesn't statically enforce positive bounds, so a
			// caller passing a non-positive maxRequests/windowMs (misconfigured env,
			// future direct use of this policy) must fail closed rather than allow
			// unlimited requests (maxRequests <= 0 would never block) or divide by a
			// degenerate window.
			if (maxRequests < 1 || windowMs < 1) {
				return {
					ok: false,
					error: {
						code: 'RATE_LIMIT_EXCEEDED',
						message: 'Rate limit configuration is invalid; failing closed.',
						retryAfterMs: Math.max(0, windowMs),
						resetAt: now + Math.max(0, windowMs)
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
