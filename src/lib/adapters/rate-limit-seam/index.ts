// Purpose: Implement RateLimitSeam using an in-memory fixed-window counter.
// Why: Bound request volume per key without any external store. See probe.ts for the accepted
//      limitation: this is per-instance only, not distributed across serverless instances.
// Info flow: RateLimitSeam.consume(key, config) -> Map<key, window> -> Result<>.
import type { RateLimitConfig, RateLimitDecision, RateLimitError, RateLimitSeam } from '../../seams/rate-limit-seam/contract';
import type { Result } from '../../../../contracts/shared.contract';
import { validateRateLimitConfig, validateRateLimitKey } from '../../seams/rate-limit-seam/validators';

type Window = { start: number; count: number };

const validationError = (err: unknown): RateLimitError => ({
	code: 'RATE_LIMIT_EXCEEDED',
	message: err instanceof Error ? err.message : 'Rate limit input validation failed.',
	retryAfterMs: 0
});

export const createRateLimitSeam = (now: () => number = Date.now): RateLimitSeam => {
	const windows = new Map<string, Window>();

	return {
		consume: (key, config): Result<RateLimitDecision, RateLimitError> => {
			let validatedKey: string;
			let validatedConfig: RateLimitConfig;
			try {
				validatedKey = validateRateLimitKey(key);
				validatedConfig = validateRateLimitConfig(config);
			} catch (err) {
				return { ok: false, error: validationError(err) };
			}

			const nowMs = now();
			const existing = windows.get(validatedKey);
			const windowStart =
				existing && nowMs - existing.start < validatedConfig.windowMs ? existing.start : nowMs;
			const count = windowStart === existing?.start ? existing.count : 0;
			const resetAt = windowStart + validatedConfig.windowMs;

			if (count >= validatedConfig.limit) {
				windows.set(validatedKey, { start: windowStart, count });
				return {
					ok: false,
					error: {
						code: 'RATE_LIMIT_EXCEEDED',
						message: 'Too many requests. Please slow down and try again shortly.',
						retryAfterMs: Math.max(resetAt - nowMs, 0)
					}
				};
			}

			const nextCount = count + 1;
			windows.set(validatedKey, { start: windowStart, count: nextCount });
			return {
				ok: true,
				value: {
					remaining: validatedConfig.limit - nextCount,
					limit: validatedConfig.limit,
					resetAt
				}
			};
		}
	};
};
