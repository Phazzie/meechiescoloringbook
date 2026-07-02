// Purpose: Implement a deterministic in-process fixed-window rate limiter.
// Why: Serverless functions have no external store by default; an in-memory window still bounds
//      abusive bursts within a warm instance without adding new infrastructure dependencies.
// Info flow: route call -> consume(key) -> per-key window Map -> RateLimitResult.
import type { RateLimitConsumeInput, RateLimitResult, RateLimitSeam } from './contract';

type WindowState = { count: number; windowStart: number };

export const createRateLimitSeam = (now: () => number = () => Date.now()): RateLimitSeam => {
	const windows = new Map<string, WindowState>();

	const consume = ({ key, limit, windowMs }: RateLimitConsumeInput): RateLimitResult => {
		const currentTime = now();
		const existing = windows.get(key);
		const isSameWindow = existing !== undefined && currentTime - existing.windowStart < windowMs;
		const windowStart = isSameWindow ? existing.windowStart : currentTime;
		const count = (isSameWindow ? existing.count : 0) + 1;
		windows.set(key, { count, windowStart });
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

	return { consume };
};
