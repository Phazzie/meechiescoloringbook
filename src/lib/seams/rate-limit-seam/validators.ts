// Purpose: Validate RateLimitSeam inputs.
// Why: Catch malformed keys/limits/windows/clock readings before they reach the limiter algorithm.
// Info flow: limiter/mock -> validators -> typed values or thrown TypeErrors.
import type { RateLimitCheckInput } from './contract';

export const validateRateLimitCheckInput = (input: unknown): RateLimitCheckInput => {
	if (typeof input !== 'object' || input === null) {
		throw new TypeError('Rate limit input must be an object.');
	}
	const { key, limit, windowMs, nowMs } = input as Record<string, unknown>;

	if (typeof key !== 'string' || key.length === 0) {
		throw new TypeError('Rate limit key must be a non-empty string.');
	}
	if (typeof limit !== 'number' || !Number.isInteger(limit) || limit <= 0) {
		throw new TypeError('Rate limit limit must be a positive integer.');
	}
	if (typeof windowMs !== 'number' || !Number.isFinite(windowMs) || windowMs <= 0) {
		throw new TypeError('Rate limit windowMs must be a positive, finite number.');
	}
	if (typeof nowMs !== 'number' || !Number.isFinite(nowMs) || nowMs < 0) {
		throw new TypeError('Rate limit nowMs must be a non-negative, finite number.');
	}

	return { key, limit, windowMs, nowMs };
};
