// Purpose: Implement the deterministic RateLimitSeam fixed-window limiter.
// Why: Keep abuse-protection logic behind one pure, clock-injected implementation shared by tests and production.
// Info flow: checkAndConsume({ key, nowMs }) -> in-memory window map -> RateLimitDecision.
import type {
	RateLimitCheckRequest,
	RateLimitConfig,
	RateLimitDecision,
	RateLimitError,
	RateLimitSeam
} from './contract';
import type { Result } from '../../../../contracts/shared.contract';
import {
	validateRateLimitCheckRequest,
	validateRateLimitConfig
} from './validators';

type WindowState = {
	windowStart: number;
	count: number;
};

export const createRateLimitSeam = (config: RateLimitConfig): RateLimitSeam => {
	const { maxRequests, windowMs } = validateRateLimitConfig(config);
	const windows = new Map<string, WindowState>();

	return {
		checkAndConsume: (request): Result<RateLimitDecision, RateLimitError> => {
			let validated: RateLimitCheckRequest;
			try {
				validated = validateRateLimitCheckRequest(request);
			} catch {
				return {
					ok: false,
					error: {
						code: 'RATE_LIMIT_INVALID_KEY',
						message: 'Rate limit key must be a non-empty string.'
					}
				};
			}

			const { key, nowMs } = validated;
			const existing = windows.get(key);
			const carryOver =
				existing !== undefined && nowMs - existing.windowStart < windowMs
					? existing
					: undefined;
			const windowStart = carryOver?.windowStart ?? nowMs;
			const count = (carryOver?.count ?? 0) + 1;

			windows.set(key, { windowStart, count });

			const resetAtMs = windowStart + windowMs;
			const allowed = count <= maxRequests;

			return {
				ok: true,
				value: {
					allowed,
					limit: maxRequests,
					remaining: Math.max(0, maxRequests - count),
					resetAtMs,
					retryAfterMs: allowed ? 0 : Math.max(0, resetAtMs - nowMs)
				}
			};
		}
	};
};
