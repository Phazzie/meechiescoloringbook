// Purpose: Implement RateLimitSeam using an in-memory fixed-window counter.
// Why: Bound request volume per key without any external store. See probe.ts for the accepted
//      limitation: this is per-instance only, not distributed across serverless instances.
// Info flow: RateLimitSeam.consume(key, config) -> Map<key, window> -> Result<>.
import type { RateLimitConfig, RateLimitDecision, RateLimitError, RateLimitSeam } from '../../seams/rate-limit-seam/contract';
import type { Result } from '../../../../contracts/shared.contract';
import { validateRateLimitConfig, validateRateLimitKey } from '../../seams/rate-limit-seam/validators';

type Window = { start: number; count: number; windowMs: number };

// Once the map grows past this size, sweep out windows that have fully expired so a
// long-lived warm instance seeing many unique client addresses does not grow unbounded.
const PRUNE_THRESHOLD = 1000;

// Hard ceiling independent of expiry: a burst of many distinct route:clientAddress keys
// that are all still active within the same window would make pruning a no-op, so cap total
// entries and evict the oldest-inserted key (FIFO) before admitting a new one past this size.
const MAX_ENTRIES = 5000;

const configInvalidError = (err: unknown): RateLimitError => ({
	code: 'RATE_LIMIT_CONFIG_INVALID',
	message: err instanceof Error ? err.message : 'Rate limit input validation failed.',
	retryAfterMs: 0
});

export const createRateLimitSeam = (now: () => number = Date.now): RateLimitSeam => {
	const windows = new Map<string, Window>();

	const pruneExpired = (nowMs: number) => {
		if (windows.size <= PRUNE_THRESHOLD) return;
		for (const [k, win] of windows) {
			if (nowMs - win.start >= win.windowMs) windows.delete(k);
		}
	};

	const evictOldestIfAtCapacity = () => {
		if (windows.size < MAX_ENTRIES) return;
		const oldestKey = windows.keys().next().value;
		if (oldestKey !== undefined) windows.delete(oldestKey);
	};

	return {
		consume: (key, config): Result<RateLimitDecision, RateLimitError> => {
			let validatedKey: string;
			let validatedConfig: RateLimitConfig;
			try {
				validatedKey = validateRateLimitKey(key);
				validatedConfig = validateRateLimitConfig(config);
			} catch (err) {
				return { ok: false, error: configInvalidError(err) };
			}

			const nowMs = now();
			pruneExpired(nowMs);

			const existing = windows.get(validatedKey);
			if (!existing) evictOldestIfAtCapacity();
			const windowStart =
				existing && nowMs - existing.start < validatedConfig.windowMs ? existing.start : nowMs;
			const count = windowStart === existing?.start ? existing.count : 0;
			const resetAt = windowStart + validatedConfig.windowMs;

			if (count >= validatedConfig.limit) {
				windows.set(validatedKey, { start: windowStart, count, windowMs: validatedConfig.windowMs });
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
			windows.set(validatedKey, { start: windowStart, count: nextCount, windowMs: validatedConfig.windowMs });
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
