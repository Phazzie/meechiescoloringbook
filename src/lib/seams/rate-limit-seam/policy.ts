// Purpose: Implement the deterministic RateLimitSeam fixed-window limiter.
// Why: Cap abuse of paid AI-calling routes without any external store dependency.
// Info flow: route -> rate limiter helper -> policy.checkAndConsume -> RateLimitResult.
import type { RateLimitCheckInput, RateLimitResult, RateLimitSeam } from './contract';

type WindowState = {
	count: number;
	windowStart: number;
};

export const createRateLimitSeam = (): RateLimitSeam => {
	const windows = new Map<string, WindowState>();

	return {
		checkAndConsume: ({ key, maxRequests, windowMs, now }: RateLimitCheckInput): RateLimitResult => {
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
